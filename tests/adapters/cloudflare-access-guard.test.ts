import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildWebAccess } from '../../src/adapters/config/web-access.ts';
import { admitMethod, allowsMethod } from '../../src/adapters/http/access-level.ts';
import { admitCloudflareRequest, requiresCloudflareAccess } from '../../src/adapters/http/cloudflare-access-guard.ts';
import { type AccessTokenVerifier, type AccessVerdict, createAccessTokenVerifier } from '../../src/adapters/http/cloudflare-access-verifier.ts';
import { admitRequest } from '../../src/adapters/http/request-admission.ts';
import { ACCESS_CONFIG, claims, fakeJwks, manualClock, NOW_SEC, signingKey, token } from '../support/access-tokens.ts';

const access = buildWebAccess(4370, '.example.test', undefined, 'https://br.example.test');
const PUBLIC = { host: 'br.example.test', 'cf-connecting-ip': '192.0.2.1', 'cf-ray': 'x' };

function fixedVerifier(verdict: AccessVerdict | Error): AccessTokenVerifier & { seen: string[] } {
  const seen: string[] = [];
  return {
    seen,
    verify: async (t) => {
      seen.push(t);
      if (verdict instanceof Error) throw verdict;
      return verdict;
    },
  };
}

function errorLog(): ((error: unknown) => void) & { messages: string[] } {
  const messages: string[] = [];
  return Object.assign((error: unknown) => void messages.push(error instanceof Error ? error.message : String(error)), { messages });
}

async function refusalOf(admission: Promise<{ level: string } | { refusal: { status: number; body: string } }>) {
  const result = await admission;
  if (!('refusal' in result)) return { status: 0, error: `admitted as ${result.level}` };
  return { status: result.refusal.status, error: (JSON.parse(result.refusal.body) as { error: string }).error };
}

describe('which requests need Cloudflare Access', () => {
  it('lets only the own loopback authority without forwarding headers skip it', () => {
    for (const host of ['127.0.0.1:4370', 'localhost:4370', '[::1]:4370', 'LOCALHOST:4370']) assert.equal(requiresCloudflareAccess({ host }, access), false, host);
    for (const headers of [
      { host: 'br.example.test' },
      { host: '127.0.0.1' },
      {},
      { host: '127.0.0.1:4370', 'cf-connecting-ip': '192.0.2.1' },
      { host: '127.0.0.1:4370', 'cf-access-jwt-assertion': 'x' },
      { host: '127.0.0.1:4370', 'x-forwarded-for': '192.0.2.1' },
      { host: 'localhost:4370', forwarded: 'for=192.0.2.1' },
    ]) {
      assert.equal(requiresCloudflareAccess(headers, access), true, JSON.stringify(headers));
    }
  });
});

describe('Cloudflare Access guard', () => {
  it('passes loopback through as local without asking the verifier', async () => {
    const verifier = fixedVerifier('invalid');
    assert.deepEqual(await admitCloudflareRequest({ host: '127.0.0.1:4370' }, access, verifier, errorLog()), { level: 'local' });
    assert.deepEqual(await admitCloudflareRequest({ host: '127.0.0.1:4370' }, access, undefined, errorLog()), { level: 'local' });
    assert.deepEqual(verifier.seen, []);
  });

  it('answers 503 cloudflare_access_not_configured when Access is not configured', async () => {
    assert.deepEqual(await refusalOf(admitCloudflareRequest({ ...PUBLIC, 'cf-access-jwt-assertion': 'x' }, access, undefined, errorLog())), { status: 503, error: 'cloudflare_access_not_configured' });
  });

  it('answers 403 cloudflare_access_required without a token, even for a forwarded loopback Host', async () => {
    const verifier = fixedVerifier('valid');
    assert.deepEqual(await refusalOf(admitCloudflareRequest(PUBLIC, access, verifier, errorLog())), { status: 403, error: 'cloudflare_access_required' });
    assert.deepEqual(await refusalOf(admitCloudflareRequest({ host: '127.0.0.1:4370', 'cf-ray': 'x' }, access, verifier, errorLog())), { status: 403, error: 'cloudflare_access_required' });
    assert.deepEqual(verifier.seen, []);
  });

  it('answers 403 cloudflare_access_invalid for a token that does not verify', async () => {
    assert.deepEqual(await refusalOf(admitCloudflareRequest({ ...PUBLIC, 'cf-access-jwt-assertion': 'x' }, access, fixedVerifier('invalid'), errorLog())), { status: 403, error: 'cloudflare_access_invalid' });
  });

  it('answers 503 cloudflare_access_unavailable when keys cannot be loaded, logging nothing of the token', async () => {
    for (const verdict of ['unavailable', new Error('boom eyJhbGciOi')] as const) {
      const log = errorLog();
      assert.deepEqual(await refusalOf(admitCloudflareRequest({ ...PUBLIC, 'cf-access-jwt-assertion': 'eyJhbGciOi.secret.sig' }, access, fixedVerifier(verdict), log)), { status: 503, error: 'cloudflare_access_unavailable' });
      assert.deepEqual(log.messages, ['Cloudflare Access verification unavailable']);
    }
  });

  it('admits a verified token as viewer', async () => {
    const verifier = fixedVerifier('valid');
    assert.deepEqual(await admitCloudflareRequest({ ...PUBLIC, 'cf-access-jwt-assertion': 'tok' }, access, verifier, errorLog()), { level: 'viewer' });
    assert.deepEqual(verifier.seen, ['tok']);
  });
});

