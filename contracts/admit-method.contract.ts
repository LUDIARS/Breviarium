// @implements SPEC-br-web-entrance
import type { admitMethod } from '../src/adapters/http/access-level.ts';
import type { ContractOf } from './contract-types.ts';

/** C-20: a viewer's non-GET/HEAD request gets 403 read_only_viewer; local and viewer reads are never refused. */
export default {
  post: (refusal, level, method) => {
    const read = method.toUpperCase() === 'GET' || method.toUpperCase() === 'HEAD';
    if (level === 'local' || read) return refusal === undefined ? true : 'refused an allowed method';
    return refusal?.status === 403 && refusal.body.includes('"read_only_viewer"') ? true : 'let a viewer write';
  },
} satisfies ContractOf<typeof admitMethod>;
