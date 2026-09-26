// @implements SPEC-br-architecture
import { execFile } from 'node:child_process';
import { extractGitEvidence } from '../../inspections/extractors/git.ts';
import type { Project } from '../../registry/domain/model.ts';
import type { SourceOutcome } from '../../snapshots/domain/model.ts';
import type { SourceAdapter } from '../../snapshots/ports.ts';
import { failed, fromResult } from './source-outcomes.ts';

/** Runs one read-only git command in a checkout and returns stdout. */
export type GitRunner = (repoPath: string, args: readonly string[]) => Promise<string>;

/** A large checkout's `ls-files` listing runs to megabytes; beyond this the run fails instead of growing. */
const MAX_GIT_OUTPUT_BYTES = 64 * 1024 * 1024;

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
          maxBuffer: MAX_GIT_OUTPUT_BYTES,
          encoding: 'utf8',
          env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' },
        },
        (error, stdout) => {
          if (!error) return resolve(stdout);
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return reject(new Error('git コマンドが見つからない'));
          // Git diagnostics can contain the checkout path or a remote URL; snapshots keep only the command kind.
          reject(new Error(`git ${args[0] ?? ''} に失敗`));
        },
      );
    });
}

/**
 * Repository-relative paths of the files in the git index (`ls-files -z`): what is staged, not the
 * working tree. NUL-separated, so a path is never quoted or escaped.
 */
export async function listIndexedFiles(run: GitRunner, repoPath: string): Promise<string[]> {
  return (await run(repoPath, ['ls-files', '-z'])).split('\0').filter((path) => path !== '');
}

/** git: HEAD sha and commit time, branch, tag count, newest `v` tag and the origin remote's host of the registered checkout. */
export function createGitSource(run: GitRunner): SourceAdapter {
  return {
    id: 'git',
    async fetch(project: Project): Promise<SourceOutcome> {
      try {
        const [head, branch, tags, remotes] = await Promise.all([
          run(project.repoPath, ['log', '-1', '--format=%H%n%cI']),
          run(project.repoPath, ['rev-parse', '--abbrev-ref', 'HEAD']),
          run(project.repoPath, ['tag', '--list', '--sort=-creatordate']),
          run(project.repoPath, ['remote', '-v']),
        ]);
        return fromResult(extractGitEvidence({ head, branch, tags, remotes }), `repo:${project.repoPath}`);
      } catch (error) {
        return failed(error);
      }
    },
  };
}
