// @implements SPEC-br-web-entrance
import type { WebAccess } from '../config/web-access.ts';
import type { Admission } from './access-level.ts';
import type { AccessTokenVerifier, AccessVerdict } from './cloudflare-access-verifier.ts';
import { jsonResponse } from './responses.ts';

type Headers = Readonly<Record<string, string | undefined>>;

function isForwardingHeader(name: string): boolean {
  return name.startsWith('cf-') || name.startsWith('x-forwarded-') || name === 'forwarded';
}

/**
 * Only a request to the service's own loopback authority without any forwarding header is
 * local. Forwarding headers can only demand Access, never grant an exemption: a tunnel that
 * rewrites Host to 127.0.0.1 still carries `cf-*` headers.
 */
export function requiresCloudflareAccess(headers: Headers, access: WebAccess): boolean {
  if (Object.keys(headers).some(isForwardingHeader)) return true;
  const host = headers['host']?.toLowerCase();
  return host === undefined || !access.localAuthorities.has(host);
}

const refuse = (status: number, error: string): Admission => ({ refusal: jsonResponse(status, { error }) });

/**
 * Access admission, run after Host/Origin and before the body or any route (pages, API and
 * health alike). There is no mode that opens a non-local request without a verified JWT.
 */
export async function admitCloudflareRequest(
  headers: Headers,
  access: WebAccess,
  verifier: AccessTokenVerifier | undefined,
  onError: (error: unknown) => void,
): Promise<Admission> {
  if (!requiresCloudflareAccess(headers, access)) return { level: 'local' };
  if (!verifier) return refuse(503, 'cloudflare_access_not_configured');
  const token = headers['cf-access-jwt-assertion'];
  if (!token) return refuse(403, 'cloudflare_access_required');
  let verdict: AccessVerdict;
  try {
    verdict = await verifier.verify(token);
  } catch {
    verdict = 'unavailable';
  }
  if (verdict === 'valid') return { level: 'viewer' };
  if (verdict === 'invalid') return refuse(403, 'cloudflare_access_invalid');
  // Never log the token or verifier errors: they may carry decoded claims.
  onError(new Error('Cloudflare Access verification unavailable'));
  return refuse(503, 'cloudflare_access_unavailable');
}
