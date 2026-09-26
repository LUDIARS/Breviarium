import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { ConfigError, loadConfig } from '../../src/adapters/config/load-config.ts';
import { ProjectFileStore, PROJECTS_FILE } from '../../src/adapters/storage/project-file-store.ts';
import { SnapshotFileStore, SNAPSHOTS_DIR } from '../../src/adapters/storage/snapshot-file-store.ts';
import type { SourceSnapshot } from '../../src/snapshots/domain/model.ts';
import { NOW, project } from '../support/fixtures.ts';

async function withDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'breviarium-'));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const snap: SourceSnapshot = {
  projectCode: 'Br',
  source: 'git',
  sourceVersion: 1,
  subject: 'repo:E:/Work/Breviarium',
  data: { headSha: 'a' },
  dataFetchedAt: NOW,
  attemptedAt: NOW,
  status: 'ok',
  error: null,
};

describe('project file store', () => {
  it('persists the register and reloads it, looking codes up ignoring case', async () => {
    await withDir(async (dir) => {
      const store = await ProjectFileStore.open(dir);
      await store.put(project());
      const reopened = await ProjectFileStore.open(dir);
      assert.deepEqual(await reopened.get('br'), project());
      assert.match(await readFile(join(dir, PROJECTS_FILE), 'utf8'), /"version": 1/);
      assert.equal(await reopened.remove('BR'), true);
      assert.deepEqual(await (await ProjectFileStore.open(dir)).list(), []);
    });
  });

  it('refuses a register of an unknown format instead of starting empty', async () => {
    await withDir(async (dir) => {
      await writeFile(join(dir, PROJECTS_FILE), JSON.stringify({ version: 99, projects: [] }), 'utf8');
      await assert.rejects(ProjectFileStore.open(dir), /unsupported format/);
    });
  });
});

describe('snapshot file store', () => {
  it('stores one file per source under data/snapshots/<code>/ and purges a project', async () => {
    await withDir(async (dir) => {
      const store = new SnapshotFileStore(dir);
      await store.put(snap);
      await store.put({ ...snap, source: 'praeforma', subject: 'praeforma:PF01' });
      assert.deepEqual(await store.get('Br', 'git'), snap);
      assert.equal((await store.listByProject('Br')).length, 2);
      assert.match(await readFile(join(dir, SNAPSHOTS_DIR, 'Br', 'git.json'), 'utf8'), /"headSha"/);
      await store.purgeProject('Br');
      assert.deepEqual(await store.listByProject('Br'), []);
    });
  });

  it('treats an unreadable or foreign snapshot as absent and refuses unsafe codes', async () => {
    await withDir(async (dir) => {
      const store = new SnapshotFileStore(dir);
      await store.put(snap);
      await writeFile(join(dir, SNAPSHOTS_DIR, 'Br', 'git.json'), '{ broken', 'utf8');
      assert.equal(await store.get('Br', 'git'), undefined);
      await writeFile(join(dir, SNAPSHOTS_DIR, 'Br', 'git.json'), JSON.stringify({ ...snap, projectCode: 'Other' }), 'utf8');
      assert.equal(await store.get('Br', 'git'), undefined);
      await assert.rejects(store.put({ ...snap, projectCode: '../x' }));
    });
  });
});

