// @implements SPEC-br-web-ui
// @implements SPEC-br-web-entrance
import type { admitWebRequest } from '../src/adapters/http/host-origin-guard.ts';
import { matchesHost } from '../src/adapters/http/host-origin-guard.ts';
import type { ContractOf } from './contract-types.ts';

/**
 * C-12: a request passes only with an allowed Host and, when present, an Origin in the exact
 * set, or the public origin sent to that origin's own Host (never a sibling Host).
 */
export default {
  post: (refusal, headers, access) => {
    const host = headers['host'];
    const hostOk = matchesHost(host, access.hosts);
    const origin = headers['origin'];
    const ownPublicOrigin = origin !== undefined && origin === access.publicOrigin && host?.toLowerCase() === new URL(origin).host;
    const originOk = origin === undefined || access.origins.has(origin) || ownPublicOrigin;
    if (refusal === undefined) return hostOk && originOk ? true : 'admitted a request with an unknown Host or Origin';
    if (refusal.status !== 403) return 'refusal is not 403';
    return hostOk && originOk ? 'refused a request with an allowed Host and Origin' : true;
  },
} satisfies ContractOf<typeof admitWebRequest>;
