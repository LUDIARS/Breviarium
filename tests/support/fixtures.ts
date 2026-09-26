import type { AppDeps } from '../../src/adapters/http/app-deps.ts';
import { MemoryProjectStore, MemorySnapshotStore } from '../../src/adapters/storage/memory-stores.ts';
import type {
  ActioEvidence,
  ActioTeamFact,
  ActiveSprintFact,
  AnatomiaCoverageEvidence,
  AnatomiaEvidence,
  ConcordiaEvidence,
  DomainReviewsEvidence,
  ElegantiaEvidence,
  EvidenceBundle,
  ExcubitorEvidence,
  GitEvidence,
  GithubReleasesEvidence,
  MembershipCoverage,
  PraeformaAcceptanceEvidence,
  PraeformaEvidence,
  RepoArtifactsEvidence,
  RevisorEvidence,
  SprintTaskCounts,
  VoluptasEvidence,
} from '../../src/inspections/domain/evidence.ts';
import type { Project } from '../../src/registry/domain/model.ts';
import type { Clock } from '../../src/shared/runtime.ts';
import { createRefresher } from '../../src/snapshots/application/refresh-use-case.ts';
import type { SourceId, SourceOutcome } from '../../src/snapshots/domain/model.ts';
import type { SourceAdapter, SourceRegistry } from '../../src/snapshots/ports.ts';

export const NOW = '2026-09-26T00:00:00.000Z';
export const DAY = 86_400_000;

export function daysAgo(days: number, from = NOW): string {
  return new Date(Date.parse(from) - days * DAY).toISOString();
}

export function fixedClock(iso = NOW): Clock & { set(next: string): void } {
  let current = iso;
  return { now: () => current, set: (next) => (current = next) };
}

export function project(overrides: Partial<Project> = {}): Project {
  return {
    code: 'Br',
    name: 'Breviarium',
    repoPath: 'E:/Work/Breviarium',
    classification: 'internal',
    bindings: { praeformaProjectId: 'PF01', elegantiaProduct: 'breviarium', voluptasPath: 'nyangame', githubRepo: 'LUDIARS/Breviarium' },
    registeredAt: daysAgo(10),
    updatedAt: daysAgo(10),
    ...overrides,
  };
}

export const SHA = 'a'.repeat(40);

export function git(overrides: Partial<GitEvidence> = {}): GitEvidence {
  return { headSha: SHA, headCommittedAt: daysAgo(1), branch: 'main', tagCount: 1, latestVersionTag: null, origin: { host: 'github.com' }, ...overrides };
}

export function praeforma(overrides: Partial<PraeformaEvidence> = {}): PraeformaEvidence {
  return {
    projectId: 'PF01',
    projectFound: true,
    projectName: 'Breviarium',
    uxGoal: { filled: ['experience', 'design', 'goal'], empty: ['story', 'emotions'] },
    domains: { total: 4, described: 4 },
    specs: { total: 10, byStatus: { draft: 1, confirmed: 9 }, latestUpdatedAt: daysAgo(2) },
    specVersion: '0.0.13',
    ...overrides,
  };
}

export function anatomia(overrides: Partial<AnatomiaEvidence> = {}): AnatomiaEvidence {
  return {
    declarations: [
      { path: 'spec/domains/a.domain.json', name: 'a', parsed: true, membershipCount: 3, modifiedAt: daysAgo(3) },
      { path: 'spec/domains/b.domain.json', name: 'b', parsed: true, membershipCount: 2, modifiedAt: daysAgo(3) },
    ],
    declaredCount: 2,
    unparsableCount: 0,
    membershipTotal: 5,
    latestDeclarationAt: daysAgo(3),
    manifest: { path: 'spec/data/generated/anatomia/manifest.json', modifiedAt: daysAgo(2), sourceRevision: 'sha256:x' },
    membership: membership(),
    ...overrides,
  };
}

/** The declarations' pathPatterns against the git index: 38 of 40 implementation files in a domain (0.95 → A). */
export function membership(overrides: Partial<MembershipCoverage> = {}): MembershipCoverage {
  return { domains: 2, pathPatterns: 5, invalidPatterns: 0, implementationFiles: 40, matchedFiles: 38, ...overrides };
}

