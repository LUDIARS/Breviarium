// @implements SPEC-br-grading
/** Defensive readers for JSON that arrives from other services and repository files. */

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

export function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function bool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

export function strList(value: unknown): string[] {
  return asArray(value).filter((v): v is string => typeof v === 'string');
}

/** JSON.parse that reports failure as null instead of throwing. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
