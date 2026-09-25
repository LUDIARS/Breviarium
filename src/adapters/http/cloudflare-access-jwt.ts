// @implements SPEC-br-web-entrance
import { createPublicKey, type JsonWebKey, verify } from 'node:crypto';

/**
 * Compact JWS handling with node:crypto only (Breviarium has no runtime dependencies;
 * same approach as Elegantia `cf-jwt.ts`). Nothing here trusts a claim: decoding only
 * splits the token, and the signature check is against a key the caller chose.
 */
export interface JwtParts {
  readonly header: Readonly<Record<string, unknown>>;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly signingInput: string;
  readonly signature: Buffer;
}

const SEGMENT = /^[A-Za-z0-9_-]+$/;

function decodeObject(segment: string): Record<string, unknown> | undefined {
  const parsed: unknown = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined;
}

/** Splits `header.payload.signature`; anything malformed is undefined, never an exception. */
export function decodeJwt(token: string): JwtParts | undefined {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !SEGMENT.test(part))) return undefined;
  const [head, body, signature] = parts as [string, string, string];
  try {
    const header = decodeObject(head);
    const payload = decodeObject(body);
    if (!header || !payload) return undefined;
    return { header, payload, signingInput: `${head}.${body}`, signature: Buffer.from(signature, 'base64url') };
  } catch {
    return undefined;
  }
}

/** RS256 signature check against one RSA JWK. Any key or algorithm mismatch is `false`. */
export function verifyRs256(parts: JwtParts, jwk: JsonWebKey): boolean {
  if (parts.header['alg'] !== 'RS256' || jwk.kty !== 'RSA') return false;
  try {
    return verify('RSA-SHA256', Buffer.from(parts.signingInput, 'utf8'), createPublicKey({ key: jwk, format: 'jwk' }), parts.signature);
  } catch {
    return false;
  }
}
