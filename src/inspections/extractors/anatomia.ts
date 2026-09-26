// @implements SPEC-br-grading
import { latestOf } from '../../shared/time.ts';
import type { AnatomiaEvidence, DomainDeclarationFact } from '../domain/evidence.ts';
import { type DomainPathPatterns, membershipCoverage } from '../domain/membership-coverage.ts';
import { asArray, asRecord, parseJson, str } from './json-shape.ts';

export interface TextFileRaw {
  /** Repository-relative path. */
  readonly path: string;
  readonly text: string;
  readonly modifiedAt: string;
}

/**
 * Raw Anatomia artefacts in the repository: domain declarations, the generated manifest, and the
 * repository-relative paths in the git index (`git ls-files`), which are reduced to counts here.
 */
export interface AnatomiaRaw {
  readonly declarations: readonly TextFileRaw[];
  readonly manifest: TextFileRaw | null;
  readonly trackedFiles: readonly string[];
}

interface ParsedDeclaration {
  readonly fact: DomainDeclarationFact;
  /** null when the declaration could not be parsed (it declares nothing). */
  readonly membership: DomainPathPatterns | null;
}

/** `membership[].pathPattern` strings; entries matching by name or kind only have no path to match. */
function pathPatternsOf(membership: readonly unknown[]): string[] {
  return membership.map((entry) => str(asRecord(entry)?.['pathPattern'])).filter((pattern): pattern is string => pattern !== null && pattern !== '');
}

function parseDeclaration(file: TextFileRaw): ParsedDeclaration {
  const doc = asRecord(parseJson(file.text));
  if (!doc) return { fact: { path: file.path, name: null, parsed: false, membershipCount: 0, modifiedAt: file.modifiedAt }, membership: null };
  const membership = asArray(doc['membership']);
  return {
    fact: { path: file.path, name: str(doc['name']), parsed: true, membershipCount: membership.length, modifiedAt: file.modifiedAt },
    membership: { pathPatterns: pathPatternsOf(membership) },
  };
}

export function extractAnatomiaEvidence(raw: AnatomiaRaw): AnatomiaEvidence {
  const parsed = [...raw.declarations].sort((a, b) => a.path.localeCompare(b.path)).map(parseDeclaration);
  const declarations = parsed.map((p) => p.fact);
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
    membership: membershipCoverage(raw.trackedFiles, parsed.flatMap((p) => (p.membership ? [p.membership] : []))),
  };
}
