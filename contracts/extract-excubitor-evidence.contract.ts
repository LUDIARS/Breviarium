// @implements SPEC-br-workflow
import type { extractExcubitorEvidence } from '../src/inspections/extractors/excubitor.ts';
import type { ContractOf } from './contract-types.ts';

const KEPT_KEYS = 'autostart,found,service,state';

/**
 * C-42: the evidence keeps whether the service is in Excubitor's catalog, its state and autostart only
 * (no host, pid, port or catalog), and an answer without a services array is an excubitor_shape failure.
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
    return result.value.service === service ? true : 'the evidence names another service';
  },
} satisfies ContractOf<typeof extractExcubitorEvidence>;
