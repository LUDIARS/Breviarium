// @implements SPEC-br-cross-sprints
import { validateCode, validateName } from '../../registry/domain/field-rules.ts';
import type { Project } from '../../registry/domain/model.ts';
import { findProject, sameCode } from '../../registry/domain/registration-rules.ts';
import { fail, ok, type Result } from '../../shared/result.ts';
import { type CrossSprint, type CrossSprintDraft, type CrossSprintPatch, MAX_RELATED } from './model.ts';

const TEAM_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function findCrossSprint(existing: readonly CrossSprint[], code: string): CrossSprint | undefined {
  return existing.find((s) => sameCode(s.code, code));
}

function validateTeamId(raw: string): Result<string> {
  const id = raw.trim();
  return TEAM_ID.test(id) ? ok(id) : fail('invalid_team', 'actioTeamId は英数字・_・- の 1〜64 文字です');
}

/**
 * Related projects must be registered (a link to an unknown project would lead nowhere). The
 * registered spelling of each code is kept; duplicates (ignoring case) are rejected.
 */
function validateRelated(raw: readonly string[], projects: readonly Project[]): Result<string[]> {
  if (raw.length > MAX_RELATED) return fail('invalid_related', `関連は ${MAX_RELATED} 件までです`);
  const codes: string[] = [];
  for (const entry of raw) {
    const project = findProject(projects, entry.trim());
    if (!project) return fail('unknown_related', `関連の ${entry} は登録されていません`);
    if (codes.some((c) => sameCode(c, project.code))) return fail('invalid_related', `関連の ${project.code} が重複しています`);
    codes.push(project.code);
  }
  return ok(codes);
}

/** Validates a new cross-project sprint against the current list and the project register. */
export function planCrossSprint(existing: readonly CrossSprint[], projects: readonly Project[], draft: CrossSprintDraft, at: string): Result<CrossSprint> {
  const code = validateCode(draft.code);
  if (!code.ok) return code;
  if (findCrossSprint(existing, code.value)) return fail('duplicate_cross_sprint', `${code.value} は登録済みです (大文字小文字を区別しません)`);
  const name = validateName(draft.name);
  if (!name.ok) return name;
  const team = validateTeamId(draft.actioTeamId);
  if (!team.ok) return team;
  const related = validateRelated(draft.related ?? [], projects);
  if (!related.ok) return related;
  return ok({ code: code.value, name: name.value, actioTeamId: team.value, related: related.value, registeredAt: at, updatedAt: at });
}

/** Applies an update. The code never changes. */
export function planCrossSprintUpdate(existing: readonly CrossSprint[], projects: readonly Project[], code: string, patch: CrossSprintPatch, at: string): Result<CrossSprint> {
  const current = findCrossSprint(existing, code);
  if (!current) return fail('cross_sprint_not_found', `${code} は登録されていません`);
  let next: CrossSprint = { ...current, updatedAt: at };
  if (patch.name !== undefined) {
    const name = validateName(patch.name);
    if (!name.ok) return name;
    next = { ...next, name: name.value };
  }
  if (patch.actioTeamId !== undefined) {
    const team = validateTeamId(patch.actioTeamId);
    if (!team.ok) return team;
    next = { ...next, actioTeamId: team.value };
  }
  if (patch.related !== undefined) {
    const related = validateRelated(patch.related, projects);
    if (!related.ok) return related;
    next = { ...next, related: related.value };
  }
  return ok(next);
}
