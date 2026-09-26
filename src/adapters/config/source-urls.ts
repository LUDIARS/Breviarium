// @implements SPEC-br-architecture
type Env = Readonly<Record<string, string | undefined>>;

export class SourceUrlError extends Error {}

/**
 * Base URL of an HTTP source. An explicit `BREVIARIUM_<NAME>_URL` wins; otherwise the
 * `<NAME>_URL` that Excubitor injects from the source's own catalog (`provides`) is used,
 * so no source address is duplicated in Breviarium's catalog. Neither set means the
 * source is not connected — never a guessed address.
 */
export function resolveSourceUrl(env: Env, name: 'PRAEFORMA' | 'ELEGANTIA' | 'CONCORDIA' | 'ACTIO'): string | undefined {
  const explicitKey = `BREVIARIUM_${name}_URL`;
  const topologyKey = `${name}_URL`;
  const explicit = env[explicitKey]?.trim();
  const key = explicit ? explicitKey : topologyKey;
  const value = explicit || env[topologyKey]?.trim();
  if (!value) return undefined;
  if (!/^https?:\/\/[^/\s]+/.test(value)) throw new SourceUrlError(`${key} must be an http(s) URL`);
  return value.replace(/\/+$/, '');
}
