// @implements SPEC-br-web-ui
type Env = Readonly<Record<string, string | undefined>>;

/** The services the pages link out to (links only; Breviarium is not a hub). */
export const LINKED_SERVICES = ['praeforma', 'anatomia', 'actio'] as const;

export type LinkedService = (typeof LINKED_SERVICES)[number];

/** Base URL (scheme + authority, no trailing `/`) per service; a service without one gets no link. */
export type ServiceLinkBases = Partial<Readonly<Record<LinkedService, string>>>;

/** Link bases per access level: loopback users get the Excubitor topology URLs, Access viewers the public ones. */
export interface ServiceLinkConfig {
  readonly local: ServiceLinkBases;
  readonly viewer: ServiceLinkBases;
}

export class ServiceLinkError extends Error {}

/** Env names per service, first set wins. The public names are declared in the catalog (`https://<svc>${DOMAIN_ROOT}`). */
const LOCAL_KEYS: Readonly<Record<LinkedService, readonly string[]>> = {
  praeforma: ['PRAEFORMA_URL'],
  anatomia: ['ANATOMIA_URL'],
  actio: ['ACTIO_FRONTEND_URL', 'ACTIO_URL'],
};

const VIEWER_KEYS: Readonly<Record<LinkedService, readonly string[]>> = {
  praeforma: ['BREVIARIUM_LINK_PRAEFORMA'],
  anatomia: ['BREVIARIUM_LINK_ANATOMIA'],
  actio: ['BREVIARIUM_LINK_ACTIO'],
};

/** An http(s) origin without credentials, path, query or fragment; unset stays undefined (no link, never a guessed URL). */
function linkBase(env: Env, keys: readonly string[]): string | undefined {
  const key = keys.find((k) => env[k]?.trim());
  if (!key) return undefined;
  const value = (env[key] ?? '').trim();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ServiceLinkError(`${key} must be an http(s) URL`);
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new ServiceLinkError(`${key} must be an http(s) origin without credentials, path, query or fragment`);
  }
  return value.replace(/\/+$/, '');
}

function basesOf(env: Env, keys: Readonly<Record<LinkedService, readonly string[]>>): ServiceLinkBases {
  const bases: Partial<Record<LinkedService, string>> = {};
  for (const service of LINKED_SERVICES) {
    const base = linkBase(env, keys[service]);
    if (base) bases[service] = base;
  }
  return bases;
}

/** Where the pages link to Praeforma / Anatomia / Actio, per access level (spec/feature/web-ui.md). */
export function readServiceLinks(env: Env): ServiceLinkConfig {
  return { local: basesOf(env, LOCAL_KEYS), viewer: basesOf(env, VIEWER_KEYS) };
}
