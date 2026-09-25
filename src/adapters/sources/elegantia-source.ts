// @implements SPEC-br-architecture
import { extractElegantiaEvidence } from '../../inspections/extractors/elegantia.ts';
import type { Project } from '../../registry/domain/model.ts';
import type { SourceOutcome } from '../../snapshots/domain/model.ts';
import type { SourceAdapter } from '../../snapshots/ports.ts';
import { getJson, type HttpSourceOptions } from './http-json.ts';
import { failed, fromResult, notConnected } from './source-outcomes.ts';

/** Elegantia: `GET /api/overview?product=<bindings.elegantiaProduct>`. */
export function createElegantiaSource(options: HttpSourceOptions | undefined): SourceAdapter {
  return {
    id: 'elegantia',
    async fetch(project: Project): Promise<SourceOutcome> {
      if (!options) return notConnected('ELEGANTIA_URL (または BREVIARIUM_ELEGANTIA_URL) が未設定');
      const product = project.bindings.elegantiaProduct;
      if (!product) return notConnected('bindings.elegantiaProduct が未登録');
      try {
        const body = await getJson(options, `/api/overview?product=${encodeURIComponent(product)}`);
        return fromResult(extractElegantiaEvidence(product, body), `elegantia:${product}`);
      } catch (error) {
        return failed(error);
      }
    },
  };
}
