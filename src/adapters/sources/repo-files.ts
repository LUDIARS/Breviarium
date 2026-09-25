// @implements SPEC-br-architecture
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

/** Read-only access to a checkout. Paths are repository-relative, `/`-separated constants or listing entries. */

export interface RepoFileFact {
  readonly path: string;
  readonly modifiedAt: string;
  readonly text?: string;
}

export class RepoUnreadableError extends Error {}

const MAX_TEXT_BYTES = 4_000_000;

function isMissing(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'ENOENT' || code === 'ENOTDIR';
}

/** Fails when the checkout itself cannot be read, so a wrong repoPath is a failure, not "no artefacts". */
export async function assertRepoReadable(repoPath: string): Promise<void> {
  try {
    const info = await stat(repoPath);
    if (!info.isDirectory()) throw new RepoUnreadableError('repoPath がディレクトリではない');
  } catch (error) {
    if (error instanceof RepoUnreadableError) throw error;
    throw new RepoUnreadableError(isMissing(error) ? 'repoPath が存在しない' : 'repoPath を読めない');
  }
}

/** A regular file's mtime (and text when asked and not too large); null when absent. */
export async function repoFile(repoPath: string, rel: string, withText: boolean): Promise<RepoFileFact | null> {
  const full = join(repoPath, ...rel.split('/'));
  try {
    const info = await stat(full);
    if (!info.isFile()) return null;
    const fact = { path: rel, modifiedAt: info.mtime.toISOString() };
    if (!withText || info.size > MAX_TEXT_BYTES) return fact;
    return { ...fact, text: await readFile(full, 'utf8') };
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

/** Names of the regular files directly inside a repository directory; empty when it does not exist. */
export async function repoFileNames(repoPath: string, rel: string): Promise<string[]> {
  try {
    const entries = await readdir(join(repoPath, ...rel.split('/')), { withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => e.name).sort();
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
}
