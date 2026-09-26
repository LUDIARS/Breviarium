// @implements SPEC-br-architecture
import { execFile } from 'node:child_process';
import { extractGitEvidence } from '../../inspections/extractors/git.ts';
import type { Project } from '../../registry/domain/model.ts';
import type { SourceOutcome } from '../../snapshots/domain/model.ts';
import type { SourceAdapter } from '../../snapshots/ports.ts';
import { failed, fromResult } from './source-outcomes.ts';

/** Runs one read-only git command in a checkout and returns stdout. */
export type GitRunner = (repoPath: string, args: readonly string[]) => Promise<string>;

/**
 * git through `execFile` with an argument array: the repository path is passed as an
 * argument of `-C`, never interpolated into a shell command line.
 */
export function createGitRunner(timeoutMs: number): GitRunner {
  return (repoPath, args) =>
    new Promise((resolve, reject) => {
      execFile(
        'git',
        ['-C', repoPath, ...args],
        {
          timeout: timeoutMs,
          windowsHide: true,
          maxBuffer: 4_000_000,
          encoding: 'utf8',
          env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' },
        },
        (error, stdout, stderr) => {
          if (!error) return resolve(stdout);
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return reject(new Error('git コマンドが見つからない'));
          const detail = stderr.split(/\r?\n/).find((line) => line.trim() !== '')?.trim();
          reject(new Error(`git ${args[0] ?? ''} に失敗${detail ? `: ${detail}` : ''}`));
        },
      );
    });
}

/** git: HEAD sha and commit time, branch, tag count and newest `v` tag of the registered checkout. */
export function createGitSource(run: GitRunner): SourceAdapter {
  return {
    id: 'git',
    async fetch(project: Project): Promise<SourceOutcome> {
      try {
        const [head, branch, tags] = await Promise.all([
          run(project.repoPath, ['log', '-1', '--format=%H%n%cI']),
          run(project.repoPath, ['rev-parse', '--abbrev-ref', 'HEAD']),
          run(project.repoPath, ['tag', '--list', '--sort=-creatordate']),
        ]);
        return fromResult(extractGitEvidence({ head, branch, tags }), `repo:${project.repoPath}`);
      } catch (error) {
        return failed(error);
      }
    },
  };
}
