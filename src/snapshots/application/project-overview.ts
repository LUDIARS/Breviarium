// @implements SPEC-br-snapshots
import { buildInspections } from '../../inspections/domain/build-inspections.ts';
import type {
  ActioEvidence,
  AnatomiaCoverageEvidence,
  AnatomiaEvidence,
  ConcordiaEvidence,
  DomainReviewsEvidence,
  ElegantiaEvidence,
  EvidenceBundle,
  GitEvidence,
  PraeformaAcceptanceEvidence,
  PraeformaEvidence,
  RepoArtifactsEvidence,
  RevisorEvidence,
  VoluptasEvidence,
} from '../../inspections/domain/evidence.ts';
import { summarizeTools } from '../../inspections/domain/grading.ts';
import type { Inspection, ToolSummary } from '../../inspections/domain/model.ts';
import { buildSprintBoard, type SprintBoard } from '../../inspections/domain/sprint-progress.ts';
import type { Project } from '../../registry/domain/model.ts';
import type { ProjectStore } from '../../registry/ports.ts';
import { fail, ok, type Result } from '../../shared/result.ts';
import type { Clock } from '../../shared/runtime.ts';
import { currentStage, evaluateStages, type StageResult } from '../../workflow/domain/stage-evaluation.ts';
import type { StalePolicy } from '../../workflow/domain/staleness.ts';
import { assessFreshness, type Freshness } from '../domain/freshness.ts';
import { type AttemptStatus, SOURCE_IDS, SOURCE_LABELS, type SourceId, type SourceSnapshot } from '../domain/model.ts';
import { usableData } from '../domain/snapshot-rules.ts';
import type { SnapshotStore } from '../ports.ts';

export interface OverviewPolicy {
  readonly stale: StalePolicy;
  readonly snapshotMaxAgeMs: number;
}

/** Read side deps. Deliberately holds no source adapter: views read snapshots only (BR-UX-3). */
export interface OverviewDeps {
  readonly projects: ProjectStore;
  readonly snapshots: SnapshotStore;
  readonly clock: Clock;
  readonly policy: OverviewPolicy;
}

export interface SourceView {
  readonly source: SourceId;
  readonly label: string;
  readonly status: AttemptStatus | null;
  readonly subject: string | null;
  readonly dataFetchedAt: string | null;
  readonly attemptedAt: string | null;
  readonly error: string | null;
  readonly freshness: Freshness;
}

export interface ProjectOverview {
  readonly project: Project;
  readonly generatedAt: string;
  readonly head: GitEvidence | null;
  readonly stages: readonly StageResult[];
  readonly currentStage: StageResult | null;
  readonly inspections: readonly Inspection[];
  readonly tools: readonly ToolSummary[];
  /** Sprint board from the Actio snapshot; null when there is none (not connected / never fetched). */
  readonly sprints: SprintBoard | null;
  readonly sources: readonly SourceView[];
  /** Sources whose snapshot is not fresh (stale or missing). */
  readonly staleSourceCount: number;
}

function find(snapshots: readonly SourceSnapshot[], source: SourceId): SourceSnapshot | undefined {
  return snapshots.find((s) => s.source === source);
}

/** Typed evidence from stored snapshots; data of an older shape counts as missing. */
export function bundleFrom(snapshots: readonly SourceSnapshot[]): EvidenceBundle {
  const data = (source: SourceId) => usableData(find(snapshots, source));
  return {
    git: data('git') as GitEvidence | null,
    praeforma: data('praeforma') as PraeformaEvidence | null,
    praeformaAcceptance: data('praeforma-acceptance') as PraeformaAcceptanceEvidence | null,
    anatomia: data('anatomia') as AnatomiaEvidence | null,
    anatomiaCoverage: data('anatomia-cli') as AnatomiaCoverageEvidence | null,
    repoArtifacts: data('repo-artifacts') as RepoArtifactsEvidence | null,
    voluptas: data('voluptas') as VoluptasEvidence | null,
    elegantia: data('elegantia') as ElegantiaEvidence | null,
    concordia: data('concordia') as ConcordiaEvidence | null,
    domainReviews: data('concordia-reviews') as DomainReviewsEvidence | null,
    revisor: data('revisor') as RevisorEvidence | null,
    actio: data('actio') as ActioEvidence | null,
  };
}

/** Pure composition of the executive-summary read model from one project's snapshots. */
export function composeOverview(project: Project, snapshots: readonly SourceSnapshot[], now: string, policy: OverviewPolicy): ProjectOverview {
  const bundle = bundleFrom(snapshots);
  const stages = evaluateStages(bundle, policy.stale, now);
  const inspections = buildInspections(bundle);
  const sources = SOURCE_IDS.map((source): SourceView => {
    const s = find(snapshots, source);
    return {
      source,
      label: SOURCE_LABELS[source],
      status: s?.status ?? null,
      subject: s?.subject ?? null,
      dataFetchedAt: s?.dataFetchedAt ?? null,
      attemptedAt: s?.attemptedAt ?? null,
      error: s?.error ?? null,
      freshness: assessFreshness(s, now, policy.snapshotMaxAgeMs),
    };
  });
  return {
    project,
    generatedAt: now,
    head: bundle.git,
    stages,
    currentStage: currentStage(stages),
    inspections,
    tools: summarizeTools(inspections),
    sprints: buildSprintBoard(bundle.actio),
    sources,
    staleSourceCount: sources.filter((s) => s.freshness.state !== 'fresh').length,
  };
}

export async function loadProjectOverview(deps: OverviewDeps, code: string): Promise<Result<ProjectOverview>> {
  const project = await deps.projects.get(code);
  if (!project) return fail('project_not_found', `${code} は登録されていません`);
  return ok(composeOverview(project, await deps.snapshots.listByProject(project.code), deps.clock.now(), deps.policy));
}

export async function loadPortfolio(deps: OverviewDeps): Promise<ProjectOverview[]> {
  const now = deps.clock.now();
  const projects = [...(await deps.projects.list())].sort((a, b) => a.code.localeCompare(b.code));
  return Promise.all(projects.map(async (p) => composeOverview(p, await deps.snapshots.listByProject(p.code), now, deps.policy)));
}
