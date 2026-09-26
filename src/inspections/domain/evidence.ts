// @implements SPEC-br-grading
/**
 * Normalised evidence per source. Extractors (pure) produce these from raw source data;
 * snapshots store them; stage and grade rules read only these. Locations are
 * repository-relative paths or API paths — never hosts, absolute paths or file names
 * that could carry personal data (BR-UX-4).
 */

/** A file inside the target repository: repo-relative path and modification time. */
export interface FileFact {
  readonly path: string;
  readonly modifiedAt: string;
}

export interface GitEvidence {
  readonly headSha: string;
  readonly headCommittedAt: string;
  /** null when HEAD is detached. */
  readonly branch: string | null;
  readonly tagCount: number;
}

export interface PraeformaEvidence {
  readonly projectId: string;
  readonly projectFound: boolean;
  readonly projectName: string | null;
  /** Text fields of the ux-goal definition; null when the goal could not be read. */
  readonly uxGoal: { readonly filled: readonly string[]; readonly empty: readonly string[] } | null;
  readonly domains: { readonly total: number; readonly described: number };
  readonly specs: {
    readonly total: number;
    readonly byStatus: Readonly<Record<string, number>>;
    readonly latestUpdatedAt: string | null;
  };
  readonly specVersion: string | null;
}

export interface DomainDeclarationFact {
  readonly path: string;
  readonly name: string | null;
  readonly parsed: boolean;
  readonly membershipCount: number;
  readonly modifiedAt: string;
}

export interface AnatomiaEvidence {
  readonly declarations: readonly DomainDeclarationFact[];
  readonly declaredCount: number;
  readonly unparsableCount: number;
  readonly membershipTotal: number;
  readonly latestDeclarationAt: string | null;
  readonly manifest: (FileFact & { readonly sourceRevision: string | null }) | null;
}

/** Stage-result status recorded in a plan document's front matter (`status:`), lower-cased. */
export interface PlanDocFact extends FileFact {
  readonly number: number;
  readonly status: string | null;
}

export interface OmnipotensSummaryFact extends FileFact {
  readonly overall: { readonly label: string | null; readonly score: number; readonly maxScore: number } | null;
  /** score / maxScore of every Vitia score row. */
  readonly vitiaRatios: readonly number[];
}

export interface RunPlanFact extends FileFact {
  readonly resolved: readonly string[];
  readonly notRequested: readonly string[];
}

export interface VitiaLensFact {
  readonly lens: string;
  readonly status: string;
  readonly score: number | null;
}

export interface VitiaAuditFact extends FileFact {
  readonly status: string;
  readonly lenses: readonly VitiaLensFact[];
  readonly blockedBy: readonly string[];
}

export interface DiPaperFact extends FileFact {
  readonly status: string | null;
  readonly updated: string | null;
  readonly questionCount: number;
  readonly positionCount: number;
}

export interface RepoArtifactsEvidence {
  readonly foundation: {
    readonly readme: FileFact | null;
    readonly productSpec: FileFact | null;
    readonly featureSpecCount: number;
  };
  /** `spec/plan/03〜11` (analysis stages) and `13〜26` (service areas); 12 is the Di paper. */
  readonly plans: readonly PlanDocFact[];
  readonly omnipotens: {
    readonly summary: OmnipotensSummaryFact | null;
    readonly runPlan: RunPlanFact | null;
    readonly finalReport: FileFact | null;
  };
  readonly vitiaAudit: VitiaAuditFact | null;
  readonly diPaper: DiPaperFact | null;
}

export interface VoluptasEvidence {
  readonly exists: boolean;
  readonly jsonFileCount: number;
  readonly latestModifiedAt: string | null;
  /** True when the walk hit its file limit, so the count is a lower bound. */
  readonly truncated: boolean;
}

export interface ElegantiaCounts {
  readonly none: number;
  readonly current: number;
  readonly historical_only: number;
  readonly passed: number;
  readonly failed: number;
  readonly blocked: number;
  readonly unverified: number;
  readonly not_applicable: number;
}

