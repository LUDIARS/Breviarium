// @implements SPEC-br-architecture
import type { loadConfig } from '../src/adapters/config/load-config.ts';
import type { ContractOf } from './contract-types.ts';

/**
 * C-14: only a loopback host is accepted, the periodic refresh is off unless explicitly set (current or
 * former env name), and the Anatomia CLI timeout is 120000 ms unless set, never outside 1000..600000 ms.
 */
export default {
  post: (config, env) => {
    if (!['127.0.0.1', '::1', 'localhost'].includes(config.host)) return 'accepted a non-loopback host';
    const set = ['BREVIARIUM_REFRESH_INTERVAL_SEC', 'BR_REFRESH_INTERVAL_SEC'].some((key) => env[key]?.trim());
    if (!set && config.refreshIntervalSec !== 0) return 'periodic refresh is on by default';
    if (!env['BREVIARIUM_ANATOMIA_CLI_TIMEOUT_MS']?.trim() && config.anatomiaCliTimeoutMs !== 120_000) return 'the Anatomia CLI timeout is not 120000 ms by default';
    if (config.anatomiaCliTimeoutMs < 1000 || config.anatomiaCliTimeoutMs > 600_000) return 'the Anatomia CLI timeout is outside 1000..600000 ms';
    return true;
  },
} satisfies ContractOf<typeof loadConfig>;
