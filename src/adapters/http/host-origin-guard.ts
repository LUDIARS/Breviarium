// @implements SPEC-br-web-ui
// @implements SPEC-br-web-entrance
import type { WebAccess } from '../config/web-access.ts';
import type { HttpResponse } from './http-types.ts';
import { jsonResponse } from './responses.ts';

/**
 * Host match: exact `host:port`, a bare hostname on any port, or a leading-dot entry for
 * the domain and its subdomains (`.example.test` never matches `badexample.test`).
 */
export function matchesHost(host: string | undefined, allowed: ReadonlySet<string>): boolean {
  if (!host || /[\s,/@\\?#%]/.test(host)) return false;
  let url: URL;
  try {
    url = new URL(`http://${host}`);
  } catch {
    return false;
  }
  const authority = host.toLowerCase();
  for (const entry of allowed) {
    if (entry.startsWith('.')) {
      if (url.hostname === entry.slice(1) || url.hostname.endsWith(entry)) return true;
    } else if (authority === entry || (!entry.includes(':') && url.hostname === entry)) {
      return true;
    }
  }
  return false;
}

/**
 * The public HTTPS origin counts only for a request whose Host is that origin's own
 * authority, so a sibling subdomain admitted by a Host wildcard cannot write with it.
 */
export function isPublicOriginFor(origin: string, host: string | undefined, access: WebAccess): boolean {
  return access.publicOrigin !== undefined && origin === access.publicOrigin && host?.toLowerCase() === new URL(origin).host;
}

/**
 * Admission check run before routing. Unknown Host is refused (DNS rebinding); an Origin,
 * when the browser sends one (POST, module scripts, fetch), must be in the exact set or be
 * the public origin of the same Host. Cloudflare Access is a separate gate that follows.
 * Returns the refusal, or undefined when the request may proceed.
 */
export function admitWebRequest(headers: Readonly<Record<string, string | undefined>>, access: WebAccess): HttpResponse | undefined {
  const host = headers['host'];
  if (!matchesHost(host, access.hosts)) return jsonResponse(403, { error: 'host_not_allowed' });
  const origin = headers['origin'];
  if (origin !== undefined && !access.origins.has(origin) && !isPublicOriginFor(origin, host, access)) return jsonResponse(403, { error: 'origin_not_allowed' });
  return undefined;
}
