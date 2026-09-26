// @implements SPEC-br-grading
/**
 * Normalised evidence per source. Extractors (pure) produce these from raw source data;
 * snapshots store them; workflow and grade rules read only these. Locations are
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
  /** Newest tag (by creation date) named `v` plus a digit (`v1.2.0`); null when there is none. */
  readonly latestVersionTag: string | null;
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

/** Praeforma's acceptance summary (`GET /api/projects/:pid/acceptance/summary`): counts, run status and times only. */
export interface PraeformaAcceptanceEvidence {
  readonly projectId: string;
  readonly runs: { readonly total: number; readonly byStatus: Readonly<Record<string, number>> };
  /** null when Pf has no acceptance run for the project. */
  readonly latestRun: {
    readonly status: string | null;
    readonly startedAt: string | null;
    readonly finishedAt: string | null;
    readonly version: string | null;
  } | null;
  readonly results: { readonly total: number; readonly passed: number; readonly failed: number; readonly blocked: number; readonly pending: number };
  readonly specVersion: string | null;
}

/**
 * Program-domain classification from `anatomia domains program --json`: counts only. The CLI's
 * file lists, module ids and repository path are not kept.
 */
export interface AnatomiaCoverageEvidence {
  /** Anatomia project id the CLI was asked for. */
  readonly project: string;
  /** Whether the project declares its layers (`.anatomia/layers.json`); null when the output did not say. */
  readonly layersDeclared: boolean | null;
  /** Modules / symbols in total and those classified into a declared domain layer. */
  readonly modules: { readonly total: number; readonly classified: number };
  readonly symbols: { readonly total: number; readonly classified: number };
  readonly domainCount: number | null;
}

/** One merged Revisor PR as `revisor pr show <n> --json` reports it: the Anatomia gate and the merge risk only. */
export interface MergedPrReviewFact {
  readonly number: number;
  readonly mergedAt: string | null;
  /** Merge commit sha, when Revisor recorded one. */
  readonly mergeCommit: string | null;
  /** null when the PR carries no Anatomia gate result. Status is Revisor's lower-case value (`passed` / `failed` …). */
  readonly anatomiaGate: { readonly status: string; readonly advisoryCount: number } | null;
  /** null when the PR carries no merge-risk band. Band is Revisor's lower-case value (`low` … `critical`). */
  readonly mergeRisk: { readonly band: string; readonly score: number | null } | null;
}

export interface RevisorEvidence {
  /** GitHub repository (`owner/name`) the PRs belong to. */
  readonly repository: string;
  /** Whether `revisor repo list --json` has the repository (Revisor registration). */
  readonly registered: boolean;
  /**
   * `.revisor-version` as `revisor version show` reads it: `MAJOR.MINOR.PATCH` once Revisor released the
   * project, `uninitialized` before; null when Revisor could not read it (the checkout is not version-managed).
   */
  readonly localVersion: string | null;
  /** The newest merged PRs, newest first by mergedAt. */
  readonly merged: readonly MergedPrReviewFact[];
}

/**
 * The project's service in Excubitor's catalog (`GET /api/v1/services`): presence, state and autostart
 * only. Host, pid, port, paths and the catalog entry itself are not kept.
 */
export interface ExcubitorEvidence {
  /** Service code looked up (`bindings.excubitorService`, or the lower-case registered code). */
  readonly service: string;
  readonly found: boolean;
  /** Excubitor's lower-case instance state (`running` / `stopped` / `crashed` / `unknown` …); null when not found. */
  readonly state: string | null;
  /** The catalog's `autostart`; null when not found or not stated. */
  readonly autostart: boolean | null;
}

/** Concordia's domain-review posts for one Cc code (`GET /v1/domain-review/posts`): count and newest time only. */
export interface DomainReviewsEvidence {
  readonly code: string;
  readonly postCount: number;
  readonly latestPostedAt: string | null;
}

/** Everything the workflow and grade rules may read. A null entry means "no usable evidence". */
export interface EvidenceBundle {
  readonly git: GitEvidence | null;
  readonly praeforma: PraeformaEvidence | null;
  readonly praeformaAcceptance: PraeformaAcceptanceEvidence | null;
  readonly anatomia: AnatomiaEvidence | null;
  readonly anatomiaCoverage: AnatomiaCoverageEvidence | null;
  readonly repoArtifacts: RepoArtifactsEvidence | null;
  readonly voluptas: VoluptasEvidence | null;
  readonly elegantia: ElegantiaEvidence | null;
  readonly concordia: ConcordiaEvidence | null;
  readonly domainReviews: DomainReviewsEvidence | null;
  readonly revisor: RevisorEvidence | null;
  /** Sprints: graded (terpsichore), shown, and the frame of the workflow's PDCA loop and lifecycle. */
  readonly actio: ActioEvidence | null;
  /** The project's Excubitor service: whether it is operated (lifecycle `operating`). */
  readonly excubitor: ExcubitorEvidence | null;
}

export const EMPTY_BUNDLE: EvidenceBundle = {
  git: null,
  praeforma: null,
  praeformaAcceptance: null,
  anatomia: null,
  anatomiaCoverage: null,
  repoArtifacts: null,
  voluptas: null,
  elegantia: null,
  concordia: null,
  domainReviews: null,
  revisor: null,
  actio: null,
  excubitor: null,
};
