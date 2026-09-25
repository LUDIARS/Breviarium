// @implements SPEC-br-grading
import { latestOf } from '../../shared/time.ts';
import type { AnatomiaEvidence, DomainDeclarationFact } from '../domain/evidence.ts';
import { asArray, asRecord, parseJson, str } from './json-shape.ts';

export interface TextFileRaw {
  /** Repository-relative path. */
  readonly path: string;
  readonly text: string;
  readonly modifiedAt: string;
}

/** Raw Anatomia artefacts in the repository: domain declarations and the generated manifest. */
export interface AnatomiaRaw {
  readonly declarations: readonly TextFileRaw[];
  readonly manifest: TextFileRaw | null;
}

function declarationOf(file: TextFileRaw): DomainDeclarationFact {
  const doc = asRecord(parseJson(file.text));
  if (!doc) return { path: file.path, name: null, parsed: false, membershipCount: 0, modifiedAt: file.modifiedAt };
  return { path: file.path, name: str(doc['name']), parsed: true, membershipCount: asArray(doc['membership']).length, modifiedAt: file.modifiedAt };
}

export function extractAnatomiaEvidence(raw: AnatomiaRaw): AnatomiaEvidence {
  const declarations = [...raw.declarations].sort((a, b) => a.path.localeCompare(b.path)).map(declarationOf);
  const manifestDoc = raw.manifest ? asRecord(parseJson(raw.manifest.text)) : null;
  return {
    declarations,
    declaredCount: declarations.length,
    unparsableCount: declarations.filter((d) => !d.parsed).length,
    membershipTotal: declarations.reduce((sum, d) => sum + d.membershipCount, 0),
    latestDeclarationAt: latestOf(declarations.map((d) => d.modifiedAt)),
    manifest: raw.manifest
      ? { path: raw.manifest.path, modifiedAt: raw.manifest.modifiedAt, sourceRevision: str(manifestDoc?.['sourceRevision']) }
      : null,
  };
}