describe('access level', () => {
  it('lets local do everything and a viewer only read', () => {
    for (const method of ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH']) assert.equal(allowsMethod('local', method), true);
    assert.equal(allowsMethod('viewer', 'GET'), true);
    assert.equal(allowsMethod('viewer', 'HEAD'), true);
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
      const refusal = admitMethod('viewer', method);
      assert.equal(refusal?.status, 403, method);
      assert.equal((JSON.parse(refusal?.body ?? '{}') as { error: string }).error, 'read_only_viewer');
    }
  });
});

describe('the whole entrance (Host/Origin → Access → level)', () => {
  const key = signingKey('kid-1');
  const deps = () => ({ access, verifier: createAccessTokenVerifier(ACCESS_CONFIG, fakeJwks([key]), manualClock()), onError: errorLog() });
  const viewer = (extra: Record<string, string> = {}) => ({ ...PUBLIC, 'cf-access-jwt-assertion': token(key), ...extra });

  it('refuses an unknown Host before looking at Access', async () => {
    const d = deps();
    assert.deepEqual(await refusalOf(admitRequest('GET', { host: 'evil.test', 'cf-access-jwt-assertion': token(key) }, d)), { status: 403, error: 'host_not_allowed' });
  });

  it('lets a verified viewer read pages, API and health, but not write', async () => {
    const d = deps();
    assert.deepEqual(await admitRequest('GET', viewer(), d), { level: 'viewer' });
    assert.deepEqual(await admitRequest('GET', viewer({ origin: 'https://br.example.test' }), d), { level: 'viewer' });
    for (const method of ['POST', 'PUT', 'DELETE']) {
      assert.deepEqual(await refusalOf(admitRequest(method, viewer({ origin: 'https://br.example.test' }), d)), { status: 403, error: 'read_only_viewer' });
    }
  });

  it('refuses an expired token and a sibling subdomain using the public Origin', async () => {
    const d = deps();
    const expired = token(key, claims({ exp: NOW_SEC - 1 }));
    assert.deepEqual(await refusalOf(admitRequest('GET', { ...PUBLIC, 'cf-access-jwt-assertion': expired }, d)), { status: 403, error: 'cloudflare_access_invalid' });
    assert.deepEqual(await refusalOf(admitRequest('GET', viewer({ host: 'other.example.test', origin: 'https://br.example.test' }), d)), { status: 403, error: 'origin_not_allowed' });
  });

  it('keeps loopback fully operable without Access configured', async () => {
    const d = { access, verifier: undefined, onError: errorLog() };
    assert.deepEqual(await admitRequest('POST', { host: '127.0.0.1:4370', origin: 'http://127.0.0.1:4370' }, d), { level: 'local' });
    assert.deepEqual(await refusalOf(admitRequest('GET', PUBLIC, d)), { status: 503, error: 'cloudflare_access_not_configured' });
  });
});
