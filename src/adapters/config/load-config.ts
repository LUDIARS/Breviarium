// @implements SPEC-br-architecture
import { isAbsolute } from 'node:path';
import { type CloudflareAccessConfig, CloudflareAccessConfigError, readCloudflareAccessConfig } from './cloudflare-access-config.ts';
import { PublicOriginError } from './public-origin.ts';
import { readServiceLinks, type ServiceLinkConfig, ServiceLinkError } from './service-links-config.ts';
import { SourceUrlError, resolveSourceUrl } from './source-urls.ts';
import { buildWebAccess, type WebAccess, WebAccessError } from './web-access.ts';

type Env = Readonly<Record<string, string | undefined>>;

/**
 * Runtime configuration from environment variables (Excubitor catalog env). Required values
 * fail fast; the defaults of optional values live here. Unset source URLs stay undefined
 * and those sources report "not connected".
 */
export interface BreviariumConfig {
  readonly dataDir: string;
  readonly host: string;
  readonly port: number;
  readonly sourceTimeoutMs: number;
  readonly praeformaUrl?: string;
  readonly elegantiaUrl?: string;
  readonly concordiaUrl?: string;
  readonly actioUrl?: string;
  /** Excubitor's API (`GET /api/v1/services`); absent = the excubitor source is not connected. */
  readonly excubitorUrl?: string;
  readonly voluptasDataDir?: string;
  /** Anatomia CLI script (`bin/anatomia.mjs`); absent = the anatomia-cli source is not connected. */
  readonly anatomiaCliPath?: string;
  /** Upper bound of one Anatomia CLI run (`domains program` on a large project takes a while): 1000..600000 ms. */
  readonly anatomiaCliTimeoutMs: number;
  /** Revisor CLI script (`src/cli.mjs`); absent = the revisor source is not connected. */
  readonly revisorCliPath?: string;
  /** 0 = periodic refresh disabled (default). */
  readonly refreshIntervalSec: number;
  readonly snapshotMaxAgeHours: number;
  /** Host / Origin values the Web entrance accepts. */
  readonly access: WebAccess;
  /** Access application the public entrance verifies against; absent = public requests get 503. */
  readonly cloudflareAccess?: CloudflareAccessConfig;
  /** Links to Praeforma / Anatomia / Actio: topology URLs for loopback users, public URLs for Access viewers. */
  readonly serviceLinks: ServiceLinkConfig;
}

export const CONFIG_DEFAULTS = {
  sourceTimeoutMs: 5000,
  anatomiaCliTimeoutMs: 120_000,
  refreshIntervalSec: 0,
  snapshotMaxAgeHours: 24,
} as const;

export class ConfigError extends Error {}

function required(env: Env, key: string): string {
  const v = env[key]?.trim();
  if (!v) throw new ConfigError(`${key} is required`);
  return v;
}

