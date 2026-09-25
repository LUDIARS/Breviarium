// @implements SPEC-br-architecture
/**
 * Result type used by every pure business rule. Rules never throw for
 * expected rejections; they return a coded error the delivery surface can show.
 */
export interface DomainError {
  readonly code: string;
  readonly message: string;
}

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DomainError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T = never>(code: string, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}
