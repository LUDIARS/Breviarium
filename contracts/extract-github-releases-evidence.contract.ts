// @implements SPEC-br-grading
import type { extractGithubReleasesEvidence } from '../src/inspections/extractors/github-releases.ts';
import type { ContractOf } from './contract-types.ts';

const EVIDENCE_KEYS = new Set(['repository', 'releases']);
const RELEASE_KEYS = new Set(['tag', 'publishedAt', 'prerelease']);

/** C-47: each release keeps its tag, publishedAt and prerelease flag only, and an output that is not an array is a github_shape failure. */
export default {
  post: (result, repository, body) => {
    if (!Array.isArray(body)) {
      if (result.ok) return 'accepted an output that is not an array';
      return result.error.code === 'github_shape' ? true : `unexpected failure code ${result.error.code}`;
    }
    if (!result.ok) return `failed on an array: ${result.error.code}`;
    if (result.value.repository !== repository) return 'evidence names another repository';
    const extra = Object.keys(result.value).find((key) => !EVIDENCE_KEYS.has(key));
    if (extra) return `evidence keeps ${extra}`;
    for (const release of result.value.releases) {
      const kept = Object.keys(release).find((key) => !RELEASE_KEYS.has(key));
      if (kept) return `a release keeps ${kept}`;
    }
    return true;
  },
} satisfies ContractOf<typeof extractGithubReleasesEvidence>;
