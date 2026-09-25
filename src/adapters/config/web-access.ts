// @implements SPEC-br-architecture
/**
 * Which Host / Origin values the Web entrance accepts (same shape as Conflux / Elegantia):
 * the service's own loopback authorities, Excubitor's shared `LUDIARS_ALLOWED_HOSTS`
 * (leading dot = domain and subdomains), and an exact set of extra Viewer origins.
 * No public URL is derived here; Breviarium has no tunnel.
 */
export interface WebAccess {
  readonly hosts: ReadonlySet<string>;
  readonly origins: ReadonlySet<string>;
}

export class WebAccessError extends Error {}

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Parses `LUDIARS_ALLOWED_HOSTS`; URLs, userinfo, ports-only and `*` are rejected. */
export function parseAllowedHosts(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .map((entry) => {
      const hostname = entry.startsWith('.') ? entry.slice(1) : entry;
      if (hostname.length > 253 || !hostname.split('.').every((label) => LABEL.test(label))) {
        throw new WebAccessError('LUDIARS_ALLOWED_HOSTS contains an invalid hostname');
      }
      return entry;
    });
}

/** Parses an exact, comma separated list of http(s) origins. */
export function parseOrigins(key: string, value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      let url: URL;
      try {
        url = new URL(entry);
      } catch {
        throw new WebAccessError(`${key} contains an invalid origin`);
      }
      if (url.origin !== entry || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
        throw new WebAccessError(`${key} entries must be exact http(s) origins`);
      }
      return entry;
    });
}

const LOOPBACK_AUTHORITIES = ['127.0.0.1', 'localhost', '[::1]'];

export function buildWebAccess(port: number, allowedHosts: string | undefined, viewerOrigins: string | undefined): WebAccess {
  const own = LOOPBACK_AUTHORITIES.map((host) => `${host}:${port}`);
  return {
    hosts: new Set([...own, ...parseAllowedHosts(allowedHosts)]),
    origins: new Set([...own.map((authority) => `http://${authority}`), ...parseOrigins('BREVIARIUM_VIEWER_ORIGINS', viewerOrigins)]),
  };
}
