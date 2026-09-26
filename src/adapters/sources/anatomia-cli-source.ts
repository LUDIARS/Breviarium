// @implements SPEC-br-architecture
import { extractAnatomiaCoverageEvidence } from '../../inspections/extractors/anatomia-coverage.ts';
import type { Project } from '../../registry/domain/model.ts';
import type { SourceOutcome } from '../../snapshots/domain/model.ts';
import type { SourceAdapter } from '../../snapshots/ports.ts';
import { type CliRunner, CliRunError, createNodeCliRunner, parseCliJson } from './node-cli-runner.ts';
import { failed, fromResult, notConnected } from './source-outcomes.ts';

/** The analysis can take a while on a large project; beyond this the attempt fails and the previous data stays. */
export const ANATOMIA_CLI_TIMEOUT_MS = 120_000;

/** The Anatomia project the CLI is asked for: `bindings.anatomiaProject` when bound, else the lower-case code. */
export function anatomiaProjectId(project: Project): string {
  return project.bindings.anatomiaProject ?? project.code.toLowerCase();
}

/** Anatomia's own telemetry is switched off for these read-only runs. */
function anatomiaEnv(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...base, ANATOMIA_VESTIGIUM: '0' };
}

export function createAnatomiaCliRunner(cliPath: string): CliRunner {
  return createNodeCliRunner({ cliPath, label: 'Anatomia CLI', timeoutMs: ANATOMIA_CLI_TIMEOUT_MS, env: anatomiaEnv });
}

/** Says what to fix for the failures an operator can act on; the CLI's own diagnostics are not kept. */
function explain(error: unknown, projectId: string): unknown {
  if (!(error instanceof CliRunError)) return error;
  if (error.failure === 'missing') return new Error(`${error.message} (BREVIARIUM_ANATOMIA_CLI を確認)`);
  if (error.failure === 'exit' && /unknown project/i.test(error.stderr)) return new Error(`Anatomia に project ${projectId} が未登録 (bindings.anatomiaProject を確認)`);
  return error;
}

/**
 * Anatomia CLI: `domains program --project <id> --json` (program-domain classification), kept as
 * counts only. Without a configured CLI the source is not connected; an unknown project, a
 * missing CLI or a failed run is a failed attempt, so the previous coverage stays.
 */
export function createAnatomiaCliSource(run: CliRunner | undefined): SourceAdapter {
  return {
    id: 'anatomia-cli',
    async fetch(project: Project): Promise<SourceOutcome> {
      if (!run) return notConnected('BREVIARIUM_ANATOMIA_CLI が未設定');
      const projectId = anatomiaProjectId(project);
      try {
        const output = parseCliJson(await run(['domains', 'program', '--project', projectId, '--json']), 'Anatomia CLI (domains program)');
        return fromResult(extractAnatomiaCoverageEvidence(projectId, output), `anatomia-cli:${projectId}`);
      } catch (error) {
        return failed(explain(error, projectId));
      }
    },
  };
}
