// @implements SPEC-br-architecture
import { isAbsolute } from 'node:path';
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
  readonly voluptasDataDir?: string;
  /** 0 = periodic refresh disabled (default). */
  readonly refreshIntervalSec: number;
  readonly snapshotMaxAgeHours: number;
  readonly staleAfterDays: number;
  readonly staleCommitLagDays: number;
  /** Host / Origin values the Web entrance accepts. */
  readonly access: WebAccess;
}

export const CONFIG_DEFAULTS = {
  sourceTimeoutMs: 5000,
  refreshIntervalSec: 0,
  snapshotMaxAgeHours: 24,
  staleAfterDays: 30,
  staleCommitLagDays: 7,
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

/** Breviarium has no public entrance; it listens on loopback only. */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

function loopbackHost(env: Env): string {
  const host = required(env, 'BREVIARIUM_HOST');
  if (!LOOPBACK_HOSTS.has(host)) throw new ConfigError('BREVIARIUM_HOST must be a loopback address (127.0.0.1, ::1 or localhost)');
  return host;
}

/** 0 disables the periodic refresh; any other value must be 60..86400 seconds. */
function refreshInterval(env: Env): number {
  const n = integer(env, 'BR_REFRESH_INTERVAL_SEC', 0, 86_400, CONFIG_DEFAULTS.refreshIntervalSec);
  if (n !== 0 && n < 60) throw new ConfigError('BR_REFRESH_INTERVAL_SEC must be 0 (disabled) or at least 60');
  return n;
}

function optionalDir(env: Env, key: string): string | undefined {
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
    if (error instanceof SourceUrlError || error instanceof WebAccessError) throw new ConfigError(error.message);
    throw error;
  }
}

export function loadConfig(env: Env): BreviariumConfig {
  const port = integer(env, 'BREVIARIUM_PORT', 1, 65_535);
  const praeformaUrl = asConfigError(() => resolveSourceUrl(env, 'PRAEFORMA'));
  const elegantiaUrl = asConfigError(() => resolveSourceUrl(env, 'ELEGANTIA'));
  const concordiaUrl = asConfigError(() => resolveSourceUrl(env, 'CONCORDIA'));
  const voluptasDataDir = optionalDir(env, 'BREVIARIUM_VOLPUTAS_DATA_DIR');
  return {
    dataDir: required(env, 'BREVIARIUM_DATA_DIR'),
    host: loopbackHost(env),
    port,
    sourceTimeoutMs: integer(env, 'BREVIARIUM_SOURCE_TIMEOUT_MS', 100, 120_000, CONFIG_DEFAULTS.sourceTimeoutMs),
    ...(praeformaUrl ? { praeformaUrl } : {}),
    ...(elegantiaUrl ? { elegantiaUrl } : {}),
    ...(concordiaUrl ? { concordiaUrl } : {}),
    ...(voluptasDataDir ? { voluptasDataDir } : {}),
    refreshIntervalSec: refreshInterval(env),
    snapshotMaxAgeHours: integer(env, 'BREVIARIUM_SNAPSHOT_MAX_AGE_HOURS', 1, 24 * 365, CONFIG_DEFAULTS.snapshotMaxAgeHours),
    staleAfterDays: integer(env, 'BREVIARIUM_STALE_AFTER_DAYS', 1, 3650, CONFIG_DEFAULTS.staleAfterDays),
    staleCommitLagDays: integer(env, 'BREVIARIUM_STALE_COMMIT_LAG_DAYS', 0, 3650, CONFIG_DEFAULTS.staleCommitLagDays),
    access: asConfigError(() => buildWebAccess(port, env['LUDIARS_ALLOWED_HOSTS'], env['BREVIARIUM_VIEWER_ORIGINS'])),
  };
}
