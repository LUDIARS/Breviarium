// @implements SPEC-br-web-ui
import type { describeHealth } from '../src/adapters/http/health.ts';
import type { ContractOf } from './contract-types.ts';

/** C-13: health reports liveness only, follows each source's configuration, and exposes no URL or path. */
export default {
  post: (report, config) => {
    if (report.status !== 'alive' || report.sources.reachability !== 'not_checked') return 'health claims more than liveness';
    const pairs: ReadonlyArray<readonly [string | undefined, string]> = [
      [config.praeformaUrl, report.sources.praeforma],
      [config.elegantiaUrl, report.sources.elegantia],
      [config.concordiaUrl, report.sources.concordia],
      [config.voluptasDataDir, report.sources.voluptas],
    ];
    for (const [value, state] of pairs) if (state !== (value ? 'configured' : 'not_connected')) return 'source state does not follow its configuration';
    const text = JSON.stringify(report);
    for (const value of [config.praeformaUrl, config.elegantiaUrl, config.concordiaUrl, config.voluptasDataDir, config.dataDir]) {
      if (value && text.includes(JSON.stringify(value).slice(1, -1))) return 'health exposes a URL or path';
    }
    return true;
  },
} satisfies ContractOf<typeof describeHealth>;
