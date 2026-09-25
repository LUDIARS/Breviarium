import { generateKeyPairSync, type JsonWebKey, type KeyObject, sign } from 'node:crypto';
import type { CloudflareAccessConfig } from '../../src/adapters/config/cloudflare-access-config.ts';
import type { JwksFetcher } from '../../src/adapters/http/cloudflare-access-keys.ts';

export const TEAM = 'ludiars-test.cloudflareaccess.com';
export const AUD = 'a'.repeat(64);
export const ACCESS_CONFIG: CloudflareAccessConfig = { issuer: `https://${TEAM}`, audience: AUD };
/** Fixed clock for token tests: 2026-09-26T00:00:00Z. */
export const NOW_MS = Date.parse('2026-09-26T00:00:00.000Z');
export const NOW_SEC = NOW_MS / 1000;

export interface SigningKey {
  readonly kid: string;
  readonly privateKey: KeyObject;
  readonly jwk: JsonWebKey;
}

/** A fresh RSA key pair generated inside the test (no key material is checked in). */
export function signingKey(kid: string): SigningKey {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { kid, privateKey, jwk: { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' } };
}

const segment = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');

/** Valid Access claims for ACCESS_CONFIG at NOW; override or delete (`undefined`) any claim. */
export function claims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const base: Record<string, unknown> = { iss: ACCESS_CONFIG.issuer, aud: [AUD], exp: NOW_SEC + 600, iat: NOW_SEC - 60, nbf: NOW_SEC - 60, email: 'viewer@example.test', sub: 'user-1' };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete base[key];
    else base[key] = value;
  }
  return base;
}

/** Signs `payload` with RS256 (or writes the given header as-is, for malformed-header cases). */
export function token(key: SigningKey, payload: Record<string, unknown> = claims(), header: Record<string, unknown> = { alg: 'RS256', kid: key.kid, typ: 'JWT' }): string {
  const signingInput = `${segment(header)}.${segment(payload)}`;
  return `${signingInput}.${sign('RSA-SHA256', Buffer.from(signingInput), key.privateKey).toString('base64url')}`;
}

/** In-memory JWKS endpoint: serves `keys`, or fails while `failing` is set. Counts calls. */
export function fakeJwks(keys: readonly SigningKey[]): JwksFetcher & { calls: number; failing: boolean; keys: SigningKey[] } {
  const fetcher = Object.assign(
    async () => {
      fetcher.calls += 1;
      if (fetcher.failing) throw new Error('JWKS unreachable');
      return { keys: fetcher.keys.map((k) => k.jwk) };
    },
    { calls: 0, failing: false, keys: [...keys] },
  );
  return fetcher;
}

/** A clock the test moves by hand. */
export function manualClock(start = NOW_MS): (() => number) & { advance(ms: number): void } {
  let current = start;
  return Object.assign(() => current, { advance: (ms: number) => void (current += ms) });
}
