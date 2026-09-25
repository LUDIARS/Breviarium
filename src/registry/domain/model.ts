// @implements SPEC-br-registry
/** Disclosure class of a registered project (BR-UX-4). */
export type Classification = 'public' | 'internal';

export const CLASSIFICATIONS: readonly Classification[] = ['public', 'internal'];

/** Where each source finds this project. Every key is optional; an absent key leaves that source not connected. */
export interface ProjectBindings {
  readonly praeformaProjectId?: string;
  readonly elegantiaProduct?: string;
  readonly voluptasPath?: string;
  readonly githubRepo?: string;
}

export const BINDING_KEYS = ['praeformaProjectId', 'elegantiaProduct', 'voluptasPath', 'githubRepo'] as const;

export type BindingKey = (typeof BINDING_KEYS)[number];

export interface Project {
  /** Cc project code (略称). Case is kept; uniqueness ignores case. */
  readonly code: string;
  readonly name: string;
  /** Absolute path of the local checkout, `/`-separated. Read only. */
  readonly repoPath: string;
  readonly classification: Classification;
  readonly bindings: ProjectBindings;
  readonly registeredAt: string;
  readonly updatedAt: string;
}

/** Unvalidated registration input as it arrives from the API or a form. */
export interface ProjectDraft {
  readonly code: string;
  readonly name: string;
  readonly repoPath: string;
  readonly classification: string;
  readonly bindings?: Readonly<Record<string, string | undefined>>;
}

/** Unvalidated update input. `bindings`, when given, replaces the whole set. */
export interface ProjectPatch {
  readonly name?: string;
  readonly repoPath?: string;
  readonly classification?: string;
  readonly bindings?: Readonly<Record<string, string | undefined>>;
}
