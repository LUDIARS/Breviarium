// @implements SPEC-br-architecture
import type { SourceRegistry } from '../../snapshots/ports.ts';
import type { BreviariumConfig } from '../config/load-config.ts';
import { createActioSource } from './actio-source.ts';
import { createAnatomiaSource } from './anatomia-source.ts';
import { createConcordiaSource } from './concordia-source.ts';
import { createElegantiaSource } from './elegantia-source.ts';
import { createGitRunner, createGitSource } from './git-source.ts';
import type { FetchLike, HttpSourceOptions } from './http-json.ts';
import { createPraeformaSource } from './praeforma-source.ts';
import { createRepoArtifactsSource } from './repo-artifacts-source.ts';
import { createVoluptasSource } from './voluptas-source.ts';

type SourceConfig = Pick<BreviariumConfig, 'sourceTimeoutMs' | 'praeformaUrl' | 'elegantiaUrl' | 'concordiaUrl' | 'actioUrl' | 'voluptasDataDir'>;

/** All eight sources from configuration. Unconfigured HTTP sources report "not connected". */
export function createSources(config: SourceConfig, fetchImpl: FetchLike): SourceRegistry {
  const http = (baseUrl: string | undefined): HttpSourceOptions | undefined =>
    baseUrl ? { baseUrl, fetchImpl, timeoutMs: config.sourceTimeoutMs } : undefined;
  return {
    git: createGitSource(createGitRunner(config.sourceTimeoutMs)),
    praeforma: createPraeformaSource(http(config.praeformaUrl)),
    anatomia: createAnatomiaSource(),
    'repo-artifacts': createRepoArtifactsSource(),
    voluptas: createVoluptasSource(config.voluptasDataDir),
    elegantia: createElegantiaSource(http(config.elegantiaUrl)),
    concordia: createConcordiaSource(http(config.concordiaUrl)),
    actio: createActioSource(http(config.actioUrl)),
  };
}