function integer(env: Env, key: string, min: number, max: number, fallback?: number): number {
  const raw = env[key]?.trim();
  if (!raw) {
    if (fallback === undefined) throw new ConfigError(`${key} is required`);
    return fallback;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw new ConfigError(`${key} must be an integer in ${min}..${max}`);
  return n;
}

/**
 * Breviarium listens on loopback only; the public entrance is a Cloudflare Tunnel on the
 * same machine forwarding to this loopback port (spec/feature/web-entrance.md).
 */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

function loopbackHost(env: Env): string {
  const host = required(env, 'BREVIARIUM_HOST');
  if (!LOOPBACK_HOSTS.has(host)) throw new ConfigError('BREVIARIUM_HOST must be a loopback address (127.0.0.1, ::1 or localhost)');
  return host;
}

/** The periodic refresh interval's env name; the former `BR_` name is still read when the current one is not set. */
const REFRESH_INTERVAL_KEYS = ['BREVIARIUM_REFRESH_INTERVAL_SEC', 'BR_REFRESH_INTERVAL_SEC'] as const;

/** 0 disables the periodic refresh; any other value must be 60..86400 seconds. */
function refreshInterval(env: Env): number {
  const key = REFRESH_INTERVAL_KEYS.find((k) => env[k]?.trim()) ?? REFRESH_INTERVAL_KEYS[0];
  const n = integer(env, key, 0, 86_400, CONFIG_DEFAULTS.refreshIntervalSec);
  if (n !== 0 && n < 60) throw new ConfigError(`${key} must be 0 (disabled) or at least 60`);
  return n;
}

/** An optional absolute path (a directory or a CLI script); unset stays undefined, never a guessed location. */
function optionalAbsolutePath(env: Env, key: string): string | undefined {
  const v = env[key]?.trim();
  if (!v) return undefined;
  if (!isAbsolute(v)) throw new ConfigError(`${key} must be an absolute path`);
  return v;
}

/** Re-raises the helpers' validation errors as ConfigError so startup reports one kind. */
function asConfigError<T>(read: () => T): T {
  try {
    return read();
  } catch (error) {
    if (
      error instanceof SourceUrlError ||
      error instanceof WebAccessError ||
      error instanceof PublicOriginError ||
      error instanceof CloudflareAccessConfigError ||
      error instanceof ServiceLinkError
    ) {
      throw new ConfigError(error.message);
    }
    throw error;
  }
}

export function loadConfig(env: Env): BreviariumConfig {
  const port = integer(env, 'BREVIARIUM_PORT', 1, 65_535);
  const praeformaUrl = asConfigError(() => resolveSourceUrl(env, 'PRAEFORMA'));
  const elegantiaUrl = asConfigError(() => resolveSourceUrl(env, 'ELEGANTIA'));
  const concordiaUrl = asConfigError(() => resolveSourceUrl(env, 'CONCORDIA'));
  const actioUrl = asConfigError(() => resolveSourceUrl(env, 'ACTIO'));
  const excubitorUrl = asConfigError(() => resolveSourceUrl(env, 'EXCUBITOR'));
  const voluptasDataDir = optionalAbsolutePath(env, 'BREVIARIUM_VOLPUTAS_DATA_DIR');
  const anatomiaCliPath = optionalAbsolutePath(env, 'BREVIARIUM_ANATOMIA_CLI');
  const revisorCliPath = optionalAbsolutePath(env, 'BREVIARIUM_REVISOR_CLI');
  const cloudflareAccess = asConfigError(() => readCloudflareAccessConfig(env));
  return {
    dataDir: required(env, 'BREVIARIUM_DATA_DIR'),
    host: loopbackHost(env),
    port,
    sourceTimeoutMs: integer(env, 'BREVIARIUM_SOURCE_TIMEOUT_MS', 100, 120_000, CONFIG_DEFAULTS.sourceTimeoutMs),
    ...(praeformaUrl ? { praeformaUrl } : {}),
    ...(elegantiaUrl ? { elegantiaUrl } : {}),
    ...(concordiaUrl ? { concordiaUrl } : {}),
    ...(actioUrl ? { actioUrl } : {}),
    ...(excubitorUrl ? { excubitorUrl } : {}),
    ...(voluptasDataDir ? { voluptasDataDir } : {}),
    ...(anatomiaCliPath ? { anatomiaCliPath } : {}),
    anatomiaCliTimeoutMs: integer(env, 'BREVIARIUM_ANATOMIA_CLI_TIMEOUT_MS', 1000, 600_000, CONFIG_DEFAULTS.anatomiaCliTimeoutMs),
    ...(revisorCliPath ? { revisorCliPath } : {}),
    refreshIntervalSec: refreshInterval(env),
    snapshotMaxAgeHours: integer(env, 'BREVIARIUM_SNAPSHOT_MAX_AGE_HOURS', 1, 24 * 365, CONFIG_DEFAULTS.snapshotMaxAgeHours),
    access: asConfigError(() => buildWebAccess(port, env['LUDIARS_ALLOWED_HOSTS'], env['BREVIARIUM_VIEWER_ORIGINS'], env['BREVIARIUM_PUBLIC_URL'])),
    ...(cloudflareAccess ? { cloudflareAccess } : {}),
    serviceLinks: asConfigError(() => readServiceLinks(env)),
  };
}
