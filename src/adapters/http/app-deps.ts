// @implements SPEC-br-web-ui
import type { RegistryDeps } from '../../registry/application/registry-use-cases.ts';
import type { Result } from '../../shared/result.ts';
import type { OverviewDeps } from '../../snapshots/application/project-overview.ts';
import type { RefreshReport } from '../../snapshots/application/refresh-use-case.ts';
import type { ServiceLinkConfig } from '../config/service-links-config.ts';

export type RefreshFn = (code: string, requested?: readonly string[]) => Promise<Result<RefreshReport>>;

/**
 * What the delivery surface may use. Views get `overview` (snapshots only); the one
 * path to the sources is `refresh`.
 */
export interface AppDeps {
  readonly registry: RegistryDeps;
  readonly overview: OverviewDeps;
  readonly refresh: RefreshFn;
  /** Where the pages link out to Praeforma / Anatomia / Actio; absent = no links. */
  readonly links?: ServiceLinkConfig;
}
