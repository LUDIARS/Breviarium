// @implements SPEC-br-web-ui
import type { BreviariumConfig } from '../config/load-config.ts';
import { jsonResponse } from './responses.ts';
import type { Router } from './router.ts';

export type CapabilityState = 'configured' | 'not_connected';

/**
 * `GET /health` body. `status: alive` only means the process serves HTTP. Sources are
 * never probed here (`not_checked`); each reports only whether it is configured, and no
 * URL or path is included. `access.cloudflareAccess` says whether the public entrance can
 * verify Access tokens (the team, AUD and public URL are not included).
 */
export interface HealthReport {
  readonly service: 'breviarium';
  readonly status: 'alive';
  readonly startedAt: string;
  readonly sources: {
    readonly reachability: 'not_checked';
    readonly praeforma: CapabilityState;
    readonly elegantia: CapabilityState;
    readonly concordia: CapabilityState;
    readonly actio: CapabilityState;
    readonly voluptas: CapabilityState;
  };
  readonly refresh: { readonly periodic: 'disabled' | 'enabled'; readonly intervalSec: number };
  readonly access: { readonly cloudflareAccess: CapabilityState };
}

const state = (value: string | undefined): CapabilityState => (value ? 'configured' : 'not_connected');

export function describeHealth(config: BreviariumConfig, startedAt: string): HealthReport {
  return {
    service: 'breviarium',
    status: 'alive',
    startedAt,
    sources: {
      reachability: 'not_checked',
      praeforma: state(config.praeformaUrl),
      elegantia: state(config.elegantiaUrl),
      concordia: state(config.concordiaUrl),
      actio: state(config.actioUrl),
      voluptas: state(config.voluptasDataDir),
    },
    refresh: { periodic: config.refreshIntervalSec > 0 ? 'enabled' : 'disabled', intervalSec: config.refreshIntervalSec },
    access: { cloudflareAccess: config.cloudflareAccess ? 'configured' : 'not_connected' },
  };
}

/** Liveness route for Excubitor's health check; the report is fixed at startup. */
export function registerHealthRoute(router: Router, report: HealthReport): Router {
  return router.add('GET', '/health', async () => jsonResponse(200, report));
}
