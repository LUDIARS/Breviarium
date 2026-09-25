// @implements SPEC-br-web-entrance
import type { AccessLevel, HttpResponse } from './http-types.ts';
import { jsonResponse } from './responses.ts';

/** The entrance's decision: proceed at a level, or answer with the refusal. */
export type Admission = { readonly level: AccessLevel } | { readonly refusal: HttpResponse };

const VIEWER_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD']);

/** `local` may do everything; a Cloudflare Access `viewer` may only read. */
export function allowsMethod(level: AccessLevel, method: string): boolean {
  return level === 'local' || VIEWER_METHODS.has(method.toUpperCase());
}

/** 403 `read_only_viewer` for a viewer's write (POST / PUT / DELETE / …), before the body is read. */
export function admitMethod(level: AccessLevel, method: string): HttpResponse | undefined {
  return allowsMethod(level, method) ? undefined : jsonResponse(403, { error: 'read_only_viewer' });
}