export function repoArtifacts(overrides: Partial<RepoArtifactsEvidence> = {}): RepoArtifactsEvidence {
  return {
    foundation: { readme: { path: 'README.md', modifiedAt: daysAgo(20) }, productSpec: { path: 'spec/ux/product.md', modifiedAt: daysAgo(20) }, featureSpecCount: 3 },
    plans: [
      { path: 'spec/plan/03-ludus-analysis.md', number: 3, status: 'complete', modifiedAt: daysAgo(6) },
      { path: 'spec/plan/10-ux-review.md', number: 10, status: 'partial', modifiedAt: daysAgo(6) },
      { path: 'spec/plan/11-vitia-marketability.md', number: 11, status: 'complete', modifiedAt: daysAgo(6) },
      { path: 'spec/plan/15-service-operations.md', number: 15, status: 'blocked', modifiedAt: daysAgo(6) },
    ],
    omnipotens: {
      summary: { path: 'spec/data/omnipotens-summary.json', modifiedAt: daysAgo(5), overall: { label: '有望', score: 7, maxScore: 10 }, vitiaRatios: [0.8, 0.6] },
      runPlan: { path: 'spec/data/omnipotens-run-plan.json', modifiedAt: daysAgo(6), resolved: ['core.report'], notRequested: ['svc.legal'] },
      finalReport: { path: 'report/omnipotens-final.html', modifiedAt: daysAgo(5) },
    },
    vitiaAudit: {
      path: 'spec/data/vitia-game-experience-audit.json',
      modifiedAt: daysAgo(6),
      status: 'exploratory',
      lenses: [
        { lens: 'play_promise', status: 'supported', score: 0.8 },
        { lens: 'repeat_value', status: 'not_observed', score: null },
      ],
      blockedBy: [],
    },
    diPaper: { path: 'spec/plan/12-di-discussion-paper.md', modifiedAt: daysAgo(4), status: 'complete', updated: '2026-09-22', questionCount: 3, positionCount: 2 },
    serviceCatalog: { path: 'excubitor.catalog.yaml', modifiedAt: daysAgo(20), services: [{ code: 'br', dependsOn: [], declarations: ['required_env', 'provides'] }] },
    ...overrides,
  };
}

export function voluptas(overrides: Partial<VoluptasEvidence> = {}): VoluptasEvidence {
  return { exists: true, jsonFileCount: 12, latestModifiedAt: daysAgo(3), truncated: false, ...overrides };
}

export function elegantia(overrides: Partial<ElegantiaEvidence> = {}): ElegantiaEvidence {
  return {
    product: 'breviarium',
    criteriaTotal: 10,
    counts: { none: 0, current: 10, historical_only: 0, passed: 8, failed: 1, blocked: 0, unverified: 1, not_applicable: 0 },
    additionalAchieved: 3,
    latestTestedAt: daysAgo(3),
    builds: ['build-1'],
    ...overrides,
  };
}

export function concordia(overrides: Partial<ConcordiaEvidence> = {}): ConcordiaEvidence {
  return {
    registered: true,
    project: 'Breviarium',
    flags: { dddEnabled: true, testsRequired: true, domainReview: true, contractEnabled: false },
    revisorWorkflow: 'revisor',
    githubRepo: 'LUDIARS/Breviarium',
    pullRequests: {
      open: [],
      merged: [{ number: 5, title: 'fix', url: null, createdAt: daysAgo(2.5), mergedAt: daysAgo(2), group: 'merged_recent' }],
    },
    ...overrides,
  };
}

/** Pf acceptance summary: 16 of 19 decided results passed (0.84 → B), one pending. */
export function praeformaAcceptance(overrides: Partial<PraeformaAcceptanceEvidence> = {}): PraeformaAcceptanceEvidence {
  return {
    projectId: 'PF01',
    runs: { total: 3, byStatus: { completed: 3 } },
    latestRun: { status: 'completed', startedAt: daysAgo(2.1), finishedAt: daysAgo(2), version: '0.0.13' },
    results: { total: 20, passed: 16, failed: 2, blocked: 1, pending: 1 },
    specVersion: '0.0.13',
    ...overrides,
  };
}

