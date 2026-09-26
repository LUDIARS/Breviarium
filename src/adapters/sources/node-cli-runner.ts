// @implements SPEC-br-architecture
import { type ExecFileException, execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Runs one read-only command of a CLI (a LUDIARS Node CLI, or `gh`) and returns its stdout. */
export type CliRunner = (args: readonly string[]) => Promise<string>;

/** The CLI script is absent, the run took too long, or it ended with an error. */
export type CliFailure = 'missing' | 'timeout' | 'exit';

/**
 * A failed CLI run. The message names the CLI and its subcommand only. `stderr` stays in memory so
 * the caller can recognise a known failure (e.g. an unknown project); it is never stored, because
 * a CLI's diagnostics can carry local paths.
 */
export class CliRunError extends Error {
  readonly failure: CliFailure;
  readonly stderr: string;

  constructor(message: string, failure: CliFailure, stderr = '') {
    super(message);
    this.failure = failure;
    this.stderr = stderr;
  }
}

export interface ExecFileOptions {
  /** Name used in failure messages, e.g. `Anatomia CLI` or `gh`. */
  readonly label: string;
  readonly timeoutMs: number;
  /** The child's environment, derived from this process's environment at each run. */
  readonly env: (base: NodeJS.ProcessEnv) => NodeJS.ProcessEnv;
}

export interface NodeCliOptions extends ExecFileOptions {
  /** Absolute path of the CLI script (`.mjs`), run with the Node binary running Breviarium. */
  readonly cliPath: string;
}

/** An executable run directly: its file (a path, or a command name found on PATH), fixed leading arguments and working directory. */
interface ExecTarget extends ExecFileOptions {
  readonly file: string;
  readonly leadingArgs: readonly string[];
  readonly cwd?: string;
}

/** CLI JSON (a Revisor PR listing carries every PR body) can be large; beyond this the run fails instead of growing. */
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

/** What the command was, for messages: the subcommand words before the first option or value. */
function commandName(label: string, args: readonly string[]): string {
  const words = args.slice(0, 2).filter((a) => /^[a-z][a-z-]*$/.test(a));
  return words.length > 0 ? `${label} (${words.join(' ')})` : label;
}

async function assertCliFile(options: NodeCliOptions): Promise<void> {
  try {
    if ((await stat(options.cliPath)).isFile()) return;
  } catch {
    // Absent or unreadable: both mean the configured CLI cannot be run, reported just below.
  }
  throw new CliRunError(`${options.label} が見つからない`, 'missing');
}

function runError(error: ExecFileException, stderr: string, name: string, options: ExecFileOptions): CliRunError {
  if (error.code === 'ENOENT') return new CliRunError(`${options.label} を起動できない`, 'missing');
  if (error.killed) return new CliRunError(`${name} が ${Math.round(options.timeoutMs / 1000)} 秒でタイムアウト`, 'timeout', stderr);
  if (error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return new CliRunError(`${name} の出力が大きすぎる`, 'exit', stderr);
  const exit = typeof error.code === 'number' ? ` (exit ${error.code})` : '';
  return new CliRunError(`${name} が失敗${exit}`, 'exit', stderr);
}

/** One run of the target through `execFile` with an argument array (never a shell); failures become CliRunError kinds. */
function runTarget(target: ExecTarget, args: readonly string[]): Promise<string> {
  const name = commandName(target.label, args);
  return new Promise((resolve, reject) => {
    execFile(
      target.file,
      [...target.leadingArgs, ...args],
      {
        ...(target.cwd ? { cwd: target.cwd } : {}),
        timeout: target.timeoutMs,
        windowsHide: true,
        maxBuffer: MAX_OUTPUT_BYTES,
        encoding: 'utf8',
        env: target.env(process.env),
      },
      (error, stdout, stderr) => (error ? reject(runError(error, stderr, name, target)) : resolve(stdout)),
    );
  });
}

/**
 * A runner for a Node CLI script through `execFile` with an argument array: the script path and
 * every argument are passed as separate arguments, never through a shell, so a project id or a
 * repository name cannot be interpreted as shell syntax. The child runs in the CLI's own
 * directory (not in a registered checkout) with the given environment.
 */
export function createNodeCliRunner(options: NodeCliOptions): CliRunner {
  const target: ExecTarget = { ...options, file: process.execPath, leadingArgs: [options.cliPath], cwd: dirname(options.cliPath) };
  return async (args) => {
    await assertCliFile(options);
    return runTarget(target, args);
  };
}

/**
 * A runner for an executable found on PATH (e.g. `gh`), with the same argument-array rules and failure
 * kinds as a Node CLI: an absent command is `missing`, a run beyond the timeout `timeout`.
 */
export function createCommandRunner(command: string, options: ExecFileOptions): CliRunner {
  const target: ExecTarget = { ...options, file: command, leadingArgs: [] };
  return (args) => runTarget(target, args);
}

/** The CLI's `--json` output as a value; an unreadable output is a failure naming the CLI only. */
export function parseCliJson(stdout: string, what: string): unknown {
  try {
    return JSON.parse(stdout) as unknown;
  } catch {
    throw new Error(`${what} の出力を JSON として読めない`);
  }
}
