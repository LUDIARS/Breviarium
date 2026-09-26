// @implements SPEC-br-sprints
import type { actioSprintsPath } from '../src/adapters/sources/actio-source.ts';
import type { ContractOf } from './contract-types.ts';

/** C-27: Actio is asked for the bound `actioProjectCode`, else the registered code, URL-encoded in the contract path. */
export default {
  post: (path, project) => {
    const code = project.bindings.actioProjectCode ?? project.code;
    return path === `/api/projects/cc/${encodeURIComponent(code)}/sprints` ? true : 'path does not use the bound Actio code (or the registered code)';
  },
} satisfies ContractOf<typeof actioSprintsPath>;
