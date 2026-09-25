// @implements SPEC-br-architecture
import { extractRepoArtifactsEvidence, planNumber } from '../../inspections/extractors/repo-artifacts.ts';
import type { Project } from '../../registry/domain/model.ts';
import type { SourceOutcome } from '../../snapshots/domain/model.ts';
import type { SourceAdapter } from '../../snapshots/ports.ts';
import { assertRepoReadable, repoFile, repoFileNames } from './repo-files.ts';
import { failed } from './source-outcomes.ts';

const PLAN_DIR = 'spec/plan';
const DATA_DIR = 'spec/data';

/** Reads (never writes) the checkout's foundation docs and Omnipotens / Vitia / Discutere artefacts. */
export function createRepoArtifactsSource(): SourceAdapter {
  return {
    id: 'repo-artifacts',
    async fetch(project: Project): Promise<SourceOutcome> {
      const repo = project.repoPath;
      try {
        await assertRepoReadable(repo);
        const readmeName = (await repoFileNames(repo, '')).find((n) => /^readme(\.md)?$/i.test(n));
        const planNames = (await repoFileNames(repo, PLAN_DIR)).filter((n) => {
          const number = planNumber(n);
          return n.endsWith('.md') && number !== null && number >= 3 && number <= 26;
        });
        const featureCount = (await repoFileNames(repo, 'spec/feature')).filter((n) => n.endsWith('.md')).length;
        const [readme, productSpec, summary, runPlan, audit, finalReport, ...plans] = await Promise.all([
          readmeName ? repoFile(repo, readmeName, false) : Promise.resolve(null),
          repoFile(repo, 'spec/ux/product.md', false),
          repoFile(repo, `${DATA_DIR}/omnipotens-summary.json`, true),
          repoFile(repo, `${DATA_DIR}/omnipotens-run-plan.json`, true),
          repoFile(repo, `${DATA_DIR}/vitia-game-experience-audit.json`, true),
          repoFile(repo, 'report/omnipotens-final.html', false),
          ...planNames.map((n) => repoFile(repo, `${PLAN_DIR}/${n}`, true)),
        ]);
        const data = extractRepoArtifactsEvidence({
          readme: readme ?? null,
          productSpec: productSpec ?? null,
          featureSpecCount: featureCount,
          plans: plans.filter((p) => p !== null),
          summary: summary ?? null,
          runPlan: runPlan ?? null,
          audit: audit ?? null,
          finalReport: finalReport ?? null,
        });
        return { kind: 'ok', data, subject: `repo:${repo}` };
      } catch (error) {
        return failed(error);
      }
    },
  };
}
