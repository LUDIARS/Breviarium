// @implements SPEC-br-cross-sprints
/**
 * A cross-project sprint (横断スプリント): one Actio team whose sprints span several registered
 * projects, plus the projects related to it (関連). Breviarium only records which team and which
 * projects belong together; the sprints themselves stay in Actio (read through the `actio` snapshots).
 */
export interface CrossSprint {
  /** Short name, same form as a Cc code (`GLab`). Unique ignoring case. */
  readonly code: string;
  readonly name: string;
  /** Actio team id whose sprints these are (`team_…`). */
  readonly actioTeamId: string;
  /** Registered project codes related to the sprint (関連), in display order. */
  readonly related: readonly string[];
  readonly registeredAt: string;
  readonly updatedAt: string;
}

/** Unvalidated input from the API. */
export interface CrossSprintDraft {
  readonly code: string;
  readonly name: string;
  readonly actioTeamId: string;
  readonly related?: readonly string[];
}

/** Unvalidated update. `related`, when given, replaces the whole list. */
export interface CrossSprintPatch {
  readonly name?: string;
  readonly actioTeamId?: string;
  readonly related?: readonly string[];
}

export const MAX_RELATED = 50;
