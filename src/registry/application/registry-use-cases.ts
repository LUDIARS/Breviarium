// @implements SPEC-br-registry
import { fail, ok, type Result } from '../../shared/result.ts';
import type { Clock } from '../../shared/runtime.ts';
import type { Project, ProjectDraft, ProjectPatch } from '../domain/model.ts';
import { planRegistration, planUpdate } from '../domain/registration-rules.ts';
import type { ProjectCleanup, ProjectStore } from '../ports.ts';

export interface RegistryDeps {
  readonly projects: ProjectStore;
  readonly cleanup: ProjectCleanup;
  readonly clock: Clock;
}

export async function listProjects(deps: RegistryDeps): Promise<readonly Project[]> {
  const projects = await deps.projects.list();
  return [...projects].sort((a, b) => a.code.localeCompare(b.code));
}

export async function getProject(deps: RegistryDeps, code: string): Promise<Result<Project>> {
  const project = await deps.projects.get(code);
  return project ? ok(project) : fail('project_not_found', `${code} は登録されていません`);
}

export async function registerProject(deps: RegistryDeps, draft: ProjectDraft): Promise<Result<Project>> {
  const planned = planRegistration(await deps.projects.list(), draft, deps.clock.now());
  if (planned.ok) await deps.projects.put(planned.value);
  return planned;
}

export async function updateProject(deps: RegistryDeps, code: string, patch: ProjectPatch): Promise<Result<Project>> {
  const planned = planUpdate(await deps.projects.list(), code, patch, deps.clock.now());
  if (planned.ok) await deps.projects.put(planned.value);
  return planned;
}

/** Removes the registration and its cached snapshots (they can be fetched again). */
export async function removeProject(deps: RegistryDeps, code: string): Promise<Result<{ readonly code: string }>> {
  const project = await deps.projects.get(code);
  if (!project) return fail('project_not_found', `${code} は登録されていません`);
  await deps.projects.remove(project.code);
  await deps.cleanup.purgeProject(project.code);
  return ok({ code: project.code });
}
