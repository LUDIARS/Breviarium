// @implements SPEC-br-architecture
import { extractGithubReleasesEvidence, RELEASE_LIMIT } from '../../inspections/extractors/github-releases.ts';
import type { Project } from '../../registry/domain/model.ts';
import type { SourceOutcome } from '../../snapshots/domain/model.ts';
import type { SourceAdapter } from '../../snapshots/ports.ts';
import { type CliRunner, CliRunError, createCommandRunner, parseCliJson } from './node-cli-runner.ts';
import { failed, fromResult, notConnected } from './source-outcomes.ts';

/** gh never prompts, never checks for its own update and prints no colour in these read-only runs. */
function ghEnv(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...base, GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1', NO_COLOR: '1' };
}

/** GitHub CLI (`gh` on PATH), one run per refresh within the source timeout. */
export function createGhRunner(timeoutMs: number): CliRunner {
  return createCommandRunner('gh', { label: 'gh', timeoutMs, env: ghEnv });
}

/** `gh release list` of one repository: drafts excluded, only the three fields the lifecycle reads, the newest RELEASE_LIMIT. */
function releaseListArgs(repository: string): string[] {
  return ['release', 'list', '--repo', repository, '--exclude-drafts', '--limit', String(RELEASE_LIMIT), '--json', 'tagName,publishedAt,isPrerelease'];
}

/** Says what to fix for the failures an operator can act on; gh's own diagnostics are not kept. */
function explain(error: unknown, repository: string): unknown {
  if (!(error instanceof CliRunError)) return error;
  if (error.failure === 'missing') return new Error('gh (GitHub CLI) が見つからない (PATH を確認)');
  if (error.failure !== 'exit') return error;
  if (/gh auth login|HTTP 401|Bad credentials/i.test(error.stderr)) return new Error('gh が GitHub にログインしていない (gh auth login)');
  if (/Could not resolve to a Repository|HTTP 404/i.test(error.stderr)) return new Error(`GitHub に ${repository} が見つからない (bindings.githubRepo を確認)`);
  return error;
}

/**
 * GitHub Releases of `bindings.githubRepo` through `gh release list --json` (execFile with an argument
 * array), kept as tags, publication times and the pre-release flag only. Revisor's CLI has no release
 * listing, so GitHub is the record of explicit releases. Without a bound repository the source is not
 * connected; gh missing, not logged in, an unknown repository or a timeout is a failed attempt, so the
 * previous releases stay.
 */
export function createGithubReleasesSource(run: CliRunner): SourceAdapter {
  return {
    id: 'github-releases',
    async fetch(project: Project): Promise<SourceOutcome> {
      const repository = project.bindings.githubRepo;
      if (!repository) return notConnected('bindings.githubRepo が未登録');
      try {
        const body = parseCliJson(await run(releaseListArgs(repository)), 'gh (release list)');
        return fromResult(extractGithubReleasesEvidence(repository, body), `github:${repository}`);
      } catch (error) {
        return failed(explain(error, repository));
      }
    },
  };
}
