// @implements SPEC-br-grading
import type { MembershipCoverage } from './evidence.ts';

/** One declared domain's `membership[].pathPattern` values: JS regular expressions over repository-relative `/` paths. */
export interface DomainPathPatterns {
  readonly pathPatterns: readonly string[];
}

/** Extensions of implementation files (spec/feature/grading.md). */
const IMPLEMENTATION_EXTENSIONS: ReadonlySet<string> = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.py', '.cs', '.cpp', '.h', '.hpp', '.rs', '.go']);

/** A directory holding tests or documents, per path segment in any case (`tests/`, `Tests/`, `Foo.Tests/`, `spec/`, `docs/`). */
const TEST_OR_DOC_DIR = /^(?:tests?|__tests__|e2e|specs?|docs?)$|\.tests?$/i;
/** A test file by its name: `x.test.ts`, `x.spec.ts`, `x_test.go`, `test_x.py`. */
const TEST_FILE = /\.(?:test|spec)\.[^.]+$|_test\.[^.]+$|^test_.*\.py$/i;

/** An implementation file: one of the extensions, not a test file, and not under a test or document directory. */
export function isImplementationFile(path: string): boolean {
  const segments = path.split('/');
  const name = segments.pop() ?? '';
  const dot = name.lastIndexOf('.');
  if (dot < 0 || !IMPLEMENTATION_EXTENSIONS.has(name.slice(dot).toLowerCase())) return false;
  if (TEST_FILE.test(name)) return false;
  return !segments.some((dir) => TEST_OR_DOC_DIR.test(dir));
}

/** Patterns as Anatomia compiles them (`new RegExp(pattern)`, no flags); a pattern that does not compile is only counted. */
function compilePatterns(domains: readonly DomainPathPatterns[]): { readonly valid: RegExp[]; readonly invalid: number } {
  const valid: RegExp[] = [];
  let invalid = 0;
  for (const pattern of domains.flatMap((d) => d.pathPatterns)) {
    try {
      valid.push(new RegExp(pattern));
    } catch {
      invalid++;
    }
  }
  return { valid, invalid };
}

/**
 * The share of the repository's implementation belonging to a declared domain: of the given files
 * (repository-relative, as `git ls-files` lists the index), the implementation files and those matched by
 * at least one declared `membership.pathPattern`. Only counts leave this function.
 */
export function membershipCoverage(files: readonly string[], domains: readonly DomainPathPatterns[]): MembershipCoverage {
  const { valid, invalid } = compilePatterns(domains);
  const implementation = [...new Set(files.map((f) => f.replace(/\\/g, '/')))].filter(isImplementationFile);
  return {
    domains: domains.length,
    pathPatterns: valid.length,
    invalidPatterns: invalid,
    implementationFiles: implementation.length,
    matchedFiles: implementation.filter((file) => valid.some((re) => re.test(file))).length,
  };
}
