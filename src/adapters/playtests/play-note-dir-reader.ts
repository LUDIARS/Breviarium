// @implements SPEC-br-playtest-triage
import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import type { PlayNoteReader } from '../../playtests/ports.ts';

const MAX_NOTES = 2000;
const MAX_NOTE_BYTES = 20_000_000;
const GAME_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

function inside(root: string, target: string): boolean {
  return target === root || target.startsWith(root + sep);
}

/**
 * Ingenium's play notes under `<data dir>/<game>/*.json` (BREVIARIUM_INGENIUM_DATA_DIR = Ingenium's
 * `data/playtests`). Read only; a note that does not parse is passed on as null and skipped by the import.
 */
export function createPlayNoteDirReader(dataDir: string | undefined): PlayNoteReader {
  const root = dataDir ? resolve(dataDir) : undefined;
  return {
    configured: root !== undefined,
    async read(gameId: string): Promise<readonly unknown[]> {
      if (!root || !GAME_ID.test(gameId)) return [];
      const dir = join(root, gameId);
      let names: string[];
      try {
        names = (await readdir(dir, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map((entry) => entry.name);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
      }
      const notes: unknown[] = [];
      for (const name of names.sort().slice(-MAX_NOTES)) {
        const path = join(dir, name);
        if ((await stat(path)).size > MAX_NOTE_BYTES) {
          notes.push(null);
          continue;
        }
        try {
          notes.push(JSON.parse(await readFile(path, 'utf8')) as unknown);
        } catch {
          notes.push(null);
        }
      }
      return notes;
    },
    async containedVideo(path: string): Promise<string | null> {
      if (!root || !path.toLowerCase().endsWith('.mp4')) return null;
      try {
        const real = await realpath(resolve(path));
        const realRoot = await realpath(root);
        return inside(realRoot, real) && (await stat(real)).isFile() ? real : null;
      } catch {
        return null;
      }
    },
  };
}
