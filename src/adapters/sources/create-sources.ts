// @implements SPEC-br-architecture
import type { SourceRegistry } from '../../snapshots/ports.ts';
import type { BreviariumConfig } from '../config/load-config.ts';
import { createActioSource } from './actio-source.ts';
import { createAnatomiaCliRunner, createAnatomiaCliSource } from './anatomia-cli-source.ts';
import { createAnatomiaSource } from './anatomia-source.ts';
import { createConcordiaReviewsSource } from './concordia-reviews-source.ts';
import { createConcordiaSource } from './concordia-source.ts';
import { createElegantiaSource } from './elegantia-source.ts';
import { createExcubitorSource } from './excubitor-source.ts';
import { createGitRunner, createGitSource } from './git-source.ts';
import { createGhRunner, createGithubReleasesSource } from './github-releases-source.ts';
import type { FetchLike, HttpSourceOptions } from './http-json.ts';
import { createPraeformaAcceptanceSource } from './praeforma-acceptance-source.ts';
import { createPraeformaSource } from './praeforma-source.ts';
import { createRepoArtifactsSource } from './repo-artifacts-source.ts';
import { createRevisorCliRunner, createRevisorSource } from './revisor-source.ts';
import { createVoluptasSource } from './voluptas-source.ts';

type SourceConfig = Pick<
  BreviariumConfig,
  'sourceTimeoutMs' | 'praeformaUrl' | 'elegantiaUrl' | 'concordiaUrl' | 'actioUrl' | 'excubitorUrl' | 'voluptasDataDir' | 'anatomiaCliPath' | 'anatomiaCliTimeoutMs' | 'revisorCliPath'
>;

/** Sources read from local files: the registered checkout (and its git index) and the Voluptas data directory. */
function localSources(config: SourceConfig): Pick<SourceRegistry, 'git' | 'anatomia' | 'repo-artifacts' | 'voluptas'> {
  const git = createGitRunner(config.sourceTimeoutMs);
  return {
    git: createGitSource(git),
    anatomia: createAnatomiaSource(git),
    'repo-artifacts': createRepoArtifactsSource(),
    voluptas: createVoluptasSource(config.voluptasDataDir),
  };
}

/** Sources behind the LUDIARS services' HTTP APIs; an unset URL leaves the source not connected. */
function httpSources(
  config: SourceConfig,
  fetchImpl: FetchLike,
): Pick<SourceRegistry, 'praeforma' | 'praeforma-acceptance' | 'elegantia' | 'concordia' | 'concordia-reviews' | 'actio' | 'excubitor'> {
  const http = (baseUrl: string | undefined): HttpSourceOptions | undefined =>
    baseUrl ? { baseUrl, fetchImpl, timeoutMs: config.sourceTimeoutMs } : undefined;
  return {
    praeforma: createPraeformaSource(http(config.praeformaUrl)),
    'praeforma-acceptance': createPraeformaAcceptanceSource(http(config.praeformaUrl)),
    elegantia: createElegantiaSource(http(config.elegantiaUrl)),
    concordia: createConcordiaSource(http(config.concordiaUrl)),
    'concordia-reviews': createConcordiaReviewsSource(http(config.concordiaUrl)),
    actio: createActioSource(http(config.actioUrl)),
    excubitor: createExcubitorSource(http(config.excubitorUrl)),
  };
}

/** Sources read through CLIs (execFile with an argument array); an unset Anatomia / Revisor CLI path leaves it not connected. */
function cliSources(config: SourceConfig): Pick<SourceRegistry, 'anatomia-cli' | 'revisor' | 'github-releases'> {
  return {
    'anatomia-cli': createAnatomiaCliSource(config.anatomiaCliPath ? createAnatomiaCliRunner(config.anatomiaCliPath, config.anatomiaCliTimeoutMs) : undefined),
    revisor: createRevisorSource(config.revisorCliPath ? createRevisorCliRunner(config.revisorCliPath) : undefined),
    'github-releases': createGithubReleasesSource(createGhRunner(config.sourceTimeoutMs)),
  };
}

/** Every source from configuration. Unconfigured HTTP sources and CLIs report "not connected". */
export function createSources(config: SourceConfig, fetchImpl: FetchLike): SourceRegistry {
  return { ...localSources(config), ...httpSources(config, fetchImpl), ...cliSources(config) };
}
