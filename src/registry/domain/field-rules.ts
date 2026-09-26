// @implements SPEC-br-registry
import { fail, ok, type Result } from '../../shared/result.ts';
import { BINDING_KEYS, type BindingKey, type Classification, CLASSIFICATIONS, type ProjectBindings } from './model.ts';

/** Cc project code: a letter followed by letters/digits, 1–16 characters (`Br`, `SUPERFAT`). */
export const PROJECT_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,15}$/;

const CONTROL = /[\u0000-\u001f\u007f]/;

export function validateCode(raw: string): Result<string> {
  const code = raw.trim();
  return PROJECT_CODE_PATTERN.test(code) ? ok(code) : fail('invalid_code', 'code は英字で始まる英数字 1〜16 文字 (Cc の略称) です');
}

export function validateName(raw: string): Result<string> {
  const name = raw.trim();
  if (name.length < 1 || name.length > 120 || CONTROL.test(name)) return fail('invalid_name', 'name は 1〜120 文字 (制御文字なし) です');
  return ok(name);
}

export function validateClassification(raw: string): Result<Classification> {
  const value = raw.trim();
  return (CLASSIFICATIONS as readonly string[]).includes(value)
    ? ok(value as Classification)
    : fail('invalid_classification', 'classification は public または internal です');
}

/**
 * Absolute checkout path, normalised to `/` separators without a trailing slash.
 * Drive-letter (`E:/…`) and POSIX (`/…`) roots are accepted; `.`/`..` segments and
 * control characters are refused so the path always names one directory literally.
 */
export function normalizeRepoPath(raw: string): Result<string> {
  const value = raw.trim().replace(/\\/g, '/');
  const bad = fail<string>('invalid_repo_path', 'repoPath は絶対パス (例: E:/Document/Ars/Project) で、. や .. を含められません');
  if (value.length === 0 || value.length > 400 || CONTROL.test(value)) return bad;
  const drive = /^([A-Za-z]):\//.exec(value);
  if (!drive && !value.startsWith('/')) return bad;
  if (value.startsWith('//')) return bad;
  const rest = drive ? value.slice(3) : value.slice(1);
  const segments = rest.split('/').filter((s) => s.length > 0);
  if (segments.some((s) => s === '.' || s === '..')) return bad;
  const root = drive ? `${(drive[1] as string).toUpperCase()}:/` : '/';
  return ok(root + segments.join('/'));
}

const SAFE_SEGMENT = /^[A-Za-z0-9_.-]+$/;

function validVoluptasPath(value: string): boolean {
  if (value.length > 200 || value.startsWith('/') || /^[A-Za-z]:/.test(value)) return false;
  const segments = value.split('/');
  return segments.length > 0 && segments.every((s) => SAFE_SEGMENT.test(s) && s !== '.' && s !== '..');
}

const BINDING_PATTERNS: Readonly<Record<BindingKey, (value: string) => boolean>> = {
  praeformaProjectId: (v) => /^[A-Za-z0-9_-]{1,64}$/.test(v),
  elegantiaProduct: (v) => /^[A-Za-z0-9_.-]{1,160}$/.test(v),
  voluptasPath: validVoluptasPath,
  githubRepo: (v) => /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(v),
  actioProjectCode: (v) => PROJECT_CODE_PATTERN.test(v),
};

/** Validates the binding set. Empty values mean "not bound"; unknown keys are refused. */
export function validateBindings(raw: Readonly<Record<string, string | undefined>> | undefined): Result<ProjectBindings> {
  const out: Partial<Record<BindingKey, string>> = {};
  for (const [key, rawValue] of Object.entries(raw ?? {})) {
    if (!(BINDING_KEYS as readonly string[]).includes(key)) return fail('invalid_binding', `未知の binding です: ${key}`);
    if (rawValue !== undefined && typeof rawValue !== 'string') return fail('invalid_binding', `${key} は文字列です`);
    const value = (rawValue ?? '').trim().replace(/\\/g, '/');
    if (value === '') continue;
    const bindingKey = key as BindingKey;
    if (!BINDING_PATTERNS[bindingKey](value)) return fail('invalid_binding', `${key} の形式が不正です`);
    out[bindingKey] = value;
  }
  return ok(out);
}
