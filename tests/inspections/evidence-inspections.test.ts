import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inspectDomainCoverage, inspectVerify } from '../../src/inspections/domain/anatomia-inspections.ts';
import type { AnatomiaCoverageEvidence, MergedPrReviewFact, PraeformaAcceptanceEvidence, RevisorEvidence } from '../../src/inspections/domain/evidence.ts';
import type { Inspection } from '../../src/inspections/domain/model.ts';
import { inspectPraeformaAcceptance } from '../../src/inspections/domain/praeforma-inspections.ts';
import { inspectMergeRisk } from '../../src/inspections/domain/revisor-inspections.ts';
import { inspectConcordia } from '../../src/inspections/domain/service-inspections.ts';
import { extractAnatomiaCoverageEvidence } from '../../src/inspections/extractors/anatomia-coverage.ts';
import { extractDomainReviewsEvidence } from '../../src/inspections/extractors/concordia-reviews.ts';
import { extractPraeformaAcceptanceEvidence } from '../../src/inspections/extractors/praeforma-acceptance.ts';
import { extractRevisorEvidence, latestMergedPrNumbers, revisorLocalVersion, revisorRegistration } from '../../src/inspections/extractors/revisor.ts';
import { concordia } from '../support/fixtures.ts';

function only(inspections: readonly Inspection[]): Inspection {
  assert.equal(inspections.length, 1);
  return inspections[0] as Inspection;
}

function coverage(classified: number, total: number): AnatomiaCoverageEvidence {
  return { project: 'br', layersDeclared: true, modules: { total: 4, classified: 3 }, symbols: { total, classified }, domainCount: 3 };
}

function pr(number: number, day: number, facts: Partial<MergedPrReviewFact> = {}): MergedPrReviewFact {
  return { number, mergedAt: `2026-09-${String(day).padStart(2, '0')}T00:00:00.000Z`, mergeCommit: null, anatomiaGate: null, mergeRisk: null, ...facts };
}

const revisorOf = (merged: MergedPrReviewFact[]): RevisorEvidence => ({ repository: 'LUDIARS/Breviarium', registered: true, localVersion: null, merged });
const facts = { registered: true, localVersion: '1.0.0' };
const gate = (status: string, advisoryCount = 0) => ({ anatomiaGate: { status, advisoryCount } });
const risk = (band: string, score: number | null = 10) => ({ mergeRisk: { band, score } });

function acceptance(passed: number, failed: number, blocked: number, pending = 0, runs = 1): PraeformaAcceptanceEvidence {
  return {
    projectId: 'PF01',
    runs: { total: runs, byStatus: runs ? { completed: runs } : {} },
    latestRun: runs ? { status: 'completed', startedAt: '2026-09-25T00:00:00.000Z', finishedAt: '2026-09-25T01:00:00.000Z', version: '0.0.13' } : null,
    results: { total: passed + failed + blocked + pending, passed, failed, blocked, pending },
    specVersion: '0.0.13',
  };
}

describe('anatomia/domain-coverage', () => {
  it('counts modules and symbols in a declared layer and keeps nothing else', () => {
    const body = {
      repoPath: 'E:\\Document\\Ars\\X',
      configPresent: false,
      modules: [
        { moduleId: 'src/a', layer: 'domain', symbolCount: 9, files: ['src/a/x.ts'] },
        { moduleId: 'src/b', layer: '', symbolCount: 1, files: ['src/b/y.ts'] },
        { moduleId: 'src/c', layer: null, symbolCount: -3 },
        'not a module',
      ],
      totals: { domains: 1 },
    };
    const result = extractAnatomiaCoverageEvidence('x', body);
    assert.ok(result.ok);
    assert.deepEqual(result.value, { project: 'x', layersDeclared: false, modules: { total: 3, classified: 1 }, symbols: { total: 10, classified: 9 }, domainCount: 1 });
    for (const bad of [null, [], {}, { modules: 'x' }]) {
      const r = extractAnatomiaCoverageEvidence('x', bad);
      assert.equal(!r.ok && r.error.code, 'anatomia_shape');
    }
  });

  it('grades the classified-symbol share at the fixed boundaries; no symbol is `—`, no snapshot is not measured', () => {
    const cases: Array<[number, number, string]> = [[90, 100, 'A'], [8999, 10000, 'B'], [70, 100, 'B'], [6999, 10000, 'C'], [50, 100, 'C'], [49, 100, 'D'], [0, 100, 'D']];
    for (const [classified, total, grade] of cases) assert.equal(only(inspectDomainCoverage(coverage(classified, total))).grade, grade, `${classified}/${total}`);
    const none = only(inspectDomainCoverage(coverage(0, 0)));
    assert.equal(none.status, 'measured');
    assert.equal(none.grade, '—');
    const missing = only(inspectDomainCoverage(null));
    assert.equal(missing.status, 'not-measured');
    assert.equal(missing.score, null);
    const graded = only(inspectDomainCoverage({ ...coverage(90, 100), layersDeclared: false }));
    assert.match(graded.scoreLabel, /所属 90\/100 symbol \(90%\)・module 3\/4・ドメイン 3・\.anatomia\/layers\.json なし/);
    assert.equal(graded.evidence[0]?.location, 'anatomia domains program --project br');
  });
});

