// @implements SPEC-br-grading
import { latestOf } from '../../shared/time.ts';
import type { VoluptasEvidence } from '../domain/evidence.ts';

/** Files found under the bound Voluptas directory. Names are only used to count JSON files, never stored. */
export interface VoluptasRaw {
  readonly exists: boolean;
  readonly files: readonly { readonly name: string; readonly modifiedAt: string }[];
  readonly truncated: boolean;
}

export function extractVoluptasEvidence(raw: VoluptasRaw): VoluptasEvidence {
  const json = raw.files.filter((f) => f.name.toLowerCase().endsWith('.json'));
  return {
    exists: raw.exists,
    jsonFileCount: json.length,
    latestModifiedAt: latestOf(json.map((f) => f.modifiedAt)),
    truncated: raw.truncated,
  };
}