/** Anatomia program domains: 570 of 600 symbols in a declared layer (0.95 → A). */
export function anatomiaCoverage(overrides: Partial<AnatomiaCoverageEvidence> = {}): AnatomiaCoverageEvidence {
  return {
    project: 'br',
    layersDeclared: true,
    modules: { total: 25, classified: 20 },
    symbols: { total: 600, classified: 570 },
    domainCount: 5,
    ...overrides,
  };
}

/**
 * Revisor: registered, not released yet (version file uninitialized); the newest merge passed the
 * Anatomia gate with one advisory (B); the worst band is high (C).
 */
export function revisor(overrides: Partial<RevisorEvidence> = {}): RevisorEvidence {
  return {
    repository: 'LUDIARS/Breviarium',
    registered: true,
    localVersion: 'uninitialized',
    merged: [
      { number: 12, mergedAt: daysAgo(0.5), mergeCommit: 'b'.repeat(40), anatomiaGate: { status: 'passed', advisoryCount: 1 }, mergeRisk: { band: 'low', score: 14 } },
      { number: 11, mergedAt: daysAgo(1), mergeCommit: null, anatomiaGate: { status: 'passed', advisoryCount: 2 }, mergeRisk: { band: 'high', score: 48 } },
    ],
    ...overrides,
  };
}

/** GitHub Releases of LUDIARS/Breviarium: none published yet (not released). */
export function githubReleases(overrides: Partial<GithubReleasesEvidence> = {}): GithubReleasesEvidence {
  return { repository: 'LUDIARS/Breviarium', releases: [], ...overrides };
}

/** Cc domain-review posts: three posts, the newest five days ago (within the 30-day threshold). */
export function domainReviews(overrides: Partial<DomainReviewsEvidence> = {}): DomainReviewsEvidence {
  return { code: 'Br', postCount: 3, latestPostedAt: daysAgo(5), ...overrides };
}

/** Excubitor: the service is in the catalog, stopped and not on autostart (not operated), its env-config ready. */
export function excubitor(overrides: Partial<ExcubitorEvidence> = {}): ExcubitorEvidence {
  return { service: 'br', found: true, state: 'stopped', autostart: false, serviceCodes: ['br', 'actio'], envConfig: { ready: true, missingCount: 0 }, ...overrides };
}

/** Actio's contract example (`GET /api/projects/cc/KD/sprints`), as Actio sends it. */
export function actioResponse(): Record<string, unknown> {
  return {
    project: 'KD',
    generatedAt: '2026-09-26T03:00:00.000Z',
    teams: [
      {
        teamId: 'team_x',
        teamName: 'KonbiniDominant',
        activeSprint: {
          id: 'sprint_x',
          name: 'Sprint 12',
          goal: 'goal text',
          status: 'active',
          startsOn: '2026-09-22',
          endsOn: '2026-10-05',
          originalEndsOn: '2026-10-05',
          bufferEndsOn: '2026-10-07',
          cadenceDays: 14,
          capacityMinutes: 4800,
          revision: 3,
          tasks: {
            total: 18,
            byStatus: { todo: 6, in_progress: 4, review: 2, done: 6 },
            project: { total: 7, byStatus: { todo: 2, in_progress: 2, review: 1, done: 2 } },
            criticalPath: 3,
            byExecutor: { human: 10, ai: 8 },
            overdue: 1,
            estimatedMinutes: 4200,
            doneMinutes: 1500,
          },
        },
        planningSprints: [{ id: 'sprint_y', name: 'Sprint 13', startsOn: '2026-10-06', endsOn: '2026-10-19' }],
        backlogUnassigned: { total: 25, project: 9 },
      },
    ],
  };
}

export function sprintTasks(overrides: Partial<SprintTaskCounts> = {}): SprintTaskCounts {
  return {
    total: 18,
    byStatus: { todo: 6, in_progress: 4, review: 2, done: 6 },
    project: { total: 7, byStatus: { todo: 2, in_progress: 2, review: 1, done: 2 } },
    criticalPath: 3,
    byExecutor: { human: 10, ai: 8 },
    overdue: 1,
    estimatedMinutes: 4200,
    doneMinutes: 1500,
    ...overrides,
  };
}

