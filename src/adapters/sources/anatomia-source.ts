// @implements SPEC-br-architecture
import { extractAnatomiaEvidence, type TextFileRaw } from '../../inspections/extractors/anatomia.ts';
import type { Project } from '../../registry/domain/model.ts';
import type { SourceOutcome } from '../../snapshots/domain/model.ts';
import type { SourceAdapter } from '../../snapshots/ports.ts';
import { type GitRunner, listIndexedFiles } from './git-source.ts';
import { assertRepoReadable, repoFile, repoFileNames, type RepoFileFact } from './repo-files.ts';
import { failed } from './source-outcomes.ts';

const DOMAINS_DIR = 'spec/domains';
const MANIFEST = 'spec/data/generated/anatomia/manifest.json';
const MAX_DECLARATIONS = 500;

function asText(fact: RepoFileFact): TextFileRaw {
  return { path: fact.path, modifiedAt: fact.modifiedAt, text: fact.text ?? '' };
}

/**
 * Anatomia artefacts in the checkout (declarations + generated manifest) and the files in its git index,
 * which the extractor matches against the declarations' pathPatterns and keeps as counts only. The CLI is
 * never started; a git failure fails the attempt, so the previous snapshot stays.
 */
export function createAnatomiaSource(git: GitRunner): SourceAdapter {
  return {
    id: 'anatomia',
    async fetch(project: Project): Promise<SourceOutcome> {
      try {
        await assertRepoReadable(project.repoPath);
        const names = (await repoFileNames(project.repoPath, DOMAINS_DIR)).filter((n) => n.endsWith('.domain.json')).slice(0, MAX_DECLARATIONS);
        const files = await Promise.all(names.map((n) => repoFile(project.repoPath, `${DOMAINS_DIR}/${n}`, true)));
        const manifest = await repoFile(project.repoPath, MANIFEST, true);
        const trackedFiles = await listIndexedFiles(git, project.repoPath);
        const data = extractAnatomiaEvidence({
          declarations: files.filter((f) => f !== null).map(asText),
          manifest: manifest ? asText(manifest) : null,
          trackedFiles,
        });
        return { kind: 'ok', data, subject: `repo:${project.repoPath}` };
      } catch (error) {
        return failed(error);
      }
    },
  };
}
