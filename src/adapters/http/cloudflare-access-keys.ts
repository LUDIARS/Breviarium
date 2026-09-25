// @implements SPEC-br-web-entrance
import type { JsonWebKey } from 'node:crypto';
import type { CloudflareAccessConfig } from '../config/cloudflare-access-config.ts';
import { type FetchLike, getJson } from '../sources/http-json.ts';

/** Fetches the team's JWKS document. Bound to one URL when created; never takes one from a token. */
export type JwksFetcher = () => Promise<unknown>;

export const JWKS_PATH = '/cdn-cgi/access/certs';
export const JWKS_TIMEOUT_MS = 5_000;
export const KEY_TTL_MS = 10 * 60_000;
export const UNKNOWN_KID_RETRY_MS = 60_000;

/**
 * The only key source: the configured team's `/cdn-cgi/access/certs` (a JWT's `jku` or `iss`
 * is never used as a URL). 5 s timeout; errors name the path only, never the host.
 */
export function createJwksFetcher(config: CloudflareAccessConfig, fetchImpl: FetchLike): JwksFetcher {
  const options = { baseUrl: config.issuer, fetchImpl, timeoutMs: JWKS_TIMEOUT_MS };
  return () => getJson(options, JWKS_PATH);
}

export type KeyLookup =
  | { readonly kind: 'found'; readonly key: JsonWebKey }
  /** The key set loaded fine but has no such `kid`: the token is not from this team. */
  | { readonly kind: 'unknown' }
  /** The key set could not be loaded, so the token cannot be judged either way. */
  | { readonly kind: 'unavailable' };

function rsaKeys(body: unknown): Map<string, JsonWebKey> {
  const keys = new Map<string, JsonWebKey>();
  const list = typeof body === 'object' && body !== null && 'keys' in body && Array.isArray(body.keys) ? (body.keys as unknown[]) : [];
  for (const entry of list) {
    if (typeof entry !== 'object' || entry === null) continue;
    const jwk = entry as JsonWebKey;
    if (typeof jwk['kid'] === 'string' && jwk.kty === 'RSA') keys.set(jwk['kid'], jwk);
  }
  return keys;
}

/**
 * Cached Access signing keys (Elegantia `cf-access.ts` policy): reload after 10 minutes,
 * and at most once a minute for an unknown `kid` (key rotation). Concurrent lookups share
 * one fetch. A failed load (or one without any RSA key) keeps the previous keys.
 */
export class AccessKeyCache {
  private readonly fetchJwks: JwksFetcher;
  private readonly now: () => number;
  private keys = new Map<string, JsonWebKey>();
  private fetchedAt = Number.NEGATIVE_INFINITY;
  private lastLoadFailed = false;
  private inflight: Promise<void> | undefined;

  constructor(fetchJwks: JwksFetcher, now: () => number) {
    this.fetchJwks = fetchJwks;
    this.now = now;
  }

  async lookup(kid: string): Promise<KeyLookup> {
    if (this.keys.size === 0 || this.now() - this.fetchedAt > KEY_TTL_MS) await this.refresh();
    if (!this.keys.has(kid) && this.now() - this.fetchedAt > UNKNOWN_KID_RETRY_MS) await this.refresh();
    const key = this.keys.get(kid);
    if (key) return { kind: 'found', key };
    return this.lastLoadFailed ? { kind: 'unavailable' } : { kind: 'unknown' };
  }

  private refresh(): Promise<void> {
    this.inflight ??= this.load().finally(() => {
      this.inflight = undefined;
    });
    return this.inflight;
  }

  private async load(): Promise<void> {
    let loaded: Map<string, JsonWebKey>;
    try {
      loaded = rsaKeys(await this.fetchJwks());
    } catch {
      loaded = new Map();
    }
    this.fetchedAt = this.now();
    this.lastLoadFailed = loaded.size === 0;
    if (loaded.size > 0) this.keys = loaded;
  }
}
