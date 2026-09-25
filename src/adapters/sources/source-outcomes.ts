// @implements SPEC-br-architecture
import type { Result } from '../../shared/result.ts';
import type { SourceOutcome } from '../../snapshots/domain/model.ts';

export function notConnected(reason: string): SourceOutcome {
  return { kind: 'not-connected', reason };
}

export function failed(error: unknown): SourceOutcome {
  return { kind: 'failed', error: error instanceof Error ? error.message : String(error) };
}

/** An extractor result as an outcome: shape errors are failures of the source. */
export function fromResult(result: Result<unknown>, subject: string): SourceOutcome {
  return result.ok ? { kind: 'ok', data: result.value, subject } : { kind: 'failed', error: `${result.error.code}: ${result.error.message}` };
}