export function activeSprint(overrides: Partial<ActiveSprintFact> = {}): ActiveSprintFact {
  return {
    id: 'sprint_x',
    name: 'Sprint 12',
    goal: 'goal text',
    status: 'active',
    startsOn: '2026-09-22',
    endsOn: '2026-10-05',
    originalEndsOn: '2026-10-05',
    bufferEndsOn: '2026-10-07',
    cadenceDays: 14,
    capacityMinutes: 4800,
    revision: 3,
    tasks: sprintTasks(),
    ...overrides,
  };
}

export function actioTeam(overrides: Partial<ActioTeamFact> = {}): ActioTeamFact {
  return {
    teamId: 'team_x',
    teamName: 'KonbiniDominant',
    activeSprint: activeSprint(),
    planningSprints: [{ id: 'sprint_y', name: 'Sprint 13', startsOn: '2026-10-06', endsOn: '2026-10-19' }],
    backlogUnassigned: { total: 25, project: 9 },
    ...overrides,
  };
}

/** Actio evidence counted on 2026-09-26 (JST): Sprint 12 is 4 of 13 days in, the project 2/7 done, 1 overdue → C. */
export function actio(overrides: Partial<ActioEvidence> = {}): ActioEvidence {
  return { project: 'KD', generatedAt: '2026-09-26T03:00:00.000Z', teams: [actioTeam()], ...overrides };
}

export function fullBundle(overrides: Partial<EvidenceBundle> = {}): EvidenceBundle {
  return {
    git: git(),
    praeforma: praeforma(),
    praeformaAcceptance: praeformaAcceptance(),
    anatomia: anatomia(),
    anatomiaCoverage: anatomiaCoverage(),
    repoArtifacts: repoArtifacts(),
    voluptas: voluptas(),
    elegantia: elegantia(),
    concordia: concordia(),
    domainReviews: domainReviews(),
    revisor: revisor(),
    githubReleases: githubReleases(),
    actio: actio(),
    excubitor: excubitor(),
    ...overrides,
  };
}

/** A source adapter answering from a queue of outcomes (last one repeats) and counting calls. */
export function scriptedSource(id: SourceId, outcomes: readonly (SourceOutcome | Error)[]): SourceAdapter & { calls: number } {
  const adapter = {
    id,
    calls: 0,
    async fetch(): Promise<SourceOutcome> {
      const next = outcomes[Math.min(adapter.calls, outcomes.length - 1)] as SourceOutcome | Error;
      adapter.calls++;
      if (next instanceof Error) throw next;
      return next;
    },
  };
  return adapter;
}

const EVIDENCE: Readonly<Record<SourceId, unknown>> = {
  git: git(),
  praeforma: praeforma(),
  'praeforma-acceptance': praeformaAcceptance(),
  anatomia: anatomia(),
  'anatomia-cli': anatomiaCoverage(),
  'repo-artifacts': repoArtifacts(),
  voluptas: voluptas(),
  elegantia: elegantia(),
  concordia: concordia(),
  'concordia-reviews': domainReviews(),
  revisor: revisor(),
  'github-releases': githubReleases(),
  actio: actio(),
  excubitor: excubitor(),
};

export function okSources(): Record<SourceId, SourceAdapter & { calls: number }> {
  const make = (id: SourceId) => scriptedSource(id, [{ kind: 'ok', data: EVIDENCE[id], subject: `${id}:subject` }]);
  return {
    git: make('git'),
    praeforma: make('praeforma'),
    'praeforma-acceptance': make('praeforma-acceptance'),
    anatomia: make('anatomia'),
    'anatomia-cli': make('anatomia-cli'),
    'repo-artifacts': make('repo-artifacts'),
    voluptas: make('voluptas'),
    elegantia: make('elegantia'),
    concordia: make('concordia'),
    'concordia-reviews': make('concordia-reviews'),
    revisor: make('revisor'),
    'github-releases': make('github-releases'),
    actio: make('actio'),
    excubitor: make('excubitor'),
  };
}

export function testDeps(sources: SourceRegistry = okSources()) {
  const projects = new MemoryProjectStore();
  const snapshots = new MemorySnapshotStore();
  const clock = fixedClock();
  const refresh = createRefresher({ projects, snapshots, sources, clock });
  const deps: AppDeps = {
    registry: { projects, cleanup: snapshots, clock },
    overview: { projects, snapshots, clock, policy: { snapshotMaxAgeMs: 24 * 3_600_000 } },
    refresh,
  };
  return { deps, projects, snapshots, clock, sources };
}
