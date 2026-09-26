// @implements SPEC-br-architecture
import type { SourceRegistry } from '../../snapshots/ports.ts';
import type { BreviariumConfig } from '../config/load-config.ts';
import { createActioSource } from './actio-source.ts';
import { createAnatomiaCliRunner, createAnatomiaCliSource } from './anatomia-cli-source.ts';
import { createAnatomiaSource } from './anatomia-source.ts';
import { createConcordiaReviewsSource } from './concordia-reviews-source.ts';
import { createConcordiaSource } from './concordia-source.ts';
import { createElegantiaSource } from './elegantia-source.ts';
import { createGitRunner, createGitSource } from './git-source.ts';
import type { FetchLike, HttpSourceOptions } from './http-json.ts';
import { createPraeformaAcceptanceSource } from './praeforma-acceptance-source.ts';
import { createPraeformaSource } from './praeforma-source.ts';
import { createRepoArtifactsSource } from './repo-artifacts-source.ts';
import { createRevisorCliRunner, createRevisorSource } from './revisor-source.ts';
import { createVoluptasSource } from './voluptas-source.ts';

type SourceConfig = Pick<
  BreviariumConfig,
  'sourceTimeoutMs' | 'praeformaUrl' | 'elegantiaUrl' | 'concordiaUrl' | 'actioUrl' | 'voluptasDataDir' | 'anatomiaCliPath' | 'revisorCliPath'
>;

/** Every source from configuration. Unconfigured HTTP sources and CLIs report "not connected". */
export function createSources(config: SourceConfig, fetchImpl: FetchLike): SourceRegistry {
  const http = (baseUrl: string | undefined): HttpSourceOptions | undefined =>
    baseUrl ? { baseUrl, fetchImpl, timeoutMs: config.sourceTimeoutMs } : undefined;
  return {
    git: createGitSource(createGitRunner(config.sourceTimeoutMs)),
    praeforma: createPraeformaSource(http(config.praeformaUrl)),
    'praeforma-acceptance': createPraeformaAcceptanceSource(http(config.praeformaUrl)),
    anatomia: createAnatomiaSource(),
    'anatomia-cli': createAnatomiaCliSource(config.anatomiaCliPath ? createAnatomiaCliRunner(config.anatomiaCliPath) : undefined),
    'repo-artifacts': createRepoArtifactsSource(),
    voluptas: createVoluptasSource(config.voluptasDataDir),
    elegantia: createElegantiaSource(http(config.elegantiaUrl)),
    concordia: createConcordiaSource(http(config.concordiaUrl)),
    'concordia-reviews': createConcordiaReviewsSource(http(config.concordiaUrl)),
    revisor: createRevisorSource(config.revisorCliPath ? createRevisorCliRunner(config.revisorCliPath) : undefined),
    actio: createActioSource(http(config.actioUrl)),
  };
}
