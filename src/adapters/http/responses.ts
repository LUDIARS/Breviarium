// @implements SPEC-br-web-ui
import type { DomainError, Result } from '../../shared/result.ts';
import type { HttpResponse } from './http-types.ts';

export function jsonResponse(status: number, data: unknown): HttpResponse {
  return { status, headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(data) };
}

export function htmlResponse(status: number, html: string): HttpResponse {
  return { status, headers: { 'content-type': 'text/html; charset=utf-8' }, body: html };
}

export function markdownResponse(status: number, markdown: string, filename: string): HttpResponse {
  return {
    status,
    headers: { 'content-type': 'text/markdown; charset=utf-8', 'content-disposition': `inline; filename="${filename}"` },
    body: markdown,
  };
}

export function redirect(location: string): HttpResponse {
  return { status: 303, headers: { location }, body: '' };
}

const CONFLICT = new Set(['duplicate_project', 'refresh_in_progress']);
const BAD_REQUEST = new Set(['unknown_source', 'invalid_sources']);

/** Maps a domain error code to an HTTP status. */
export function statusOf(error: DomainError): number {
  if (error.code.endsWith('_not_found')) return 404;
  if (CONFLICT.has(error.code)) return 409;
  if (BAD_REQUEST.has(error.code)) return 400;
  return 422;
}

export function resultResponse<T>(result: Result<T>, successStatus = 200): HttpResponse {
  return result.ok ? jsonResponse(successStatus, result.value) : jsonResponse(statusOf(result.error), { error: result.error.code, message: result.error.message });
}
