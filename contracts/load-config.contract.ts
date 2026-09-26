// @implements SPEC-br-architecture
import type { loadConfig } from '../src/adapters/config/load-config.ts';
import type { ContractOf } from './contract-types.ts';

/** C-14: only a loopback host is accepted, and the periodic refresh is off unless explicitly set (current or former env name). */
export default {
  post: (config, env) => {
    if (!['127.0.0.1', '::1', 'localhost'].includes(config.host)) return 'accepted a non-loopback host';
    const set = ['BREVIARIUM_REFRESH_INTERVAL_SEC', 'BR_REFRESH_INTERVAL_SEC'].some((key) => env[key]?.trim());
    if (!set && config.refreshIntervalSec !== 0) return 'periodic refresh is on by default';
    return true;
  },
} satisfies ContractOf<typeof loadConfig>;
