// @implements SPEC-br-web-entrance
import type { readCloudflareAccessConfig } from '../src/adapters/config/cloudflare-access-config.ts';
import type { ContractOf } from './contract-types.ts';

function storedAccess(serialized: string | undefined): boolean {
  if (!serialized?.trim()) return false;
  try {
    const parsed: unknown = JSON.parse(serialized);
    return typeof parsed === 'object' && parsed !== null && 'cloudflareAccess' in parsed;
  } catch {
    return false;
  }
}

/**
 * C-17: a returned config always names a `<team>.cloudflareaccess.com` issuer and a 64-hex AUD,
 * and it exists exactly when the env (explicit pair or Excubitor's stored config) set one.
 */
export default {
  post: (config, env) => {
    const configured =
      Boolean(env['BREVIARIUM_CF_ACCESS_TEAM_DOMAIN']?.trim() || env['BREVIARIUM_CF_ACCESS_AUD']?.trim()) || storedAccess(env['EXCUBITOR_SERVICE_CONFIG_JSON']);
    if (config === undefined) return configured ? 'dropped a configured Access pair' : true;
    if (!configured) return 'invented an Access config';
    if (!/^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.cloudflareaccess\.com$/.test(config.issuer)) return 'issuer is not a Cloudflare Access team origin';
    return /^[a-f0-9]{64}$/.test(config.audience) ? true : 'audience is not a 64-character AUD tag';
  },
} satisfies ContractOf<typeof readCloudflareAccessConfig>;
