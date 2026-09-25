// @implements SPEC-br-snapshots
import { SOURCE_VERSIONS, type SourceId, type SourceOutcome, type SourceSnapshot } from './model.ts';

export interface AttemptContext {
  readonly projectCode: string;
  readonly source: SourceId;
  readonly at: string;
}

const MAX_ERROR_LENGTH = 300;

/** Single-line, bounded error text for storage and display. */
export function compactError(message: string): string {
  const line = message.replace(/\s+/g, ' ').trim();
  return line.length > MAX_ERROR_LENGTH ? `${line.slice(0, MAX_ERROR_LENGTH - 1)}…` : line || '不明なエラー';
}

/**
 * Applies one fetch attempt to the previous snapshot. Success replaces the data; a failure
 * or "not connected" keeps the previous data, subject and dataFetchedAt and only records
 * attemptedAt and the error — a snapshot is never overwritten with nothing.
 */
export function applyOutcome(previous: SourceSnapshot | undefined, outcome: SourceOutcome, ctx: AttemptContext): SourceSnapshot {
  if (outcome.kind === 'ok') {
    return {
      projectCode: ctx.projectCode,
      source: ctx.source,
      sourceVersion: SOURCE_VERSIONS[ctx.source],
      subject: outcome.subject,
      data: outcome.data,
      dataFetchedAt: ctx.at,
      attemptedAt: ctx.at,
      status: 'ok',
      error: null,
    };
  }
  return {
    projectCode: ctx.projectCode,
    source: ctx.source,
    sourceVersion: previous?.sourceVersion ?? SOURCE_VERSIONS[ctx.source],
    subject: previous?.subject ?? null,
    data: previous?.data ?? null,
    dataFetchedAt: previous?.dataFetchedAt ?? null,
    attemptedAt: ctx.at,
    status: outcome.kind === 'failed' ? 'failed' : 'not-connected',
    error: compactError(outcome.kind === 'failed' ? outcome.error : outcome.reason),
  };
}

/** The snapshot's data when it is present and in the current evidence shape, else null. */
export function usableData(snapshot: SourceSnapshot | undefined): unknown {
  if (!snapshot || snapshot.data === null || snapshot.data === undefined) return null;
  return snapshot.sourceVersion === SOURCE_VERSIONS[snapshot.source] ? snapshot.data : null;
}
