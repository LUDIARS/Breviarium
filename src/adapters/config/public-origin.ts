// @implements SPEC-br-web-entrance
/**
 * The public entrance's HTTPS origin (`BREVIARIUM_PUBLIC_URL`, the same catalog anchor as
 * `frontend_url`). It is an exact origin: a path, credentials, query, fragment or trailing
 * slash is a configuration error, never silently trimmed. Blank means "no public entrance".
 * Host wildcards (`LUDIARS_ALLOWED_HOSTS`) never widen into Origin wildcards; this value is
 * the only public Origin.
 */
export class PublicOriginError extends Error {}

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function readPublicOrigin(value: string | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' && url.origin === raw && url.hostname.split('.').every((label) => LABEL.test(label))) return url.origin;
  } catch {
    // Reported below without echoing the value.
  }
  throw new PublicOriginError('BREVIARIUM_PUBLIC_URL must be an exact HTTPS origin without a path or credentials');
}
