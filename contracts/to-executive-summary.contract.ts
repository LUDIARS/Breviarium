// @implements SPEC-br-web-ui
import type { toExecutiveSummary } from '../src/adapters/http/export/summary-json.ts';
import type { ContractOf } from './contract-types.ts';

/** C-11: exports carry no repoPath, Voluptas path, snapshot subject or error text; internal projects carry the sharing notice. */
export default {
  post: (summary, overview) => {
    const text = JSON.stringify(summary);
    if (text.includes(JSON.stringify(overview.project.repoPath).slice(1, -1))) return 'summary exposes the local repoPath';
    const voluptas = overview.project.bindings.voluptasPath;
    if (voluptas && text.includes(voluptas)) return 'summary exposes the Voluptas path';
    for (const s of overview.sources) {
      if (s.subject && text.includes(JSON.stringify(s.subject).slice(1, -1))) return `summary exposes the ${s.source} subject`;
      if (s.error && text.includes(JSON.stringify(s.error).slice(1, -1))) return `summary exposes the ${s.source} error text`;
    }
    const internal = overview.project.classification === 'internal';
    if (internal !== (summary.notice !== null)) return 'sharing notice does not follow the classification';
    return true;
  },
} satisfies ContractOf<typeof toExecutiveSummary>;