describe('Revisor PRs, anatomia/verify and revisor/merge-risk', () => {
  it('picks the newest merged PRs of the repository from the listing', () => {
    const list = [
      { number: 1, repository: 'ludiars/breviarium', status: 'merged', mergedAt: '2026-09-01T00:00:00Z' },
      { number: 2, repository: 'LUDIARS/Breviarium', status: 'merged', mergedAt: '2026-09-03T00:00:00Z' },
      { number: 3, repository: 'LUDIARS/Breviarium', status: 'open', mergedAt: null },
      { number: 4, repository: 'LUDIARS/Other', status: 'merged', mergedAt: '2026-09-09T00:00:00Z' },
      { number: 5, repository: 'LUDIARS/Breviarium', status: 'merged', mergedAt: null },
      { number: 6, repository: 'LUDIARS/Breviarium', status: 'merged', mergedAt: '2026-09-02T00:00:00Z' },
      { number: 'x', repository: 'LUDIARS/Breviarium', status: 'merged' },
    ];
    const picked = latestMergedPrNumbers(list, 'LUDIARS/Breviarium', 3);
    assert.ok(picked.ok);
    assert.deepEqual(picked.value, [2, 6, 1]);
    const all = latestMergedPrNumbers(list, 'LUDIARS/Breviarium', 10);
    assert.deepEqual(all.ok && all.value, [2, 6, 1, 5]);
    const bad = latestMergedPrNumbers({ prs: [] }, 'LUDIARS/Breviarium', 5);
    assert.equal(!bad.ok && bad.error.code, 'revisor_shape');
  });

  it('keeps the gate status, advisory count, band and score of each shown PR, and refuses a PR of another repository', () => {
    const show = { number: 7, repository: 'LUDIARS/Breviarium', mergedAt: '2026-09-07T00:00:00Z', mergeCommitSha: 'd'.repeat(40), anatomiaGate: { status: 'PASSED', advisories: ['a', 'b'] }, mergeRisk: { band: 'Medium', score: 30 }, body: 'x' };
    const result = extractRevisorEvidence('LUDIARS/Breviarium', [show, { ...show, number: 8, mergedAt: '2026-09-08T00:00:00Z', anatomiaGate: null, mergeRisk: { band: '<b>' } }], facts);
    assert.ok(result.ok);
    assert.deepEqual({ registered: result.value.registered, localVersion: result.value.localVersion }, facts);
    assert.deepEqual(result.value.merged, [
      { number: 8, mergedAt: '2026-09-08T00:00:00.000Z', mergeCommit: 'd'.repeat(40), anatomiaGate: null, mergeRisk: null },
      { number: 7, mergedAt: '2026-09-07T00:00:00.000Z', mergeCommit: 'd'.repeat(40), anatomiaGate: { status: 'passed', advisoryCount: 2 }, mergeRisk: { band: 'medium', score: 30 } },
    ]);
    const foreign = extractRevisorEvidence('LUDIARS/Breviarium', [{ ...show, repository: 'LUDIARS/Other' }], facts);
    assert.equal(!foreign.ok && foreign.error.code, 'revisor_shape');
  });

  it('reads the Revisor registration from repo list (ignoring case) and the release version from version show', () => {
    const list = [{ repository: 'ludiars/breviarium', rootPath: 'E:/Work/Breviarium', baseRef: 'main' }, { repository: 'LUDIARS/Other' }];
    assert.deepEqual(revisorRegistration(list, 'LUDIARS/Breviarium'), { ok: true, value: true });
    assert.deepEqual(revisorRegistration(list, 'LUDIARS/Nope'), { ok: true, value: false });
    const bad = revisorRegistration({ repositories: [] }, 'LUDIARS/Breviarium');
    assert.equal(!bad.ok && bad.error.code, 'revisor_shape');
    assert.equal(revisorLocalVersion('1.2.3\n'), '1.2.3');
    assert.equal(revisorLocalVersion('uninitialized\n'), 'uninitialized');
    for (const junk of ['01.2.3', 'v1.2.3', 'Error: x', '', null]) assert.equal(revisorLocalVersion(junk), null, String(junk));
  });

  it('verify: the newest merge decides — passed A, passed with advisories B, failed D; otherwise `—`', () => {
    const cases: Array<[MergedPrReviewFact[], string, string]> = [
      [[pr(2, 2, gate('passed')), pr(1, 1, gate('failed'))], 'A', 'graded'],
      [[pr(1, 1, gate('failed')), pr(2, 2, gate('passed', 3))], 'B', 'graded'],
      [[pr(3, 3, gate('failed'))], 'D', 'graded'],
      [[pr(3, 3)], '—', 'measured'],
      [[pr(3, 3, gate('skipped'))], '—', 'measured'],
      [[], '—', 'measured'],
    ];
    for (const [merged, grade, status] of cases) {
      const i = only(inspectVerify(revisorOf(merged)));
      assert.equal(i.grade, grade, JSON.stringify(merged));
      assert.equal(i.status, status);
    }
    const b = only(inspectVerify(revisorOf([pr(2, 2, { ...gate('passed', 3), mergeCommit: 'e'.repeat(40) })])));
    assert.equal(b.scoreLabel, '#2 passed (所見 3)');
    assert.equal(b.commit, 'e'.repeat(40));
    assert.equal(b.evidence[0]?.location, 'revisor pr show 2');
    assert.equal(only(inspectVerify(null)).status, 'not-measured');
  });

  it('merge-risk: the worst band of the newest five — low A, medium B, high C, critical D; no band `—`', () => {
    for (const [band, grade] of [['low', 'A'], ['medium', 'B'], ['high', 'C'], ['critical', 'D']] as const) {
      assert.equal(only(inspectMergeRisk(revisorOf([pr(1, 1, risk(band))]))).grade, grade, band);
    }
    const mixed = only(inspectMergeRisk(revisorOf([pr(5, 5, risk('low')), pr(4, 4, risk('high', 48)), pr(3, 3, risk('medium')), pr(2, 2, risk('low')), pr(1, 1, risk('low'))])));
    assert.equal(mixed.grade, 'C');
    assert.equal(mixed.scoreLabel, '直近 5 件の最悪 high (#4 score 48)・low 3 / medium 1 / high 1');
    assert.equal(mixed.evidence.length, 5);
    const sixthIgnored = [pr(6, 6, risk('low')), pr(5, 5, risk('low')), pr(4, 4, risk('low')), pr(3, 3, risk('low')), pr(2, 2, risk('low')), pr(1, 1, risk('critical'))];
    assert.equal(only(inspectMergeRisk(revisorOf(sixthIgnored))).grade, 'A');
    const unknownBand = only(inspectMergeRisk(revisorOf([pr(1, 1, risk('extreme')), pr(2, 2)])));
    assert.equal(unknownBand.grade, '—');
    assert.equal(unknownBand.status, 'measured');
    assert.equal(only(inspectMergeRisk(revisorOf([]))).grade, '—');
    assert.equal(only(inspectMergeRisk(null)).status, 'not-measured');
  });
});

