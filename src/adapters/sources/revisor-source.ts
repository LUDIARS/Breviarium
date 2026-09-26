// @implements SPEC-br-architecture
import { MERGED_PR_LIMIT } from '../../inspections/domain/merged-prs.ts';
import { extractRevisorEvidence, latestMergedPrNumbers } from '../../inspections/extractors/revisor.ts';
import type { Project } from '../../registry/domain/model.ts';
import type { SourceOutcome } from '../../snapshots/domain/model.ts';
import type { SourceAdapter } from '../../snapshots/ports.ts';
import { type CliRunner, CliRunError, createNodeCliRunner, parseCliJson } from './node-cli-runner.ts';
import { failed, fromResult, notConnected } from './source-outcomes.ts';

/** One Revisor CLI run (it opens Revisor's database); beyond this the attempt fails and the previous data stays. */
export const REVISOR_CLI_TIMEOUT_MS = 60_000;

/** `git -c` style configuration a Concordia session injects through the environment. */
const INJECTED_GIT_CONFIG = /^GIT_CONFIG_(?:COUNT|KEY_\d+|VALUE_\d+)$/i;

/**
 * The environment without the git configuration a Concordia session injects
 * (GIT_CONFIG_COUNT / GIT_CONFIG_KEY_n / GIT_CONFIG_VALUE_n): Revisor runs git itself, and the
 * session's settings must not leak into it. Every other variable is kept as it is.
 */
export function withoutGitConfigInjection(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !INJECTED_GIT_CONFIG.test(key)));
}

export function createRevisorCliRunner(cliPath: string): CliRunner {
  return createNodeCliRunner({ cliPath, label: 'Revisor CLI', timeoutMs: REVISOR_CLI_TIMEOUT_MS, env: withoutGitConfigInjection });
}

function explain(error: unknown): unknown {
  if (error instanceof CliRunError && error.failure === 'missing') return new Error(`${error.message} (BREVIARIUM_REVISOR_CLI を確認)`);
  return error;
}

/** `pr show` for each chosen PR, one Revisor process at a time (each run opens Revisor's database). */
async function showEach(run: CliRunner, numbers: readonly number[]): Promise<unknown[]> {
  const shows: unknown[] = [];
  for (const number of numbers) shows.push(parseCliJson(await run(['pr', 'show', String(number), '--json']), `Revisor CLI (pr show ${number})`));
  return shows;
}

/**
 * Revisor CLI: `pr list --repository <owner/name> --json`, then `pr show <n> --json` for the newest
 * merged PRs, kept as their Anatomia gate and merge-risk band only. Without a configured CLI or a
 * bound GitHub repository the source is not connected; any failure keeps the previous data.
 */
export function createRevisorSource(run: CliRunner | undefined): SourceAdapter {
  return {
    id: 'revisor',
    async fetch(project: Project): Promise<SourceOutcome> {
      if (!run) return notConnected('BREVIARIUM_REVISOR_CLI が未設定');
      const repository = project.bindings.githubRepo;
      if (!repository) return notConnected('bindings.githubRepo が未登録');
      const subject = `revisor:${repository}`;
      try {
        const listing = parseCliJson(await run(['pr', 'list', '--repository', repository, '--json']), 'Revisor CLI (pr list)');
        const numbers = latestMergedPrNumbers(listing, repository, MERGED_PR_LIMIT);
        if (!numbers.ok) return fromResult(numbers, subject);
        return fromResult(extractRevisorEvidence(repository, await showEach(run, numbers.value)), subject);
      } catch (error) {
        return failed(explain(error));
      }
    },
  };
}
