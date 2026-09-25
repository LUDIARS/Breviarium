// @implements SPEC-br-web-entrance
type Env = Readonly<Record<string, string | undefined>>;

/**
 * The Cloudflare Access application the public entrance trusts. Both values are public
 * identifiers (no secret): the team hostname fixes the issuer and the only key source,
 * the AUD tag names Breviarium's Access application.
 */
export interface CloudflareAccessConfig {
  /** `https://<team>.cloudflareaccess.com`: the required `iss` and the JWKS origin. */
  readonly issuer: string;
  /** 64-character AUD tag of the Access application (lower case). */
  readonly audience: string;
}

export class CloudflareAccessConfigError extends Error {}

const TEAM_DOMAIN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/i;
const AUDIENCE = /^[a-f0-9]{64}$/i;

interface AccessPair {
  readonly team?: string | undefined;
  readonly audience?: string | undefined;
}

/**
 * Explicit env (`BREVIARIUM_CF_ACCESS_TEAM_DOMAIN` / `BREVIARIUM_CF_ACCESS_AUD`) wins as a
 * complete pair; otherwise Excubitor's stored service config is read. One value is never
 * completed from the other source.
 */
function readPair(env: Env): AccessPair {
  const team = env['BREVIARIUM_CF_ACCESS_TEAM_DOMAIN']?.trim();
  const audience = env['BREVIARIUM_CF_ACCESS_AUD']?.trim();
  if (team || audience) return { team, audience };
  return readServiceConfig(env['EXCUBITOR_SERVICE_CONFIG_JSON']);
}

/** `EXCUBITOR_SERVICE_CONFIG_JSON` = `{ cloudflareAccess: { teamDomain, audience } }`; other keys are ignored. */
function readServiceConfig(serialized: string | undefined): AccessPair {
  if (serialized === undefined || !serialized.trim()) return {};
  try {
    const config: unknown = JSON.parse(serialized);
    if (typeof config !== 'object' || config === null || Array.isArray(config)) throw new Error();
    if (!('cloudflareAccess' in config)) return {};
    const access = config.cloudflareAccess;
    if (typeof access !== 'object' || access === null || Array.isArray(access)) throw new Error();
    const team = 'teamDomain' in access ? access.teamDomain : undefined;
    const audience = 'audience' in access ? access.audience : undefined;
    if (typeof team !== 'string' || typeof audience !== 'string' || !team.trim() || !audience.trim()) throw new Error();
    return { team: team.trim(), audience: audience.trim() };
  } catch {
    throw new CloudflareAccessConfigError('EXCUBITOR_SERVICE_CONFIG_JSON must contain a valid cloudflareAccess teamDomain/audience pair');
  }
}

/**
 * Neither value → undefined (the public entrance answers 503; authentication is never
 * switched off). One value only, or a malformed one → error at startup.
 */
export function readCloudflareAccessConfig(env: Env): CloudflareAccessConfig | undefined {
  const { team, audience } = readPair(env);
  if (!team && !audience) return undefined;
  if (!team || !audience) throw new CloudflareAccessConfigError('BREVIARIUM_CF_ACCESS_TEAM_DOMAIN and BREVIARIUM_CF_ACCESS_AUD must both be set');
  if (!TEAM_DOMAIN.test(team)) throw new CloudflareAccessConfigError('BREVIARIUM_CF_ACCESS_TEAM_DOMAIN must be a <team>.cloudflareaccess.com hostname (no scheme)');
  if (!AUDIENCE.test(audience)) throw new CloudflareAccessConfigError('BREVIARIUM_CF_ACCESS_AUD must be the 64-character Access application AUD tag');
  return { issuer: `https://${team.toLowerCase()}`, audience: audience.toLowerCase() };
}
