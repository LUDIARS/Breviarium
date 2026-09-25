// @implements SPEC-br-web-entrance
import type { readPublicOrigin } from '../src/adapters/config/public-origin.ts';
import type { ContractOf } from './contract-types.ts';

/** C-16: only an exact HTTPS origin (no path, credentials or query) comes back, and blank means unset. */
export default {
  post: (origin, value) => {
    const raw = value?.trim();
    if (origin === undefined) return raw ? 'dropped a configured public URL' : true;
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      return 'returned something that is not a URL';
    }
    if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) return 'returned something other than an exact HTTPS origin';
    return origin === raw ? true : 'returned a value other than the configured origin';
  },
} satisfies ContractOf<typeof readPublicOrigin>;
