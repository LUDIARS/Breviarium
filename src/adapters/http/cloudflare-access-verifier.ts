// @implements SPEC-br-web-entrance
import type { CloudflareAccessConfig } from '../config/cloudflare-access-config.ts';
import { acceptsClaims } from './cloudflare-access-claims.ts';
import { decodeJwt, verifyRs256 } from './cloudflare-access-jwt.ts';
import { AccessKeyCache, type JwksFetcher } from './cloudflare-access-keys.ts';

/** `invalid` → 403 (the token is wrong); `unavailable` → 503 (the keys could not be loaded). */
export type AccessVerdict = 'valid' | 'invalid' | 'unavailable';

export interface AccessTokenVerifier {
  verify(token: string): Promise<AccessVerdict>;
}

export const MAX_ASSERTION_LENGTH = 16_384;

/**
 * Verifies a `Cf-Access-Jwt-Assertion`: RS256 only, signed by a key of the configured team,
 * then `iss` / `aud` / `exp` (+ `nbf`). The token and its claims are never logged or returned.
 */
export function createAccessTokenVerifier(config: CloudflareAccessConfig, fetchJwks: JwksFetcher, now: () => number = Date.now): AccessTokenVerifier {
  const keys = new AccessKeyCache(fetchJwks, now);
  return {
    async verify(token) {
      if (token.length > MAX_ASSERTION_LENGTH) return 'invalid';
      const parts = decodeJwt(token);
      const kid = parts?.header['kid'];
      if (!parts || parts.header['alg'] !== 'RS256' || parts.header['crit'] !== undefined || typeof kid !== 'string') return 'invalid';
      const lookup = await keys.lookup(kid);
      if (lookup.kind === 'unavailable') return 'unavailable';
      if (lookup.kind === 'unknown' || !verifyRs256(parts, lookup.key)) return 'invalid';
      return acceptsClaims(parts.payload, config, now()) ? 'valid' : 'invalid';
    },
  };
}
