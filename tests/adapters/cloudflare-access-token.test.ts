import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { acceptsClaims } from '../../src/adapters/http/cloudflare-access-claims.ts';
import { decodeJwt, verifyRs256 } from '../../src/adapters/http/cloudflare-access-jwt.ts';
import { createJwksFetcher, KEY_TTL_MS, UNKNOWN_KID_RETRY_MS } from '../../src/adapters/http/cloudflare-access-keys.ts';
import { createAccessTokenVerifier, MAX_ASSERTION_LENGTH } from '../../src/adapters/http/cloudflare-access-verifier.ts';
import type { FetchLike } from '../../src/adapters/sources/http-json.ts';
import { ACCESS_CONFIG, AUD, claims, fakeJwks, manualClock, NOW_MS, NOW_SEC, signingKey, token } from '../support/access-tokens.ts';

const key1 = signingKey('kid-1');
const key2 = signingKey('kid-2');
const stranger = signingKey('kid-1');

/** Outlives every clock advance below, so only the key cache decides the verdict. */
const longLived = (key = key1) => token(key, claims({ exp: NOW_SEC + 86_400 }));

function verifierWith(keys = [key1], now = manualClock()) {
  const jwks = fakeJwks(keys);
  return { verifier: createAccessTokenVerifier(ACCESS_CONFIG, jwks, now), jwks, now };
}

describe('JWT decoding and RS256', () => {
  it('splits a compact token and checks its signature against the right key only', () => {
    const parts = decodeJwt(token(key1));
    assert.ok(parts);
    assert.equal(parts.header['kid'], 'kid-1');
    assert.equal(verifyRs256(parts, key1.jwk), true);
    assert.equal(verifyRs256(parts, stranger.jwk), false);
    assert.equal(verifyRs256({ ...parts, header: { ...parts.header, alg: 'HS256' } }, key1.jwk), false);
  });

  it('never throws on malformed input', () => {
    for (const bad of ['', 'a.b', 'a.b.c.d', 'a.b.', '!!.b.c', `${Buffer.from('[1]').toString('base64url')}.e30.c`, `${Buffer.from('{').toString('base64url')}.e30.c`]) {
      assert.equal(decodeJwt(bad), undefined, bad);
    }
  });
});

describe('Access claims', () => {
  it('accepts the configured issuer and audience before expiry', () => {
    assert.equal(acceptsClaims(claims(), ACCESS_CONFIG, NOW_MS), true);
    assert.equal(acceptsClaims(claims({ aud: AUD }), ACCESS_CONFIG, NOW_MS), true);
    assert.equal(acceptsClaims(claims({ nbf: undefined }), ACCESS_CONFIG, NOW_MS), true);
  });

  it('refuses another issuer, another audience, expiry, a future nbf and missing exp', () => {
    for (const bad of [
      claims({ iss: 'https://other.cloudflareaccess.com' }),
      claims({ iss: undefined }),
      claims({ aud: ['c'.repeat(64)] }),
      claims({ aud: undefined }),
      claims({ exp: NOW_SEC }),
      claims({ exp: String(NOW_SEC + 600) }),
      claims({ exp: undefined }),
      claims({ nbf: NOW_SEC + 60 }),
      claims({ nbf: 'soon' }),
    ]) {
      assert.equal(acceptsClaims(bad, ACCESS_CONFIG, NOW_MS), false, JSON.stringify(bad));
    }
  });
});

