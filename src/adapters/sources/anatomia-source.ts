// @implements SPEC-br-architecture
import { extractAnatomiaEvidence, type TextFileRaw } from '../../inspections/extractors/anatomia.ts';
import type { Project } from '../../registry/domain/model.ts';
import type { SourceOutcome } from '../../snapshots/domain/model.ts';
import type { SourceAdapter } from '../../snapshots/ports.ts';
import { assertRepoReadable, repoFile, repoFileNames, type RepoFileFact } from './repo-files.ts';
import { failed } from './source-outcomes.ts';

const DOMAINS_DIR = 'spec/domains';
const MANIFEST = 'spec/data/generated/anatomia/manifest.json';
const MAX_DECLARATIONS = 500;

function asText(fact: RepoFileFact): TextFileRaw {
  return { path: fact.path, modifiedAt: fact.modifiedAt, text: fact.text ?? '' };
}

/** Anatomia artefacts in the checkout (declarations + generated manifest). The CLI is never started. */
export function createAnatomiaSource(): SourceAdapter {
  return {
    id: 'anatomia',
    async fetch(project: Project): Promise<SourceOutcome> {
      try {
        await assertRepoReadable(project.repoPath);
        const names = (await repoFileNames(project.repoPath, DOMAINS_DIR)).filter((n) => n.endsWith('.domain.json')).slice(0, MAX_DECLARATIONS);
        const files = await Promise.all(names.map((n) => repoFile(project.repoPath, `${DOMAINS_DIR}/${n}`, true)));
        const manifest = await repoFile(project.repoPath, MANIFEST, true);
        const data = extractAnatomiaEvidence({
          declarations: files.filter((f) => f !== null).map(asText),
          manifest: manifest ? asText(manifest) : null,
        });
        return { kind: 'ok', data, subject: `repo:${project.repoPath}` };
      } catch (error) {
        return failed(error);
      }
    },
  };
}
