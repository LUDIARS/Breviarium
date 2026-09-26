// @implements SPEC-br-grading
import type { inspectLayerAssignment } from '../src/inspections/domain/anatomia-inspections.ts';
import type { ContractOf } from './contract-types.ts';

/** The fixed ratio thresholds, restated so the predicate does not reuse the rule it checks. */
function classOf(ratio: number): string {
  return ratio >= 0.9 ? 'A' : ratio >= 0.7 ? 'B' : ratio >= 0.5 ? 'C' : 'D';
}

/**
 * C-45: the class follows the layer-assigned symbol share; without `.anatomia/layers.json` it is measured
 * `—` (no layer definition), without a CLI result it is not measured, and no symbol at all is `—`.
 */
export default {
  post: (inspections, e) => {
    const [i, ...rest] = inspections;
    if (!i || rest.length > 0 || i.tool !== 'anatomia' || i.kind !== 'layer-assignment') return 'expected exactly the anatomia/layer-assignment inspection';
    if (!e) return i.status === 'not-measured' ? true : 'measured without a CLI result';
    if (e.layersDeclared === false) return i.status === 'measured' && i.grade === '—' ? true : 'graded the layer assignment without a layer definition';
    if (e.symbols.total === 0) return i.grade === '—' ? true : `graded ${i.grade} without symbols to count`;
    const expected = classOf(e.symbols.classified / e.symbols.total);
    return i.grade === expected ? true : `class ${i.grade} differs from the share class ${expected}`;
  },
} satisfies ContractOf<typeof inspectLayerAssignment>;
