// @implements SPEC-br-playtest-triage
import type { ActioTaskChange, ActioTaskState } from '../../playtests/domain/actio-writeback.ts';
import type { ActioTaskClient } from '../../playtests/ports.ts';
import type { FetchLike } from '../sources/http-json.ts';

/** The only task source Breviarium writes back to (Ingenium's playtest tasks). */
export const INGENIUM_TASK_SOURCE = 'ingenium.playtest.v1';

const TASK_ID = /^[A-Za-z0-9-]{1,64}$/;

function taskPath(taskId: string): string {
  if (!TASK_ID.test(taskId)) throw new Error('invalid Actio task id');
  return `/api/tasks/${taskId}`;
}

/**
 * Actio's task API on loopback (local mode: the owner needs no token). `get` refuses a task that Ingenium
 * did not register, so a judgement can never change another task. Errors name the path only, never the host.
 */
export function createActioTaskClient(baseUrl: string, fetchImpl: FetchLike, timeoutMs: number): ActioTaskClient {
  const call = async (method: string, path: string, body?: unknown): Promise<unknown> => {
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: { accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json; charset=utf-8' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new Error(`${method} ${path}: 接続できない`);
    }
    if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status}`);
    return (await response.json()) as unknown;
  };
  return {
    async get(taskId: string): Promise<ActioTaskState> {
      const answer = (await call('GET', taskPath(taskId))) as { task?: { status?: unknown; description?: unknown; source?: unknown } };
      const task = answer.task;
      if (!task || task.source !== INGENIUM_TASK_SOURCE) throw new Error('Ingenium が登録したタスクではない');
      return { status: typeof task.status === 'string' ? task.status : '', description: typeof task.description === 'string' ? task.description : null };
    },
    async apply(taskId: string, change: ActioTaskChange): Promise<void> {
      await call('PATCH', taskPath(taskId), { description: change.description, ...(change.status ? { status: change.status } : {}) });
    },
  };
}