describe('praeforma/acceptance', () => {
  it('keeps counts and the latest run, never the run id; refuses an answer without runs / results', () => {
    const body = { runs: { total: 2, byStatus: { completed: 2, 'Bad Key': 1 } }, latestRun: { id: 'run_9', status: 'completed', startedAt: 1_790_000_000 }, results: { passed: 3, failed: -1 }, specVersion: '1.0.0' };
    const result = extractPraeformaAcceptanceEvidence('PF01', body);
    assert.ok(result.ok);
    assert.deepEqual(result.value.runs, { total: 2, byStatus: { completed: 2 } });
    assert.deepEqual(result.value.results, { total: 0, passed: 3, failed: 0, blocked: 0, pending: 0 });
    assert.equal(result.value.latestRun?.startedAt, '2026-09-21T14:13:20.000Z');
    assert.equal(JSON.stringify(result.value).includes('run_9'), false);
    for (const bad of [null, { runs: {} }, { results: {} }]) {
      const r = extractPraeformaAcceptanceEvidence('PF01', bad);
      assert.equal(!r.ok && r.error.code, 'praeforma_shape');
    }
  });

  it('grades passed / (passed + failed + blocked) at the fixed boundaries; no run or nothing decided is `—`', () => {
    const cases: Array<[number, number, number, string]> = [[9, 1, 0, 'A'], [89, 6, 5, 'B'], [7, 2, 1, 'B'], [69, 21, 10, 'C'], [5, 4, 1, 'C'], [49, 50, 1, 'D'], [0, 1, 0, 'D']];
    for (const [passed, failed, blocked, grade] of cases) assert.equal(only(inspectPraeformaAcceptance(acceptance(passed, failed, blocked, 4))).grade, grade, `${passed}/${failed}/${blocked}`);
    const noRun = only(inspectPraeformaAcceptance(acceptance(0, 0, 0, 0, 0)));
    assert.equal(noRun.grade, '—');
    assert.equal(noRun.scoreLabel, '受入 run 0 件');
    const pendingOnly = only(inspectPraeformaAcceptance(acceptance(0, 0, 0, 5)));
    assert.equal(pendingOnly.grade, '—');
    assert.equal(pendingOnly.status, 'measured');
    const graded = only(inspectPraeformaAcceptance(acceptance(7, 2, 1, 4)));
    assert.equal(graded.scoreLabel, '合格 7/10 (failed 2、blocked 1、pending 4、版 0.0.13)');
    assert.equal(graded.measuredAt, '2026-09-25T01:00:00.000Z');
    assert.equal(graded.evidence[0]?.location, '/api/projects/PF01/acceptance/summary');
    assert.equal(only(inspectPraeformaAcceptance(null)).status, 'not-measured');
  });
});

