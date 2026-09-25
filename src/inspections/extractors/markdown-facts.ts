// @implements SPEC-br-grading
/** Minimal Markdown readers for plan documents: YAML-ish front matter and list items under headings. */

/** `key: value` pairs of a leading `---` front matter block; quotes around values are dropped. */
export function parseFrontMatter(text: string): Readonly<Record<string, string>> {
  const block = /^﻿?---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1];
  const out: Record<string, string> = {};
  if (!block) return out;
  for (const line of block.split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    out[(m[1] as string).toLowerCase()] = (m[2] as string).trim().replace(/^(["'])(.*)\1$/, '$2');
  }
  return out;
}

const HEADING = /^(#{1,6})\s+(.*)$/;
/** Top-level list item: at most one leading space (2+ spaces or a tab is a nested item). */
const LIST_ITEM = /^ ?(?:[-*+]|\d+[.)])\s+\S/;

/**
 * Counts top-level list items under every heading whose text matches `pattern`, up to the
 * next heading of the same or a higher level. Nested items are not counted.
 */
export function countItemsUnderHeadings(text: string, pattern: RegExp): number {
  let count = 0;
  let activeLevel: number | null = null;
  let inFence = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const heading = HEADING.exec(line);
    if (heading) {
      const level = (heading[1] as string).length;
      if (activeLevel !== null && level <= activeLevel) activeLevel = null;
      if (activeLevel === null && pattern.test(heading[2] as string)) activeLevel = level;
      continue;
    }
    if (activeLevel !== null && LIST_ITEM.test(line)) count++;
  }
  return count;
}
