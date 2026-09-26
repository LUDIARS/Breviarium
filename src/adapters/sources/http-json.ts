// @implements SPEC-br-architecture
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** What went wrong: no answer, too slow, an HTTP error, an answer that is not JSON, or JSON that does not parse. */
export type SourceFetchFailure = 'unreachable' | 'timeout' | 'http' | 'not-json' | 'unparsable';

export class SourceFetchError extends Error {
  readonly failure: SourceFetchFailure;
  /** HTTP status when the source answered with an error; undefined for transport failures. */
  readonly status: number | undefined;
  /** The `error` code of a JSON error body (e.g. `unknown_project`), only when it is a plain identifier. */
  readonly code: string | undefined;

  constructor(message: string, failure: SourceFetchFailure, status?: number, code?: string) {
    super(message);
    this.failure = failure;
    this.status = status;
    this.code = code;
  }
}

/** Error codes are short identifiers; free text from an error body is never kept (it could carry anything). */
const ERROR_CODE = /^[a-z][a-z0-9_]{0,63}$/;

async function errorCodeOf(response: Response): Promise<string | undefined> {
  if (!(response.headers.get('content-type') ?? '').toLowerCase().includes('json')) return undefined;
  try {
    const body = JSON.parse(await response.text()) as unknown;
    const code = body !== null && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>)['error'] : undefined;
    return typeof code === 'string' && ERROR_CODE.test(code) ? code : undefined;
  } catch {
    // An unreadable error body only loses the code; the HTTP status still reports the failure.
    return undefined;
  }
}

export interface HttpSourceOptions {
  readonly baseUrl: string;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs: number;
}

/**
 * `GET <baseUrl><path>` expecting JSON. Every failure becomes a SourceFetchError whose
 * message names the path only (never the host), so stored errors carry no addresses.
 * A non-JSON answer (e.g. an HTML page for an API that does not exist) is a failure.
 */
export async function getJson(options: HttpSourceOptions, path: string): Promise<unknown> {
  let response: Response;
  try {
    response = await options.fetchImpl(`${options.baseUrl}${path}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') throw new SourceFetchError(`GET ${path}: ${options.timeoutMs}ms でタイムアウト`, 'timeout');
    throw new SourceFetchError(`GET ${path}: 接続できない`, 'unreachable');
  }
  if (!response.ok) {
    const code = await errorCodeOf(response);
    throw new SourceFetchError(`GET ${path}: HTTP ${response.status}${code ? ` (${code})` : ''}`, 'http', response.status, code);
  }
  const type = response.headers.get('content-type') ?? '';
  if (!type.toLowerCase().includes('json')) throw new SourceFetchError(`GET ${path}: JSON ではない応答 (${type.split(';')[0] || 'content-type なし'})`, 'not-json');
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new SourceFetchError(`GET ${path}: JSON として読めない`, 'unparsable');
  }
}
