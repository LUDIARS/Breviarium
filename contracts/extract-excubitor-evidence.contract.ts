// @implements SPEC-br-workflow
import type { extractExcubitorEvidence } from '../src/inspections/extractors/excubitor.ts';
import type { ContractOf } from './contract-types.ts';

const KEPT_KEYS = 'autostart,envConfig,found,service,serviceCodes,state';
const ENV_CONFIG_KEYS = 'missingCount,ready';

/**
 * C-42: the evidence keeps whether the service is in Excubitor's catalog, its state and autostart, the catalog's
 * service codes and the env-config readiness as a count (no host, pid, port, catalog entry or env key / value),
 * and an answer without a services array is an excubitor_shape failure.
 */
export default {
  post: (result, service, body) => {
    const doc = body !== null && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
    if (!Array.isArray(doc?.['services'])) {
      if (result.ok) return 'accepted an answer without a services array';
      return result.error.code === 'excubitor_shape' ? true : `failed with ${result.error.code}`;
    }
    if (!result.ok) return 'refused an answer with a services array';
    const keys = Object.keys(result.value).sort().join(',');
    if (keys !== KEPT_KEYS) return `the evidence keeps ${keys}`;
    if (result.value.serviceCodes.some((code) => typeof code !== 'string')) return 'a service code is not a string';
    const env = result.value.envConfig;
    if (env && Object.keys(env).sort().join(',') !== ENV_CONFIG_KEYS) return `the env-config keeps ${Object.keys(env).join(',')}`;
    if (env && typeof env.ready !== 'boolean') return 'env-config readiness is not a boolean';
    if (env && (!Number.isInteger(env.missingCount) || env.missingCount < 0)) return 'env-config missing count is invalid';
    if (env && !result.value.found) return 'env-config kept for a service that is not in the catalog';
    return result.value.service === service ? true : 'the evidence names another service';
  },
} satisfies ContractOf<typeof extractExcubitorEvidence>;
