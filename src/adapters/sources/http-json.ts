// @implements SPEC-br-architecture
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export class SourceFetchError extends Error {}

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
    if (name === 'TimeoutError' || name === 'AbortError') throw new SourceFetchError(`GET ${path}: ${options.timeoutMs}ms でタイムアウト`);
    throw new SourceFetchError(`GET ${path}: 接続できない`);
  }
  if (!response.ok) throw new SourceFetchError(`GET ${path}: HTTP ${response.status}`);
  const type = response.headers.get('content-type') ?? '';
  if (!type.toLowerCase().includes('json')) throw new SourceFetchError(`GET ${path}: JSON ではない応答 (${type.split(';')[0] || 'content-type なし'})`);
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new SourceFetchError(`GET ${path}: JSON として読めない`);
  }
}
