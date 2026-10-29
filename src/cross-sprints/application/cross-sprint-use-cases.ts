// @implements SPEC-br-cross-sprints
import type { ActioEvidence } from '../../inspections/domain/evidence.ts';
import { findProject } from '../../registry/domain/registration-rules.ts';
import type { ProjectStore } from '../../registry/ports.ts';
import { fail, ok, type Result } from '../../shared/result.ts';
import type { Clock } from '../../shared/runtime.ts';
import { usableData } from '../../snapshots/domain/snapshot-rules.ts';
import type { SnapshotStore } from '../../snapshots/ports.ts';
import { buildCrossSprintBoard, type CrossSprintBoard } from '../domain/cross-sprint-board.ts';
import { findCrossSprint, planCrossSprint, planCrossSprintUpdate } from '../domain/cross-sprint-rules.ts';
import type { CrossSprint, CrossSprintDraft, CrossSprintPatch } from '../domain/model.ts';
import type { CrossSprintStore } from '../ports.ts';

/** Reads the project register and snapshots only; like every view it never reaches a source (BR-UX-3). */
export interface CrossSprintDeps {
  readonly crossSprints: CrossSprintStore;
  readonly projects: ProjectStore;
  readonly snapshots: SnapshotStore;
  readonly clock: Clock;
}

export async function listCrossSprints(deps: CrossSprintDeps): Promise<readonly CrossSprint[]> {
  return [...(await deps.crossSprints.list())].sort((a, b) => a.code.localeCompare(b.code));
}

export async function getCrossSprint(deps: CrossSprintDeps, code: string): Promise<Result<CrossSprint>> {
  const found = findCrossSprint(await deps.crossSprints.list(), code);
  return found ? ok(found) : fail('cross_sprint_not_found', `${code} は登録されていません`);
}

export async function registerCrossSprint(deps: CrossSprintDeps, draft: CrossSprintDraft): Promise<Result<CrossSprint>> {
  const planned = planCrossSprint(await deps.crossSprints.list(), await deps.projects.list(), draft, deps.clock.now());
  if (planned.ok) await deps.crossSprints.put(planned.value);
  return planned;
}

export async function updateCrossSprint(deps: CrossSprintDeps, code: string, patch: CrossSprintPatch): Promise<Result<CrossSprint>> {
  const planned = planCrossSprintUpdate(await deps.crossSprints.list(), await deps.projects.list(), code, patch, deps.clock.now());
  if (planned.ok) await deps.crossSprints.put(planned.value);
  return planned;
}

export async function removeCrossSprint(deps: CrossSprintDeps, code: string): Promise<Result<{ readonly code: string }>> {
  const found = findCrossSprint(await deps.crossSprints.list(), code);
  if (!found) return fail('cross_sprint_not_found', `${code} は登録されていません`);
  await deps.crossSprints.remove(found.code);
  return ok({ code: found.code });
}

/** The cross-project sprint board, from the related projects' cached `actio` snapshots. */
export async function loadCrossSprintBoard(deps: CrossSprintDeps, code: string): Promise<Result<CrossSprintBoard>> {
  const found = await getCrossSprint(deps, code);
  if (!found.ok) return found;
  const projects = await deps.projects.list();
  const related = await Promise.all(
    found.value.related.map(async (relatedCode) => {
      const project = findProject(projects, relatedCode);
      const actio = project ? (usableData(await deps.snapshots.get(project.code, 'actio')) as ActioEvidence | null) : null;
      return { code: relatedCode, project, actio };
    }),
  );
  return ok(buildCrossSprintBoard(found.value, related));
}

/** Boards of every cross-project sprint, for the list page. */
export async function loadCrossSprintBoards(deps: CrossSprintDeps): Promise<readonly CrossSprintBoard[]> {
  const boards = await Promise.all((await listCrossSprints(deps)).map((s) => loadCrossSprintBoard(deps, s.code)));
  return boards.flatMap((b) => (b.ok ? [b.value] : []));
}
