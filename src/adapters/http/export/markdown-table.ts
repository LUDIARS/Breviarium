// @implements SPEC-br-web-ui
/** Escapes text for a Markdown table cell: backslash-escapes punctuation that Markdown or inline HTML would read. */
export function mdCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value)
    .replace(/\r?\n/g, ' ')
    .replace(/[\\|<>`*_[\]#]/g, (c) => `\\${c}`);
}

/** A Markdown table; every cell goes through mdCell. */
export function mdTable(head: readonly string[], rows: readonly (readonly (string | number | null)[])[]): string {
  const line = (cells: readonly (string | number | null)[]) => `| ${cells.map(mdCell).join(' | ')} |`;
  return [line(head), `|${head.map(() => ' --- ').join('|')}|`, ...rows.map(line)].join('\n');
}
