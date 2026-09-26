import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { extractServiceCatalog } from '../../src/inspections/extractors/service-catalog.ts';

describe('service catalog extractor (excubitor.catalog.yaml)', () => {
  it("reads Breviarium's own catalog: code and declarations, never env values, commands or URLs", async () => {
    const text = await readFile(new URL('../../excubitor.catalog.yaml', import.meta.url), 'utf8');
    const services = extractServiceCatalog(text);
    assert.deepEqual(services, [{ code: 'breviarium', dependsOn: [], declarations: ['required_env', 'provides'] }]);
    assert.doesNotMatch(JSON.stringify(services), /127\.0\.0\.1|node src|ARS_ROOT|LUDIARS_ALLOWED_HOSTS/);
  });

  it('reads depends_on as a block or inline list, hubs (uses_corpus: true, cernere_launch_credentials) and skips empty declarations', () => {
    const text = [
      '# comment line',
      'services:',
      '  - code: api # trailing comment',
      '    name: API',
      '    depends_on:',
      '      - cernere',
      '      - "actio"',
      '    required_env: []',
      '    provides: {}',
      '    uses_corpus: false',
      '    env:',
      '      SECRET_TOKEN: abc',
      '  - name: Front',
      '    code: front',
      '    depends_on: [api, bad code]',
      '    uses_corpus: true',
      '    cernere_launch_credentials:',
      '      target_project: front',
      '  - code: "plain"',
      '    command: node x.mjs',
      'other:',
      '  - code: not-a-service',
    ].join('\n');
    assert.deepEqual(extractServiceCatalog(text), [
      { code: 'api', dependsOn: ['cernere', 'actio'], declarations: ['depends_on'] },
      { code: 'front', dependsOn: ['api'], declarations: ['depends_on', 'uses_corpus', 'cernere_launch_credentials'] },
      { code: 'plain', dependsOn: [], declarations: [] },
    ]);
  });

  it('gives no services for a file without a services list', () => {
    for (const text of ['', 'services: []', 'name: x', 'services:\n  code: x']) assert.deepEqual(extractServiceCatalog(text), [], JSON.stringify(text));
  });
});