export interface ElegantiaEvidence {
  readonly product: string;
  readonly criteriaTotal: number;
  readonly counts: ElegantiaCounts;
  /** Passed results that also recorded `additionalAchieved`. */
  readonly additionalAchieved: number;
  readonly latestTestedAt: string | null;
  /** Distinct `context.build` values of the current results (at most 5). */
  readonly builds: readonly string[];
}

export type PrGroup = 'ready' | 'needs_review' | 'in_progress';

export interface PullRequestFact {
  readonly number: number;
  readonly title: string;
  readonly url: string | null;
  readonly createdAt: string | null;
  readonly mergedAt: string | null;
  readonly group: PrGroup | 'merged_recent';
}

export interface ConcordiaEvidence {
  readonly registered: boolean;
  readonly project: string | null;
  readonly flags: {
    readonly dddEnabled: boolean | null;
    readonly testsRequired: boolean | null;
    readonly domainReview: boolean | null;
    readonly contractEnabled: boolean | null;
  };
  readonly revisorWorkflow: string | null;
  readonly githubRepo: string | null;
  /** null when no GitHub repository is bound, so PRs were not asked for. */
  readonly pullRequests: { readonly open: readonly PullRequestFact[]; readonly merged: readonly PullRequestFact[] } | null;
}

/** Task counts keyed by Actio's own task status values (`todo` / `in_progress` / `review` / `done` / `cancelled` …). */
export type StatusCounts = Readonly<Record<string, number>>;

/**
 * Task counts of one sprint. Counts only: Actio's aggregate carries no task text, title,
 * assignee or task id, and neither does the evidence.
 */
export interface SprintTaskCounts {
  /** Whole sprint (every project's tasks in it). */
  readonly total: number;
  readonly byStatus: StatusCounts;
  /** Tasks of the requested project only. */
  readonly project: { readonly total: number; readonly byStatus: StatusCounts };
  readonly criticalPath: number;
  readonly byExecutor: { readonly human: number; readonly ai: number };
  /** Not finished and past their deadline. */
  readonly overdue: number;
  readonly estimatedMinutes: number | null;
  readonly doneMinutes: number | null;
}

export interface ActiveSprintFact {
  readonly id: string;
  readonly name: string;
  readonly goal: string | null;
  readonly status: string;
  /** Calendar dates `YYYY-MM-DD`. */
  readonly startsOn: string;
  readonly endsOn: string;
  readonly originalEndsOn: string | null;
  readonly bufferEndsOn: string | null;
  readonly cadenceDays: number | null;
  readonly capacityMinutes: number | null;
  readonly revision: number | null;
  readonly tasks: SprintTaskCounts;
}

export interface PlanningSprintFact {
  readonly id: string;
  readonly name: string;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
}

export interface ActioTeamFact {
  readonly teamId: string;
  readonly teamName: string;
  /** null when the team has no active sprint. */
  readonly activeSprint: ActiveSprintFact | null;
  readonly planningSprints: readonly PlanningSprintFact[];
  readonly backlogUnassigned: { readonly total: number; readonly project: number };
}

/** Actio's sprint aggregate for one Cc code (`GET /api/projects/cc/:code/sprints`), kept in the contract's shape. */
export interface ActioEvidence {
  /** The Cc code Actio answered for. */
  readonly project: string;
  readonly generatedAt: string;
  /** Teams assigned to the project; empty when none is. */
  readonly teams: readonly ActioTeamFact[];
}

/** Everything the stage and grade rules may read. A null entry means "no usable evidence". */
export interface EvidenceBundle {
  readonly git: GitEvidence | null;
  readonly praeforma: PraeformaEvidence | null;
  readonly anatomia: AnatomiaEvidence | null;
  readonly repoArtifacts: RepoArtifactsEvidence | null;
  readonly voluptas: VoluptasEvidence | null;
  readonly elegantia: ElegantiaEvidence | null;
  readonly concordia: ConcordiaEvidence | null;
  /** Sprints: graded (terpsichore) and shown, never tied to a workflow stage. */
  readonly actio: ActioEvidence | null;
}

export const EMPTY_BUNDLE: EvidenceBundle = {
  git: null,
  praeforma: null,
  anatomia: null,
  repoArtifacts: null,
  voluptas: null,
  elegantia: null,
  concordia: null,
  actio: null,
};