describe('config', () => {
  const base = { BREVIARIUM_DATA_DIR: 'data', BREVIARIUM_HOST: '127.0.0.1', BREVIARIUM_PORT: '4370' };

  it('fails fast on missing or invalid required values', () => {
    assert.throws(() => loadConfig({ ...base, BREVIARIUM_DATA_DIR: '' }), ConfigError);
    assert.throws(() => loadConfig({ ...base, BREVIARIUM_PORT: 'x' }), ConfigError);
    assert.throws(() => loadConfig({ ...base, BREVIARIUM_HOST: '0.0.0.0' }), ConfigError);
  });

  it('uses the documented defaults and leaves unset sources not connected', () => {
    const c = loadConfig(base);
    assert.equal(c.sourceTimeoutMs, 5000);
    assert.equal(c.refreshIntervalSec, 0);
    assert.equal(c.snapshotMaxAgeHours, 24);
    assert.equal(c.praeformaUrl, undefined);
    assert.equal(c.elegantiaUrl, undefined);
    assert.equal(c.concordiaUrl, undefined);
    assert.equal(c.actioUrl, undefined);
    assert.equal(c.excubitorUrl, undefined);
    assert.equal(c.voluptasDataDir, undefined);
    assert.ok(c.access.hosts.has('127.0.0.1:4370'));
  });

  it('reads topology URLs and lets the explicit Breviarium URL win', () => {
    const c = loadConfig({ ...base, PRAEFORMA_URL: 'http://127.0.0.1:1/', CONCORDIA_URL: 'http://127.0.0.1:2', BREVIARIUM_CONCORDIA_URL: 'http://127.0.0.1:3' });
    assert.equal(c.praeformaUrl, 'http://127.0.0.1:1');
    assert.equal(c.concordiaUrl, 'http://127.0.0.1:3');
    assert.throws(() => loadConfig({ ...base, ELEGANTIA_URL: 'ftp://x' }), ConfigError);
  });

  it('reads ACTIO_URL from the topology and lets BREVIARIUM_ACTIO_URL win', () => {
    assert.equal(loadConfig({ ...base, ACTIO_URL: 'http://127.0.0.1:5/' }).actioUrl, 'http://127.0.0.1:5');
    assert.equal(loadConfig({ ...base, ACTIO_URL: 'http://127.0.0.1:5', BREVIARIUM_ACTIO_URL: 'http://127.0.0.1:6' }).actioUrl, 'http://127.0.0.1:6');
    assert.throws(() => loadConfig({ ...base, ACTIO_URL: 'ftp://x' }), ConfigError);
  });

  it('reads EXCUBITOR_URL from the topology and lets BREVIARIUM_EXCUBITOR_URL win', () => {
    assert.equal(loadConfig({ ...base, EXCUBITOR_URL: 'http://127.0.0.1:7/' }).excubitorUrl, 'http://127.0.0.1:7');
    assert.equal(loadConfig({ ...base, EXCUBITOR_URL: 'http://127.0.0.1:7', BREVIARIUM_EXCUBITOR_URL: 'http://127.0.0.1:8' }).excubitorUrl, 'http://127.0.0.1:8');
    assert.throws(() => loadConfig({ ...base, EXCUBITOR_URL: 'ftp://x' }), /EXCUBITOR_URL/);
  });

  it('no longer reads the retired stage staleness settings (the workflow has no stale state)', () => {
    const c = loadConfig({ ...base, BREVIARIUM_STALE_AFTER_DAYS: '0', BREVIARIUM_STALE_COMMIT_LAG_DAYS: 'x', BREVIARIUM_REVIEW_STALE_DAYS: '-1' });
    assert.equal(c.snapshotMaxAgeHours, 24);
    for (const key of ['staleAfterDays', 'staleCommitLagDays', 'reviewStaleDays']) assert.equal(key in c, false, key);
  });

  it('keeps the periodic refresh off unless set to 60 seconds or more', () => {
    assert.equal(loadConfig({ ...base, BR_REFRESH_INTERVAL_SEC: '600' }).refreshIntervalSec, 600);
    assert.equal(loadConfig({ ...base, BR_REFRESH_INTERVAL_SEC: '0' }).refreshIntervalSec, 0);
    assert.throws(() => loadConfig({ ...base, BR_REFRESH_INTERVAL_SEC: '5' }), ConfigError);
  });

  it('reads BREVIARIUM_REFRESH_INTERVAL_SEC (the catalog runs 3600) before the former BR_ name', () => {
    assert.equal(loadConfig({ ...base, BREVIARIUM_REFRESH_INTERVAL_SEC: '3600' }).refreshIntervalSec, 3600);
    assert.equal(loadConfig({ ...base, BREVIARIUM_REFRESH_INTERVAL_SEC: '0', BR_REFRESH_INTERVAL_SEC: '600' }).refreshIntervalSec, 0);
    assert.equal(loadConfig({ ...base, BREVIARIUM_REFRESH_INTERVAL_SEC: ' ', BR_REFRESH_INTERVAL_SEC: '600' }).refreshIntervalSec, 600);
    assert.throws(() => loadConfig({ ...base, BREVIARIUM_REFRESH_INTERVAL_SEC: '59' }), /BREVIARIUM_REFRESH_INTERVAL_SEC/);
  });

  it('takes the Anatomia / Revisor CLIs only as absolute paths (unset = not connected)', () => {
    const cli = join(tmpdir(), 'anatomia.mjs');
    const c = loadConfig({ ...base, BREVIARIUM_ANATOMIA_CLI: cli, BREVIARIUM_REVISOR_CLI: join(tmpdir(), 'cli.mjs') });
    assert.equal(c.anatomiaCliPath, cli);
    assert.equal(c.revisorCliPath, join(tmpdir(), 'cli.mjs'));
    const unset = loadConfig(base);
    assert.equal(unset.anatomiaCliPath, undefined);
    assert.equal(unset.revisorCliPath, undefined);
    assert.throws(() => loadConfig({ ...base, BREVIARIUM_ANATOMIA_CLI: 'bin/anatomia.mjs' }), ConfigError);
  });

  it('reads the service links: topology URLs for loopback users, the catalog-declared public URLs for viewers', () => {
    const c = loadConfig({
      ...base,
      PRAEFORMA_URL: 'http://127.0.0.1:8889/',
      ANATOMIA_URL: 'http://127.0.0.1:4200',
      ACTIO_URL: 'http://127.0.0.1:17880',
      ACTIO_FRONTEND_URL: 'http://127.0.0.1:5173',
      BREVIARIUM_LINK_PRAEFORMA: 'https://pf.example.test',
      BREVIARIUM_LINK_ACTIO: 'https://actio.example.test/',
    });
    assert.deepEqual(c.serviceLinks, {
      local: { praeforma: 'http://127.0.0.1:8889', anatomia: 'http://127.0.0.1:4200', actio: 'http://127.0.0.1:5173' },
      viewer: { praeforma: 'https://pf.example.test', actio: 'https://actio.example.test' },
    });
    assert.equal(loadConfig({ ...base, ACTIO_URL: 'http://127.0.0.1:17880' }).serviceLinks.local.actio, 'http://127.0.0.1:17880');
    assert.deepEqual(loadConfig(base).serviceLinks, { local: {}, viewer: {} });
    for (const bad of ['pf.example.test', 'ftp://pf.example.test', 'https://user:pw@pf.example.test', 'https://pf.example.test/base', 'https://pf.example.test/?x=1']) {
      assert.throws(() => loadConfig({ ...base, BREVIARIUM_LINK_PRAEFORMA: bad }), /BREVIARIUM_LINK_PRAEFORMA/, bad);
    }
  });

  it('bounds the Anatomia CLI run by BREVIARIUM_ANATOMIA_CLI_TIMEOUT_MS (default 120000, 1000..600000)', () => {
    assert.equal(loadConfig(base).anatomiaCliTimeoutMs, 120_000);
    assert.equal(loadConfig({ ...base, BREVIARIUM_ANATOMIA_CLI_TIMEOUT_MS: ' ' }).anatomiaCliTimeoutMs, 120_000);
    assert.equal(loadConfig({ ...base, BREVIARIUM_ANATOMIA_CLI_TIMEOUT_MS: '300000' }).anatomiaCliTimeoutMs, 300_000);
    assert.equal(loadConfig({ ...base, BREVIARIUM_ANATOMIA_CLI_TIMEOUT_MS: '600000' }).anatomiaCliTimeoutMs, 600_000);
    for (const bad of ['600001', '999', '0', '-1', '12.5', 'slow']) {
      assert.throws(() => loadConfig({ ...base, BREVIARIUM_ANATOMIA_CLI_TIMEOUT_MS: bad }), /BREVIARIUM_ANATOMIA_CLI_TIMEOUT_MS must be an integer in 1000\.\.600000/, bad);
    }
  });

  it('requires an absolute Voluptas data directory', () => {
    assert.throws(() => loadConfig({ ...base, BREVIARIUM_VOLPUTAS_DATA_DIR: 'relative/dir' }), ConfigError);
    assert.equal(loadConfig({ ...base, BREVIARIUM_VOLPUTAS_DATA_DIR: join(tmpdir(), 'v') }).voluptasDataDir, join(tmpdir(), 'v'));
  });
});
