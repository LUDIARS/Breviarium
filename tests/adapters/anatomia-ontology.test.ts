import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { createOntologyLocator, ontologyDirOf } from '../../src/adapters/sources/anatomia-ontology.ts';
import { createAnatomiaSource } from '../../src/adapters/sources/anatomia-source.ts';
import type { GitRunner } from '../../src/adapters/sources/git-source.ts';
import type { AnatomiaEvidence } from '../../src/inspections/domain/evidence.ts';
import { project } from '../support/fixtures.ts';

describe('anatomia ontology directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'br-ontology-'));
  after(() => rm(root, { recursive: true, force: true }));
  const repo = join(root, 'repo');
  const ontology = join(root, 'ontology', 'sample');
  await mkdir(join(repo, 'spec', 'domains'), { recursive: true });
  await mkdir(ontology, { recursive: true });
  await writeFile(join(repo, 'spec', 'domains', 'core.domain.json'), JSON.stringify({ name: 'core', membership: [{ pathPattern: '^src/' }] }));
  await writeFile(join(ontology, 'scoring.4721819b.json'), JSON.stringify({ name: 'scoring', presetRules: [] }));
  await writeFile(join(ontology, 'training.003db464.json'), JSON.stringify({ name: 'training', presetRules: [] }));
  await writeFile(join(ontology, 'notes.txt'), 'not a declaration');
  const git: GitRunner = async () => 'src/a.ts\0src/b.ts\0';
  const sample = project({ code: 'Sm', repoPath: repo, bindings: { anatomiaProject: 'sample' } });

  it('reads the registration\'s ontology directory when it has one, as Anatomia does', async () => {
    const source = createAnatomiaSource(git, { locate: async () => ontology });
    const outcome = await source.fetch(sample);
    assert.equal(outcome.kind, 'ok');
    if (outcome.kind !== 'ok') return;
    const data = outcome.data as AnatomiaEvidence;
    assert.deepEqual(data.declarations.map((d) => [d.path, d.name]), [['ontology/scoring.4721819b.json', 'scoring'], ['ontology/training.003db464.json', 'training']]);
    assert.equal(data.membership.pathPatterns, 0);
    assert.equal(outcome.subject, `repo:${repo}+ontology:sample`);
    assert.doesNotMatch(JSON.stringify(data), new RegExp(ontology.replace(/\\/g, '\\\\')));
  });

  it('falls back to the repository\'s spec/domains without an ontology directory or an Anatomia URL', async () => {
    for (const source of [createAnatomiaSource(git, { locate: async () => null }), createAnatomiaSource(git)]) {
      const outcome = await source.fetch(sample);
      assert.equal(outcome.kind, 'ok');
      if (outcome.kind !== 'ok') return;
      assert.deepEqual((outcome.data as AnatomiaEvidence).declarations.map((d) => d.path), ['spec/domains/core.domain.json']);
      assert.equal(outcome.subject, `repo:${repo}`);
    }
  });

  it('a failed registration lookup fails the attempt (the previous snapshot stays)', async () => {
    const outcome = await createAnatomiaSource(git, { locate: async () => { throw new Error('GET /api/projects: 接続できない'); } }).fetch(sample);
    assert.equal(outcome.kind, 'failed');
  });

  it('takes ontologyDir only from the registration of the project id, as an absolute path to an existing directory', async () => {
    const answer = { projects: [{ id: 'sample', ontologyDir: ontology }, { id: 'other', ontologyDir: 'relative/dir' }, { id: 'none' }] };
    assert.equal(ontologyDirOf(answer, 'sample'), ontology);
    assert.equal(ontologyDirOf(answer, 'other'), null);
    assert.equal(ontologyDirOf(answer, 'none'), null);
    assert.equal(ontologyDirOf(answer, 'missing'), null);
    assert.throws(() => ontologyDirOf({ items: [] }, 'sample'), /形が違う/);
    const fetchImpl = async () => new Response(JSON.stringify({ projects: [{ id: 'sample', ontologyDir: join(root, 'gone') }] }), { headers: { 'content-type': 'application/json' } });
    const locator = createOntologyLocator({ baseUrl: 'http://127.0.0.1:1', fetchImpl, timeoutMs: 1000 });
    assert.equal(await locator.locate(sample), null);
    assert.equal(await createOntologyLocator(undefined).locate(sample), null);
  });
});
