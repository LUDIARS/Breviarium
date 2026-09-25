// @implements SPEC-br-web-ui
import type { describeHealth } from '../src/adapters/http/health.ts';
import type { ContractOf } from './contract-types.ts';

/**
 * C-13: health reports liveness only, follows each source's and Cloudflare Access's
 * configuration, and exposes no URL, path, Access team or AUD.
 */
export default {
  post: (report, config) => {
    if (report.status !== 'alive' || report.sources.reachability !== 'not_checked') return 'health claims more than liveness';
    const pairs: ReadonlyArray<readonly [unknown, string]> = [
      [config.praeformaUrl, report.sources.praeforma],
      [config.elegantiaUrl, report.sources.elegantia],
      [config.concordiaUrl, report.sources.concordia],
      [config.voluptasDataDir, report.sources.voluptas],
      [config.cloudflareAccess, report.access.cloudflareAccess],
    ];
    for (const [value, state] of pairs) if (state !== (value ? 'configured' : 'not_connected')) return 'capability state does not follow its configuration';
    const text = JSON.stringify(report);
    const hidden = [
      config.praeformaUrl,
      config.elegantiaUrl,
      config.concordiaUrl,
      config.voluptasDataDir,
      config.dataDir,
      config.access.publicOrigin,
      config.cloudflareAccess?.issuer.replace(/^https:\/\//, ''),
      config.cloudflareAccess?.audience,
    ];
    for (const value of hidden) {
      if (value && text.includes(JSON.stringify(value).slice(1, -1))) return 'health exposes a URL, path or Access identifier';
    }
    return true;
  },
} satisfies ContractOf<typeof describeHealth>;
