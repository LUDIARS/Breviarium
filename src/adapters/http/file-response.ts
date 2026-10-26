// @implements SPEC-br-playtest-triage
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';

export interface ByteRange {
  readonly start: number;
  readonly end: number;
}

/**
 * One `bytes=a-b` / `bytes=a-` / `bytes=-n` range within `size`, undefined for no Range header, null for
 * a range that cannot be served (several ranges, out of bounds, malformed).
 */
export function parseRange(header: string | undefined, size: number): ByteRange | undefined | null {
  if (header === undefined || header.trim() === '') return undefined;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '') || size === 0) return null;
  if (match[1] === '') {
    const suffix = Number(match[2]);
    return suffix === 0 ? null : { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  return start > end || start >= size ? null : { start, end };
}

/** Streams a file the router answered with (`HttpResponse.file`): 200, 206 for a Range, 416 for a bad one. */
export async function sendFile(res: ServerResponse, method: string, file: { path: string; contentType: string }, rangeHeader: string | undefined): Promise<void> {
  const size = (await stat(file.path)).size;
  const range = parseRange(rangeHeader, size);
  const base = { 'content-type': file.contentType, 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=0' };
  if (range === null) {
    res.writeHead(416, { 'content-range': `bytes */${size}` });
    res.end();
    return;
  }
  const { start, end } = range ?? { start: 0, end: size - 1 };
  res.writeHead(range ? 206 : 200, { ...base, 'content-length': String(Math.max(0, end - start + 1)), ...(range ? { 'content-range': `bytes ${start}-${end}/${size}` } : {}) });
  if (method === 'HEAD' || size === 0) {
    res.end();
    return;
  }
  await new Promise<void>((done, fail) => {
    const stream = createReadStream(file.path, { start, end });
    stream.on('error', fail);
    res.on('close', () => {
      stream.destroy();
      done();
    });
    stream.pipe(res).on('finish', done);
  });
}