describe('Access token verifier', () => {
  it('accepts a token signed by a key from the team JWKS', async () => {
    const { verifier } = verifierWith();
    assert.equal(await verifier.verify(token(key1)), 'valid');
  });

  it('rejects wrong signatures, algorithms, claims and oversized tokens as invalid', async () => {
    const { verifier } = verifierWith();
    const good = token(key1);
    const [head, body] = good.split('.') as [string, string];
    const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', kid: 'kid-1' })).toString('base64url');
    for (const bad of [
      token(stranger),
      `${head}.${body}.${'A'.repeat(342)}`,
      `${noneHeader}.${body}.x`,
      token(key1, claims(), { alg: 'HS256', kid: 'kid-1' }),
      token(key1, claims(), { alg: 'RS256' }),
      token(key1, claims(), { alg: 'RS256', kid: 'kid-1', crit: ['exp'] }),
      token(key1, claims({ aud: ['c'.repeat(64)] })),
      token(key1, claims({ iss: 'https://other.cloudflareaccess.com' })),
      token(key1, claims({ exp: NOW_SEC - 1 })),
      'not-a-jwt',
      'x'.repeat(MAX_ASSERTION_LENGTH + 1),
    ]) {
      assert.equal(await verifier.verify(bad), 'invalid', bad.slice(0, 40));
    }
  });

  it('never fetches keys from a jku or iss inside the token', async () => {
    const urls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      urls.push(url);
      return new Response(JSON.stringify({ keys: [key1.jwk] }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const verifier = createAccessTokenVerifier(ACCESS_CONFIG, createJwksFetcher(ACCESS_CONFIG, fetchImpl), () => NOW_MS);
    const hostile = token(key1, claims({ iss: 'https://evil.cloudflareaccess.com' }), { alg: 'RS256', kid: 'kid-9', jku: 'https://evil.test/keys' });
    assert.equal(await verifier.verify(hostile), 'invalid');
    assert.equal(await verifier.verify(token(key1)), 'valid');
    assert.ok(urls.length >= 1);
    for (const url of urls) assert.equal(url, 'https://ludiars-test.cloudflareaccess.com/cdn-cgi/access/certs');
  });

  it('reports unavailable when the JWKS cannot be fetched, and recovers once it can', async () => {
    const { verifier, jwks } = verifierWith();
    jwks.failing = true;
    assert.equal(await verifier.verify(token(key1)), 'unavailable');
    jwks.failing = false;
    assert.equal(await verifier.verify(token(key1)), 'valid');
  });

  it('treats a JWKS without any RSA key as unavailable, not as a wrong token', async () => {
    const { verifier, jwks } = verifierWith([]);
    assert.equal(await verifier.verify(token(key1)), 'unavailable');
    assert.equal(jwks.calls, 1);
  });

  it('caches keys for 10 minutes and shares one fetch between concurrent requests', async () => {
    const { verifier, jwks, now } = verifierWith();
    const results = await Promise.all([verifier.verify(longLived()), verifier.verify(longLived()), verifier.verify(longLived())]);
    assert.deepEqual(results, ['valid', 'valid', 'valid']);
    assert.equal(jwks.calls, 1);
    now.advance(KEY_TTL_MS - 1);
    await verifier.verify(longLived());
    assert.equal(jwks.calls, 1);
    now.advance(2);
    await verifier.verify(longLived());
    assert.equal(jwks.calls, 2);
  });

  it('refetches for an unknown kid at most once a minute (key rotation)', async () => {
    const { verifier, jwks, now } = verifierWith([key1]);
    assert.equal(await verifier.verify(longLived()), 'valid');
    jwks.keys = [key1, key2];
    assert.equal(await verifier.verify(longLived(key2)), 'invalid');
    assert.equal(jwks.calls, 1);
    now.advance(UNKNOWN_KID_RETRY_MS + 1);
    assert.equal(await verifier.verify(longLived(key2)), 'valid');
    assert.equal(jwks.calls, 2);
  });

  it('keeps the known keys when a reload fails, but cannot judge an unknown kid then', async () => {
    const { verifier, jwks, now } = verifierWith([key1]);
    assert.equal(await verifier.verify(longLived()), 'valid');
    jwks.failing = true;
    now.advance(KEY_TTL_MS + 1);
    assert.equal(await verifier.verify(longLived()), 'valid');
    now.advance(UNKNOWN_KID_RETRY_MS + 1);
    assert.equal(await verifier.verify(longLived(key2)), 'unavailable');
  });
});
