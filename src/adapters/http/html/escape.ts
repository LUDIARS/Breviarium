// @implements SPEC-br-web-ui
const ENTITIES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes text for HTML element content and attribute values. */
export function esc(value: string | number | undefined | null): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c);
}