describe('Concordia domain-review posts', () => {
  it('counts the posts of the code only, with the newest posted_at (seconds or ISO)', () => {
    const body = { posts: [{ code: 'Br', posted_at: 1_790_000_000 }, { code: 'Br', posted_at: '2026-09-25T00:00:00Z' }, { code: 'br', posted_at: '2026-09-30T00:00:00Z' }, { code: 'Br' }, null] };
    const result = extractDomainReviewsEvidence('Br', body);
    assert.ok(result.ok);
    assert.deepEqual(result.value, { code: 'Br', postCount: 3, latestPostedAt: '2026-09-25T00:00:00.000Z' });
    const empty = extractDomainReviewsEvidence('Br', { posts: [] });
    assert.deepEqual(empty.ok && empty.value, { code: 'Br', postCount: 0, latestPostedAt: null });
    const bad = extractDomainReviewsEvidence('Br', { items: [] });
    assert.equal(!bad.ok && bad.error.code, 'concordia_shape');
  });

  it('concordia/harness lists the newest review post with its time', () => {
    const harness = only(inspectConcordia(concordia(), { code: 'Br', postCount: 2, latestPostedAt: '2026-09-25T00:00:00.000Z' }));
    const post = harness.evidence.find((e) => e.location === '/v1/domain-review/posts?code=Br');
    assert.equal(post?.at, '2026-09-25T00:00:00.000Z');
    assert.match(post?.label ?? '', /最新、2 件中/);
    const none = only(inspectConcordia(concordia(), { code: 'Br', postCount: 0, latestPostedAt: null }));
    assert.match(none.evidence.find((e) => e.location.startsWith('/v1/domain-review'))?.label ?? '', /なし/);
    assert.equal(only(inspectConcordia(concordia(), null)).evidence.some((e) => e.location.startsWith('/v1/domain-review')), false);
  });
});
