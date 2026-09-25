// @implements SPEC-br-grading
import type { pullRequestsFor } from '../src/inspections/extractors/concordia.ts';
import type { ContractOf } from './contract-types.ts';

type Row = { repo_origin?: unknown; number?: unknown };

/** C-6: every counted PR comes from the bound repository (`repo_origin` matches githubRepo). */
export default {
  post: (result, prs, githubRepo) => {
    if (!result.ok) return true;
    const grouped = ((prs as { grouped?: Record<string, unknown> } | null)?.grouped ?? {}) as Record<string, unknown>;
    const allowed = new Set<string>();
    for (const [group, rows] of Object.entries(grouped)) {
      if (!Array.isArray(rows)) continue;
      for (const row of rows as Row[]) {
        if (typeof row?.repo_origin === 'string' && row.repo_origin.toLowerCase() === githubRepo.toLowerCase()) allowed.add(`${group}#${String(row.number)}`);
      }
    }
    const counted = [...result.value.open, ...result.value.merged];
    return counted.every((pr) => allowed.has(`${pr.group}#${pr.number}`)) ? true : 'counted a PR of another repository';
  },
} satisfies ContractOf<typeof pullRequestsFor>;
