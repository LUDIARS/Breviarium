// @implements SPEC-br-architecture
/** Time source. Injected so rules and use cases stay deterministic under test. */
export interface Clock {
  /** UTC ISO 8601 timestamp. */
  now(): string;
}

export const systemClock: Clock = {
  now: () => new Date().toISOString(),
};
