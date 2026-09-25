// @implements SPEC-br-web-ui
import type { admitWebRequest } from '../src/adapters/http/host-origin-guard.ts';
import { matchesHost } from '../src/adapters/http/host-origin-guard.ts';
import type { ContractOf } from './contract-types.ts';

/** C-12: a request passes only with an allowed Host and, when present, an Origin in the exact set. */
export default {
  post: (refusal, headers, access) => {
    const hostOk = matchesHost(headers['host'], access.hosts);
    const origin = headers['origin'];
    const originOk = origin === undefined || access.origins.has(origin);
    if (refusal === undefined) return hostOk && originOk ? true : 'admitted a request with an unknown Host or Origin';
    if (refusal.status !== 403) return 'refusal is not 403';
    return hostOk && originOk ? 'refused a request with an allowed Host and Origin' : true;
  },
} satisfies ContractOf<typeof admitWebRequest>;
