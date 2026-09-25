// @implements SPEC-br-architecture
import { readdir, stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { extractVoluptasEvidence, type VoluptasRaw } from '../../inspections/extractors/voluptas.ts';
import type { Project } from '../../registry/domain/model.ts';
import type { SourceOutcome } from '../../snapshots/domain/model.ts';
import type { SourceAdapter } from '../../snapshots/ports.ts';
import { failed, notConnected } from './source-outcomes.ts';

const MAX_FILES = 5000;
const MAX_DEPTH = 6;

/** The bound directory, refused when it would leave the Voluptas data directory. */
export function containedPath(dataDir: string, rel: string): string | null {
  const root = resolve(dataDir);
  const target = resolve(root, ...rel.split('/'));
  return target === root || target.startsWith(root + sep) ? target : null;
}

async function walk(dir: string): Promise<VoluptasRaw> {
  const files: { name: string; modifiedAt: string }[] = [];
  let truncated = false;
  const visit = async (current: string, depth: number): Promise<void> => {
    if (truncated) return;
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= MAX_FILES) {
        truncated = true;
        return;
      }
      if (entry.isSymbolicLink()) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (depth < MAX_DEPTH) await visit(full, depth + 1);
      } else if (entry.isFile()) {
        files.push({ name: entry.name, modifiedAt: (await stat(full)).mtime.toISOString() });
      }
    }
  };
  try {
    const info = await stat(dir);
    if (!info.isDirectory()) return { exists: false, files: [], truncated: false };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { exists: false, files: [], truncated: false };
    throw error;
  }
  await visit(dir, 0);
  return { exists: true, files, truncated };
}

/**
 * Voluptas: JSON file count and newest mtime under `<data dir>/<bindings.voluptasPath>`.
 * File names are not kept (answer folders are named after people).
 */
export function createVoluptasSource(dataDir: string | undefined): SourceAdapter {
  return {
    id: 'voluptas',
    async fetch(project: Project): Promise<SourceOutcome> {
      if (!dataDir) return notConnected('BREVIARIUM_VOLPUTAS_DATA_DIR が未設定');
      const rel = project.bindings.voluptasPath;
      if (!rel) return notConnected('bindings.voluptasPath が未登録');
      const dir = containedPath(dataDir, rel);
      if (!dir) return failed(new Error('bindings.voluptasPath がデータディレクトリの外を指している'));
      try {
        return { kind: 'ok', data: extractVoluptasEvidence(await walk(dir)), subject: `voluptas:${rel}` };
      } catch {
        return failed(new Error('Voluptas のデータを読めない'));
      }
    },
  };
}
