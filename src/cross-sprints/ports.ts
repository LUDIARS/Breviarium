// @implements SPEC-br-cross-sprints
import type { CrossSprint } from './domain/model.ts';

/** Persistence of the cross-project sprints (`data/cross-sprints.json`). Lookups ignore code case. */
export interface CrossSprintStore {
  list(): Promise<readonly CrossSprint[]>;
  put(crossSprint: CrossSprint): Promise<void>;
  remove(code: string): Promise<boolean>;
}
