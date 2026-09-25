// @implements SPEC-br-web-ui
import type { Grade } from '../../../inspections/domain/model.ts';
import { esc } from './escape.ts';

const TIME_FORMAT = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** `<time>` in JST with the ISO value kept in `datetime`; `—` when absent. */
export function timeTag(iso: string | null | undefined): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return '<span class="muted">—</span>';
  return `<time datetime="${esc(iso)}">${esc(TIME_FORMAT.format(new Date(iso)))} JST</time>`;
}

export function formatAge(ms: number | null): string {
  if (ms === null) return '—';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes} 分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} 時間前`;
  return `${Math.floor(hours / 24)} 日前`;
}

export function gradeClass(grade: Grade): string {
  return grade === '—' ? 'g-none' : `g-${grade}`;
}

export function shortSha(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 10) : '—';
}
