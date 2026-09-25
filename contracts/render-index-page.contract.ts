// @implements SPEC-br-web-entrance
import type { renderIndexPage } from '../src/adapters/http/html/index-page.ts';
import type { ContractOf } from './contract-types.ts';

const VIEWER_LABEL = '閲覧のみ (Cloudflare Access)';

/** C-22: a viewer's project list has no registration form and says it is read-only. */
export default {
  post: (html, _portfolio, _notice, level) => {
    const writable = /<form\b[^>]*method="post"/i.test(html);
    const labelled = html.includes(VIEWER_LABEL);
    if (level === 'viewer') return !writable && labelled ? true : 'viewer list offers the registration form or lacks the read-only label';
    return labelled ? 'local list carries the viewer label' : true;
  },
} satisfies ContractOf<typeof renderIndexPage>;
