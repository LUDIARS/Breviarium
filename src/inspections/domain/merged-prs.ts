// @implements SPEC-br-grading
/** How many of the newest merged PRs the verify and merge-risk inspections look at. */
export const MERGED_PR_LIMIT = 5;

/** Newest merge first; a PR without a merge time sorts last, ties by the higher PR number. */
export function newestMergedFirst<T extends { readonly number: number; readonly mergedAt: string | null }>(prs: readonly T[]): T[] {
  const time = (pr: T) => {
    const ms = pr.mergedAt ? Date.parse(pr.mergedAt) : Number.NaN;
    return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
  };
  return [...prs].sort((a, b) => time(b) - time(a) || b.number - a.number);
}

/** Location of one Revisor PR record: the CLI command that shows it (no host, no local path). */
export function revisorPrLocation(number: number): string {
  return `revisor pr show ${number}`;
}
