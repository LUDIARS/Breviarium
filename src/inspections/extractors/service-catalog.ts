// @implements SPEC-br-workflow
import type { CatalogDeclaration, CatalogServiceFact } from '../domain/evidence.ts';

/** The declarations that make a service need related settings (dependencies, env, topology, hubs Corpus / Cernere). */
const DECLARATIONS: readonly CatalogDeclaration[] = ['depends_on', 'required_env', 'provides', 'uses_corpus', 'cernere_launch_credentials'];
/** An Excubitor service code. */
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const MAX_SERVICES = 50;
const KEY = /^([A-Za-z_][\w-]*):\s*(.*)$/;

interface Line {
  readonly indent: number;
  readonly text: string;
}

/** Non-empty lines without comments (a `#` at the start or after whitespace). */
function meaningfulLines(text: string): Line[] {
  return text.split(/\r?\n/).flatMap((raw) => {
    const body = raw.replace(/(^|\s)#.*$/, '').trimEnd();
    if (body.trim() === '') return [];
    return [{ indent: body.length - body.trimStart().length, text: body.trim() }];
  });
}

function unquote(value: string): string {
  return value.replace(/^(['"])(.*)\1$/, '$2').trim();
}

/** `[a, b]` → [a, b]; `[]` → []; anything else is not an inline list. */
function inlineList(value: string): string[] | null {
  const m = /^\[(.*)\]$/.exec(value);
  return m ? (m[1] ?? '').split(',').map(unquote).filter((v) => v !== '') : null;
}

/** The keys of one service item (`- code: x` then its indented lines), each with its inline value and child lines. */
function keysOf(item: readonly Line[], keyIndent: number): Map<string, { readonly value: string; readonly children: readonly Line[] }> {
  const keys = new Map<string, { value: string; children: Line[] }>();
  let current: { value: string; children: Line[] } | null = null;
  for (const line of item) {
    const m = line.indent === keyIndent ? KEY.exec(line.text) : null;
    if (m) {
      current = { value: (m[2] ?? '').trim(), children: [] };
      keys.set(m[1] ?? '', current);
    } else if (current && line.indent > keyIndent) {
      current.children.push(line);
    }
  }
  return keys;
}

/** `- x` children or an inline list. */
function listOf(entry: { readonly value: string; readonly children: readonly Line[] } | undefined): string[] {
  if (!entry) return [];
  return inlineList(entry.value) ?? entry.children.filter((c) => c.text.startsWith('- ')).map((c) => unquote(c.text.slice(2)));
}

function declared(key: CatalogDeclaration, entry: { readonly value: string; readonly children: readonly Line[] } | undefined): boolean {
  if (!entry) return false;
  if (key === 'uses_corpus') return entry.value === 'true';
  if (key === 'depends_on' || key === 'required_env') return listOf(entry).length > 0;
  const inline = entry.value.replace(/^\{\s*\}$/, '').replace(/^\[\s*\]$/, '');
  return inline !== '' || entry.children.length > 0;
}

function serviceOf(item: readonly Line[], keyIndent: number): CatalogServiceFact | null {
  const keys = keysOf(item, keyIndent);
  const code = unquote(keys.get('code')?.value ?? '');
  if (!IDENTIFIER.test(code)) return null;
  const declarations = DECLARATIONS.filter((d) => declared(d, keys.get(d)));
  const dependsOn = declarations.includes('depends_on') ? listOf(keys.get('depends_on')).filter((d) => IDENTIFIER.test(d)) : [];
  return { code, dependsOn, declarations };
}

/**
 * The services of a service-owned `excubitor.catalog.yaml` (top-level `services:` list), read line by line
 * without a YAML library: each service's code, the codes it depends on and which related declarations it
 * carries. Env values, commands, paths and URLs are never kept; an unreadable catalog gives no services.
 */
export function extractServiceCatalog(text: string): CatalogServiceFact[] {
  const lines = meaningfulLines(text);
  const start = lines.findIndex((l) => l.indent === 0 && l.text === 'services:');
  if (start < 0) return [];
  const body: Line[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.indent === 0) break;
    body.push(line);
  }
  const itemIndent = body.find((l) => l.text.startsWith('- '))?.indent;
  if (itemIndent === undefined) return [];
  const items: Line[][] = [];
  for (const line of body) {
    if (line.indent === itemIndent && line.text.startsWith('- ')) items.push([{ indent: itemIndent + 2, text: line.text.slice(2).trim() }]);
    else if (line.indent > itemIndent) items.at(-1)?.push(line);
  }
  return items
    .map((item) => serviceOf(item, itemIndent + 2))
    .filter((s): s is CatalogServiceFact => s !== null)
    .slice(0, MAX_SERVICES);
}
