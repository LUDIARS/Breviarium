// @implements SPEC-br-web-ui
import type { esc } from '../src/adapters/http/html/escape.ts';
import type { ContractOf } from './contract-types.ts';

/** C-15: escaped text contains no raw markup character. */
export default {
  post: (out) => (/[<>"']/.test(out) ? 'raw markup character in escaped output' : true),
} satisfies ContractOf<typeof esc>;
