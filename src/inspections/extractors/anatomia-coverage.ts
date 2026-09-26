// @implements SPEC-br-grading
import { fail, ok, type Result } from '../../shared/result.ts';
import type { AnatomiaCoverageEvidence } from '../domain/evidence.ts';
import { asRecord, bool, nonNegative, num, str } from './json-shape.ts';

/** A module is classified when Anatomia put it in a declared layer (`layer` is a non-empty name). */
function isClassified(module: Record<string, unknown>): boolean {
  return (str(module['layer']) ?? '').trim() !== '';
}

/**
 * Normalises `anatomia domains program --project <id> --json` into counts: modules and symbols
 * in total and classified into a declared domain layer. The output's file lists, module ids and
 * repository path are dropped here, so nothing but numbers reaches the snapshot.
 */
export function extractAnatomiaCoverageEvidence(project: string, body: unknown): Result<AnatomiaCoverageEvidence> {
  const doc = asRecord(body);
  const modules = doc?.['modules'];
  if (!doc || !Array.isArray(modules)) return fail('anatomia_shape', 'domains program の出力に modules (配列) がない');
  const tally = { modules: 0, classifiedModules: 0, symbols: 0, classifiedSymbols: 0 };
  for (const raw of modules) {
    const module = asRecord(raw);
    if (!module) continue;
    const symbols = nonNegative(module['symbolCount']);
    tally.modules++;
    tally.symbols += symbols;
    if (isClassified(module)) {
      tally.classifiedModules++;
      tally.classifiedSymbols += symbols;
    }
  }
  const domainCount = num(asRecord(doc['totals'])?.['domains']);
  return ok({
    project,
    layersDeclared: bool(doc['configPresent']),
    modules: { total: tally.modules, classified: tally.classifiedModules },
    symbols: { total: tally.symbols, classified: tally.classifiedSymbols },
    domainCount: domainCount === null ? null : Math.max(0, domainCount),
  });
}
