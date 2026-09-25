// @implements SPEC-br-web-ui
import type { HttpRequest } from './http-types.ts';

export class BadRequestError extends Error {}

export function readJson(req: HttpRequest): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(req.body || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestError('JSON object expected');
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    throw new BadRequestError('invalid JSON body');
  }
}

export function readForm(req: HttpRequest): URLSearchParams {
  return new URLSearchParams(req.body);
}

export function str(source: Record<string, unknown>, key: string): string {
  const v = source[key];
  if (typeof v !== 'string') throw new BadRequestError(`${key} must be a string`);
  return v;
}

export function optStr(source: Record<string, unknown>, key: string): string | undefined {
  const v = source[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') throw new BadRequestError(`${key} must be a string`);
  return v;
}

export function optStrList(source: Record<string, unknown>, key: string): string[] | undefined {
  const v = source[key];
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) throw new BadRequestError(`${key} must be a string array`);
  return v as string[];
}

/** A flat object of string values (bindings); undefined when absent. */
export function optStringRecord(source: Record<string, unknown>, key: string): Record<string, string> | undefined {
  const v = source[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'object' || Array.isArray(v)) throw new BadRequestError(`${key} must be an object`);
  const out: Record<string, string> = {};
  for (const [k, value] of Object.entries(v)) {
    if (value === null || value === undefined) continue;
    if (typeof value !== 'string') throw new BadRequestError(`${key}.${k} must be a string`);
    out[k] = value;
  }
  return out;
}

export function formValue(form: URLSearchParams, key: string): string {
  return form.get(key) ?? '';
}
