// @implements SPEC-br-registry
import { fail, ok, type Result } from '../../shared/result.ts';
import { normalizeRepoPath, validateBindings, validateClassification, validateCode, validateName } from './field-rules.ts';
import type { Project, ProjectDraft, ProjectPatch } from './model.ts';

/** Codes are unique ignoring case so `data/snapshots/<code>/` never collides on a case-insensitive file system. */
export function sameCode(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function findProject(existing: readonly Project[], code: string): Project | undefined {
  return existing.find((p) => sameCode(p.code, code));
}

/** Validates a new registration against the current register. */
export function planRegistration(existing: readonly Project[], draft: ProjectDraft, at: string): Result<Project> {
  const code = validateCode(draft.code);
  if (!code.ok) return code;
  if (findProject(existing, code.value)) return fail('duplicate_project', `${code.value} は登録済みです (大文字小文字を区別しません)`);
  const name = validateName(draft.name);
  if (!name.ok) return name;
  const repoPath = normalizeRepoPath(draft.repoPath);
  if (!repoPath.ok) return repoPath;
  const classification = validateClassification(draft.classification);
  if (!classification.ok) return classification;
  const bindings = validateBindings(draft.bindings);
  if (!bindings.ok) return bindings;
  return ok({
    code: code.value,
    name: name.value,
    repoPath: repoPath.value,
    classification: classification.value,
    bindings: bindings.value,
    registeredAt: at,
    updatedAt: at,
  });
}

/** Applies an update. The code never changes; `bindings`, when present, replaces the whole set. */
export function planUpdate(existing: readonly Project[], code: string, patch: ProjectPatch, at: string): Result<Project> {
  const current = findProject(existing, code);
  if (!current) return fail('project_not_found', `${code} は登録されていません`);
  let next: Project = { ...current, updatedAt: at };
  if (patch.name !== undefined) {
    const name = validateName(patch.name);
    if (!name.ok) return name;
    next = { ...next, name: name.value };
  }
  if (patch.repoPath !== undefined) {
    const repoPath = normalizeRepoPath(patch.repoPath);
    if (!repoPath.ok) return repoPath;
    next = { ...next, repoPath: repoPath.value };
  }
  if (patch.classification !== undefined) {
    const classification = validateClassification(patch.classification);
    if (!classification.ok) return classification;
    next = { ...next, classification: classification.value };
  }
  if (patch.bindings !== undefined) {
    const bindings = validateBindings(patch.bindings);
    if (!bindings.ok) return bindings;
    next = { ...next, bindings: bindings.value };
  }
  return ok(next);
}
