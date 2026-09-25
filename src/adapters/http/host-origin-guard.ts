// @implements SPEC-br-web-ui
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
 * Admission check run before routing. Unknown Host is refused (DNS rebinding); an Origin,
 * when the browser sends one (POST, module scripts, fetch), must be in the exact set.
 * Returns the refusal, or undefined when the request may proceed.
 */
export function admitWebRequest(headers: Readonly<Record<string, string | undefined>>, access: WebAccess): HttpResponse | undefined {
  if (!matchesHost(headers['host'], access.hosts)) return jsonResponse(403, { error: 'host_not_allowed' });
  const origin = headers['origin'];
  if (origin !== undefined && !access.origins.has(origin)) return jsonResponse(403, { error: 'origin_not_allowed' });
  return undefined;
}
