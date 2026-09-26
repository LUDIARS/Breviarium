// @implements SPEC-br-workflow
import type { EvidenceBundle, ExcubitorEvidence, GitEvidence, RevisorEvidence } from '../../inspections/domain/evidence.ts';
import type { LifecycleKind } from '../../registry/domain/model.ts';
import { daysBetweenDates, jstDate } from '../../shared/time.ts';
import { type CurrentSprint, currentSprint } from './current-sprint.ts';

export const LIFECYCLE_LABELS: Readonly<Record<LifecycleKind, string>> = {
  startup: 'スタートアップ',
  sprint: 'スプリント',
  released: 'リリース済み',
  operating: '運用中',
};

const WEEK_DAYS = 7;
const RELEASE_VERSION = /^\d+\.\d+\.\d+$/;

/** Where the active sprint stands: its N-th week (from 1) of `totalWeeks`. */
export interface SprintWeek {
  readonly teamName: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly week: number;
  /** cadenceDays / 7 rounded up; null when Actio did not send the cadence. */
  readonly totalWeeks: number | null;
}

export interface LifecycleStatus {
  /** The lifecycle shown: the override when one is registered, else the judgement. */
  readonly kind: LifecycleKind;
  /** What the evidence says, override or not. */
  readonly judged: LifecycleKind;
  readonly overridden: boolean;
  /** The active sprint, whatever the lifecycle (null when there is none). */
  readonly sprint: SprintWeek | null;
  readonly reasons: readonly string[];
}

/** floor(days since the start / 7) + 1 on the JST date `today`, never below week 1. */
export function sprintWeek(current: CurrentSprint, today: string): SprintWeek {
  const { sprint } = current;
  const days = daysBetweenDates(sprint.startsOn, today);
  return {
    teamName: current.teamName,
    name: sprint.name,
    startsOn: sprint.startsOn,
    endsOn: sprint.endsOn,
    week: Number.isFinite(days) ? Math.max(1, Math.floor(days / WEEK_DAYS) + 1) : 1,
    totalWeeks: sprint.cadenceDays ? Math.max(1, Math.ceil(sprint.cadenceDays / WEEK_DAYS)) : null,
  };
}

interface Signal {
  readonly on: boolean;
  readonly reason: string;
}

/** Operated: the service is in Excubitor's catalog and starts automatically or is running. Unknown without the snapshot. */
function operatingSignal(e: ExcubitorEvidence | null): Signal {
  if (!e) return { on: false, reason: 'Excubitor 未取得 (運用中は判定しない)' };
  if (!e.found) return { on: false, reason: `Excubitor に ${e.service} が未登録` };
  const running = e.state === 'running';
  const on = running || e.autostart === true;
  return { on, reason: `Excubitor: ${e.service} は ${e.state ?? '状態不明'}${e.autostart === true ? '・autostart' : ''}${on ? '' : ' (autostart なし)'}` };
}

/** Released: Revisor released a version, or the checkout has a `v` tag (the fallback when Revisor has none). */
function releaseSignal(revisor: RevisorEvidence | null, git: GitEvidence | null): Signal {
  const version = revisor?.localVersion ?? null;
  if (version && RELEASE_VERSION.test(version)) return { on: true, reason: `Revisor のリリース版 ${version}` };
  if (git?.latestVersionTag && git.tagCount > 0) return { on: true, reason: `git tag ${git.latestVersionTag} (tag ${git.tagCount} 件)` };
  const revisorPart = revisor ? `Revisor の版 ${version ?? '読めない'}` : 'Revisor 未取得';
  const gitPart = git ? `v tag なし (tag ${git.tagCount} 件)` : 'git 未取得';
  return { on: false, reason: `リリースなし (${revisorPart}、${gitPart})` };
}

function sprintSignal(current: CurrentSprint | null, actioFetched: boolean): Signal {
  if (current) return { on: true, reason: `Actio: ${current.teamName} の ${current.sprint.name} (${current.sprint.startsOn}〜${current.sprint.endsOn})` };
  return { on: false, reason: actioFetched ? 'Actio: アクティブなスプリントなし' : 'Actio 未取得' };
}

/**
 * The project's lifecycle. A registered override wins; otherwise operating > released > sprint >
 * startup. `operating` is only judged from an Excubitor snapshot, never assumed.
 */
export function resolveLifecycle(bundle: EvidenceBundle, override: LifecycleKind | null, now: string): LifecycleStatus {
  const current = currentSprint(bundle.actio);
  const operating = operatingSignal(bundle.excubitor);
  const released = releaseSignal(bundle.revisor, bundle.git);
  const sprinting = sprintSignal(current, bundle.actio !== null);
  const judged: LifecycleKind = operating.on ? 'operating' : released.on ? 'released' : sprinting.on ? 'sprint' : 'startup';
  const reasons = [operating.reason, released.reason, sprinting.reason];
  const today = jstDate(now) ?? now.slice(0, 10);
  return {
    kind: override ?? judged,
    judged,
    overridden: override !== null,
    sprint: current ? sprintWeek(current, today) : null,
    reasons: override ? [`手動設定: ${LIFECYCLE_LABELS[override]} (自動判定は ${LIFECYCLE_LABELS[judged]})`, ...reasons] : reasons,
  };
}

/** Badge text: 「スタートアップ」「スプリント N 週目 (M 週)」「リリース済み」「運用中」. */
export function describeLifecycle(status: LifecycleStatus): string {
  if (status.kind !== 'sprint' || !status.sprint) return LIFECYCLE_LABELS[status.kind];
  const total = status.sprint.totalWeeks === null ? '' : ` (${status.sprint.totalWeeks} 週)`;
  return `スプリント ${status.sprint.week} 週目${total}`;
}
