import type { AppDeps } from '../../src/adapters/http/app-deps.ts';
import { MemoryProjectStore, MemorySnapshotStore } from '../../src/adapters/storage/memory-stores.ts';
import type {
  AnatomiaEvidence,
  ConcordiaEvidence,
  ElegantiaEvidence,
  EvidenceBundle,
  GitEvidence,
  PraeformaEvidence,
  RepoArtifactsEvidence,
  VoluptasEvidence,
} from '../../src/inspections/domain/evidence.ts';
import type { Project } from '../../src/registry/domain/model.ts';
import type { Clock } from '../../src/shared/runtime.ts';
import { createRefresher } from '../../src/snapshots/application/refresh-use-case.ts';
import type { SourceId, SourceOutcome } from '../../src/snapshots/domain/model.ts';
import type { SourceAdapter, SourceRegistry } from '../../src/snapshots/ports.ts';
import { DEFAULT_STALE_POLICY } from '../../src/workflow/domain/staleness.ts';

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
  return { headSha: SHA, headCommittedAt: daysAgo(1), branch: 'main', tagCount: 1, ...overrides };
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
    ...overrides,
  };
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

export function fullBundle(overrides: Partial<EvidenceBundle> = {}): EvidenceBundle {
  return {
    git: git(),
    praeforma: praeforma(),
    anatomia: anatomia(),
    repoArtifacts: repoArtifacts(),
    voluptas: voluptas(),
    elegantia: elegantia(),
    concordia: concordia(),
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
  anatomia: anatomia(),
  'repo-artifacts': repoArtifacts(),
  voluptas: voluptas(),
  elegantia: elegantia(),
  concordia: concordia(),
};

export function okSources(): Record<SourceId, SourceAdapter & { calls: number }> {
  const make = (id: SourceId) => scriptedSource(id, [{ kind: 'ok', data: EVIDENCE[id], subject: `${id}:subject` }]);
  return {
    git: make('git'),
    praeforma: make('praeforma'),
    anatomia: make('anatomia'),
    'repo-artifacts': make('repo-artifacts'),
    voluptas: make('voluptas'),
    elegantia: make('elegantia'),
    concordia: make('concordia'),
  };
}

export function testDeps(sources: SourceRegistry = okSources()) {
  const projects = new MemoryProjectStore();
  const snapshots = new MemorySnapshotStore();
  const clock = fixedClock();
  const refresh = createRefresher({ projects, snapshots, sources, clock });
  const deps: AppDeps = {
    registry: { projects, cleanup: snapshots, clock },
    overview: { projects, snapshots, clock, policy: { stale: DEFAULT_STALE_POLICY, snapshotMaxAgeMs: 24 * 3_600_000 } },
    refresh,
  };
  return { deps, projects, snapshots, clock, sources };
}
