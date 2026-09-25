// @implements SPEC-br-web-entrance
import type { CloudflareAccessConfig } from '../config/cloudflare-access-config.ts';

/**
 * Claims an Access application token must carry: the configured team as `iss`, Breviarium's
 * AUD in `aud` (string or list), an `exp` in the future and, when present, an `nbf` in the
 * past. Identity claims (email and so on) are not read; Access policy decides who gets a token.
 */
export function acceptsClaims(payload: Readonly<Record<string, unknown>>, config: CloudflareAccessConfig, nowMs: number): boolean {
  const now = Math.floor(nowMs / 1000);
  const aud = payload['aud'];
  const audiences: readonly unknown[] = Array.isArray(aud) ? aud : [aud];
  const exp = payload['exp'];
  const nbf = payload['nbf'];
  return (
    payload['iss'] === config.issuer &&
    audiences.includes(config.audience) &&
    typeof exp === 'number' &&
    exp > now &&
    (nbf === undefined || (typeof nbf === 'number' && nbf <= now))
  );
}
