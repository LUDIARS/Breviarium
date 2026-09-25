// @implements SPEC-br-snapshots
import type { composeOverview } from '../src/snapshots/application/project-overview.ts';
import { SOURCE_IDS } from '../src/snapshots/domain/model.ts';
import type { ContractOf } from './contract-types.ts';

/** C-10: the overview lists all 7 sources with exactly the fetch / attempt times stored in their snapshots. */
export default {
  post: (overview, project, snapshots) => {
    if (overview.project.code !== project.code) return 'overview of another project';
    if (overview.sources.length !== SOURCE_IDS.length) return 'not every source is listed';
    for (const view of overview.sources) {
      const s = snapshots.find((x) => x.source === view.source);
      if ((s?.dataFetchedAt ?? null) !== view.dataFetchedAt || (s?.attemptedAt ?? null) !== view.attemptedAt) return `${view.source} times differ from its snapshot`;
    }
    return true;
  },
} satisfies ContractOf<typeof composeOverview>;
