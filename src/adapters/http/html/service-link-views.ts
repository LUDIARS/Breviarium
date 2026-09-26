// @implements SPEC-br-web-ui
import type { ServiceLink } from '../service-links.ts';
import { esc } from './escape.ts';

/** External links (new tab, no opener); nothing at all when no service is configured. `small` for the list rows. */
export function serviceLinkList(links: readonly ServiceLink[], small = false): string {
  if (links.length === 0) return '';
  const items = links.map((l) => `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('');
  return `<p class="service-links${small ? ' small' : ''}">${items}</p>`;
}
