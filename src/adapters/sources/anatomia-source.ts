// @implements SPEC-br-architecture
import { extractAnatomiaEvidence, type TextFileRaw } from '../../inspections/extractors/anatomia.ts';
import type { Project } from '../../registry/domain/model.ts';
import type { SourceOutcome } from '../../snapshots/domain/model.ts';
import type { SourceAdapter } from '../../snapshots/ports.ts';
import { anatomiaProjectId } from './anatomia-cli-source.ts';
import type { OntologyLocator } from './anatomia-ontology.ts';
import { type GitRunner, listIndexedFiles } from './git-source.ts';
import { assertRepoReadable, repoFile, repoFileNames, type RepoFileFact } from './repo-files.ts';
import { failed } from './source-outcomes.ts';

const DOMAINS_DIR = 'spec/domains';
const MANIFEST = 'spec/data/generated/anatomia/manifest.json';
const MAX_DECLARATIONS = 500;
/** Label of declarations read from the Anatomia ontology directory (its absolute path is not kept). */
const ONTOLOGY_LABEL = 'ontology';

function asText(fact: RepoFileFact): TextFileRaw {
  return { path: fact.path, modifiedAt: fact.modifiedAt, text: fact.text ?? '' };
}

/** Declarations from the ontology directory (`*.json`) when there is one, else the repository's `spec/domains/*.domain.json`. */
async function declarationFiles(project: Project, ontologyDir: string | null): Promise<TextFileRaw[]> {
  if (ontologyDir) {
    const names = (await repoFileNames(ontologyDir, '.')).filter((n) => n.endsWith('.json')).slice(0, MAX_DECLARATIONS);
    const files = await Promise.all(names.map((n) => repoFile(ontologyDir, n, true)));
    return files.filter((f) => f !== null).map((f) => ({ ...asText(f), path: `${ONTOLOGY_LABEL}/${f.path}` }));
  }
  const names = (await repoFileNames(project.repoPath, DOMAINS_DIR)).filter((n) => n.endsWith('.domain.json')).slice(0, MAX_DECLARATIONS);
  const files = await Promise.all(names.map((n) => repoFile(project.repoPath, `${DOMAINS_DIR}/${n}`, true)));
  return files.filter((f) => f !== null).map(asText);
}

/**
 * Anatomia artefacts in the checkout (declarations + generated manifest) and the files in its git index,
 * which the extractor matches against the declarations' pathPatterns and keeps as counts only. The declarations
 * come from the project's Anatomia ontology directory when its registration has one (anatomia-ontology.ts), as
 * Anatomia itself reads them. The CLI is never started; a git or lookup failure fails the attempt, so the
 * previous snapshot stays.
 */
export function createAnatomiaSource(git: GitRunner, ontology?: OntologyLocator): SourceAdapter {
  return {
    id: 'anatomia',
    async fetch(project: Project): Promise<SourceOutcome> {
      try {
        await assertRepoReadable(project.repoPath);
        const ontologyDir = ontology ? await ontology.locate(project) : null;
        const declarations = await declarationFiles(project, ontologyDir);
        const manifest = await repoFile(project.repoPath, MANIFEST, true);
        const trackedFiles = await listIndexedFiles(git, project.repoPath);
        const data = extractAnatomiaEvidence({ declarations, manifest: manifest ? asText(manifest) : null, trackedFiles });
        const subject = ontologyDir ? `repo:${project.repoPath}+${ONTOLOGY_LABEL}:${anatomiaProjectId(project)}` : `repo:${project.repoPath}`;
        return { kind: 'ok', data, subject };
      } catch (error) {
        return failed(error);
      }
    },
  };
}
