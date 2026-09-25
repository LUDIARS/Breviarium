// @implements SPEC-br-web-entrance
import type { renderProjectPage } from '../src/adapters/http/html/project-page.ts';
import type { ContractOf } from './contract-types.ts';

const VIEWER_LABEL = '閲覧のみ (Cloudflare Access)';

/** C-21: a viewer's project page has no POST form (refresh / edit / delete) and says it is read-only. */
export default {
  post: (html, _overview, _notice, level) => {
    const writable = /<form\b[^>]*method="post"/i.test(html);
    const labelled = html.includes(VIEWER_LABEL);
    if (level === 'viewer') return !writable && labelled ? true : 'viewer page offers a write form or lacks the read-only label';
    return labelled ? 'local page carries the viewer label' : true;
  },
} satisfies ContractOf<typeof renderProjectPage>;
