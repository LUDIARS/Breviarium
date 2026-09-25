// @implements SPEC-br-web-entrance
import type { acceptsClaims } from '../src/adapters/http/cloudflare-access-claims.ts';
import type { ContractOf } from './contract-types.ts';

/** C-18: claims are accepted exactly when iss, aud, exp (and nbf when present) match the configuration and the clock. */
export default {
  post: (accepted, payload, config, nowMs) => {
    const now = Math.floor(nowMs / 1000);
    const aud = payload['aud'];
    const exp = payload['exp'];
    const nbf = payload['nbf'];
    const expected =
      payload['iss'] === config.issuer &&
      (aud === config.audience || (Array.isArray(aud) && aud.includes(config.audience))) &&
      typeof exp === 'number' &&
      exp > now &&
      (nbf === undefined || (typeof nbf === 'number' && nbf <= now));
    if (accepted === expected) return true;
    return accepted ? 'accepted claims with a wrong issuer, audience or validity window' : 'rejected valid Access claims';
  },
} satisfies ContractOf<typeof acceptsClaims>;
