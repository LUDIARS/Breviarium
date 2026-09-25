// @implements SPEC-br-web-entrance
import type { admitCloudflareRequest } from '../src/adapters/http/cloudflare-access-guard.ts';
import type { ContractOf } from './contract-types.ts';

function errorCode(body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    return typeof parsed === 'object' && parsed !== null && 'error' in parsed && typeof parsed.error === 'string' ? parsed.error : '';
  } catch {
    return '';
  }
}

/**
 * C-19: only the own loopback authority without forwarding headers is local; every other
 * request is a viewer only with a token the configured verifier accepted, and otherwise gets
 * 503 not_configured / 403 required / 403 invalid / 503 unavailable.
 */
export default {
  post: (admission, headers, access, verifier) => {
    const forwarded = Object.keys(headers).some((name) => name.startsWith('cf-') || name.startsWith('x-forwarded-') || name === 'forwarded');
    const host = headers['host']?.toLowerCase();
    const local = !forwarded && host !== undefined && access.localAuthorities.has(host);
    const token = headers['cf-access-jwt-assertion'];
    if (local) return 'level' in admission && admission.level === 'local' ? true : 'refused or downgraded a local request';
    if ('level' in admission) {
      if (admission.level !== 'viewer') return 'granted local to a forwarded or public request';
      return verifier !== undefined && Boolean(token) ? true : 'admitted a public request without a verified Access token';
    }
    const status = admission.refusal.status;
    const error = errorCode(admission.refusal.body);
    if (verifier === undefined) return status === 503 && error === 'cloudflare_access_not_configured' ? true : 'unconfigured Access did not answer 503';
    if (!token) return status === 403 && error === 'cloudflare_access_required' ? true : 'missing token did not answer 403 required';
    const known = (status === 403 && error === 'cloudflare_access_invalid') || (status === 503 && error === 'cloudflare_access_unavailable');
    return known ? true : 'unexpected Access refusal';
  },
} satisfies ContractOf<typeof admitCloudflareRequest>;
