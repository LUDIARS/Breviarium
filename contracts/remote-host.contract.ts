// @implements SPEC-br-grading
import type { remoteHost } from '../src/inspections/extractors/git.ts';
import type { ContractOf } from './contract-types.ts';

/** C-49: only the host name of a remote URL is kept — never credentials, a path or the whole URL; a local path has none. */
export default {
  post: (host, url) => {
    if (host === null) return true;
    if (!/^[a-z0-9.-]+$/i.test(host)) return `kept more than a host name: ${host}`;
    if (host === url.trim()) return 'kept the whole remote URL';
    return url.includes(host) ? true : 'the host is not part of the remote URL';
  },
} satisfies ContractOf<typeof remoteHost>;
