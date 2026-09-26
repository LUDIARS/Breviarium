import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import acceptsClaimsContract from '../../contracts/accepts-claims.contract.ts';
import actioSprintsPathContract from '../../contracts/actio-sprints-path.contract.ts';
import admitCloudflareRequestContract from '../../contracts/admit-cloudflare-request.contract.ts';
import admitMethodContract from '../../contracts/admit-method.contract.ts';
import admitWebRequestContract from '../../contracts/admit-web-request.contract.ts';
import applyOutcomeContract from '../../contracts/apply-outcome.contract.ts';
import assessFreshnessContract from '../../contracts/assess-freshness.contract.ts';
import buildInspectionsContract from '../../contracts/build-inspections.contract.ts';
import composeOverviewContract from '../../contracts/compose-overview.contract.ts';
import describeHealthContract from '../../contracts/describe-health.contract.ts';
import elapsedRatioContract from '../../contracts/elapsed-ratio.contract.ts';
import escContract from '../../contracts/esc.contract.ts';
import evaluateStagesContract from '../../contracts/evaluate-stages.contract.ts';
import extractActioEvidenceContract from '../../contracts/extract-actio-evidence.contract.ts';
import extractAnatomiaCoverageEvidenceContract from '../../contracts/extract-anatomia-coverage-evidence.contract.ts';
import extractDomainReviewsEvidenceContract from '../../contracts/extract-domain-reviews-evidence.contract.ts';
import gradeRatioContract from '../../contracts/grade-ratio.contract.ts';
import gradeSprintHealthContract from '../../contracts/grade-sprint-health.contract.ts';
import inspectDomainCoverageContract from '../../contracts/inspect-domain-coverage.contract.ts';
import inspectElegantiaContract from '../../contracts/inspect-elegantia.contract.ts';
import inspectMergeRiskContract from '../../contracts/inspect-merge-risk.contract.ts';
import inspectPraeformaAcceptanceContract from '../../contracts/inspect-praeforma-acceptance.contract.ts';
import inspectTerpsichoreContract from '../../contracts/inspect-terpsichore.contract.ts';
import inspectVerifyContract from '../../contracts/inspect-verify.contract.ts';
import judgePeriodicReviewContract from '../../contracts/judge-periodic-review.contract.ts';
import latestMergedPrNumbersContract from '../../contracts/latest-merged-pr-numbers.contract.ts';
import loadConfigContract from '../../contracts/load-config.contract.ts';
import planRegistrationContract from '../../contracts/plan-registration.contract.ts';
import pullRequestsForContract from '../../contracts/pull-requests-for.contract.ts';
import readCloudflareAccessConfigContract from '../../contracts/read-cloudflare-access-config.contract.ts';
import readPublicOriginContract from '../../contracts/read-public-origin.contract.ts';
import refreshProjectContract from '../../contracts/refresh-project.contract.ts';
import renderIndexPageContract from '../../contracts/render-index-page.contract.ts';
import renderProjectPageContract from '../../contracts/render-project-page.contract.ts';
import reviewStaleReasonsContract from '../../contracts/review-stale-reasons.contract.ts';
import toExecutiveSummaryContract from '../../contracts/to-executive-summary.contract.ts';
import withoutGitConfigInjectionContract from '../../contracts/without-git-config-injection.contract.ts';
import { readCloudflareAccessConfig } from '../../src/adapters/config/cloudflare-access-config.ts';
import { loadConfig } from '../../src/adapters/config/load-config.ts';
import { readPublicOrigin } from '../../src/adapters/config/public-origin.ts';
import { buildWebAccess } from '../../src/adapters/config/web-access.ts';
import { admitMethod } from '../../src/adapters/http/access-level.ts';
import { acceptsClaims } from '../../src/adapters/http/cloudflare-access-claims.ts';
import { admitCloudflareRequest } from '../../src/adapters/http/cloudflare-access-guard.ts';
import type { AccessTokenVerifier } from '../../src/adapters/http/cloudflare-access-verifier.ts';
import { toExecutiveSummary } from '../../src/adapters/http/export/summary-json.ts';
import { describeHealth } from '../../src/adapters/http/health.ts';
import { admitWebRequest } from '../../src/adapters/http/host-origin-guard.ts';
import { actioSprintsPath } from '../../src/adapters/sources/actio-source.ts';
import { withoutGitConfigInjection } from '../../src/adapters/sources/revisor-source.ts';
import { esc } from '../../src/adapters/http/html/escape.ts';
import { renderIndexPage } from '../../src/adapters/http/html/index-page.ts';
import { renderProjectPage } from '../../src/adapters/http/html/project-page.ts';
import type { HttpResponse } from '../../src/adapters/http/http-types.ts';
import { inspectDomainCoverage, inspectVerify } from '../../src/inspections/domain/anatomia-inspections.ts';
import { buildInspections } from '../../src/inspections/domain/build-inspections.ts';
import {
  type AnatomiaCoverageEvidence,
  type ConcordiaEvidence,
  type DomainReviewsEvidence,
  EMPTY_BUNDLE,
  type MergedPrReviewFact,
  type PraeformaAcceptanceEvidence,
  type RevisorEvidence,
} from '../../src/inspections/domain/evidence.ts';
import { gradeRatio } from '../../src/inspections/domain/grading.ts';
import { inspectPraeformaAcceptance } from '../../src/inspections/domain/praeforma-inspections.ts';
import { inspectMergeRisk } from '../../src/inspections/domain/revisor-inspections.ts';
import { inspectElegantia } from '../../src/inspections/domain/service-inspections.ts';
import { gradeSprintHealth } from '../../src/inspections/domain/sprint-health.ts';
import { inspectTerpsichore } from '../../src/inspections/domain/sprint-inspections.ts';
import { elapsedRatio } from '../../src/inspections/domain/sprint-progress.ts';
import { extractActioEvidence } from '../../src/inspections/extractors/actio.ts';
import { extractAnatomiaCoverageEvidence } from '../../src/inspections/extractors/anatomia-coverage.ts';
import { pullRequestsFor } from '../../src/inspections/extractors/concordia.ts';
import { extractDomainReviewsEvidence } from '../../src/inspections/extractors/concordia-reviews.ts';
import { latestMergedPrNumbers } from '../../src/inspections/extractors/revisor.ts';
import { registerProject } from '../../src/registry/application/registry-use-cases.ts';
import { planRegistration } from '../../src/registry/domain/registration-rules.ts';
import { composeOverview } from '../../src/snapshots/application/project-overview.ts';
import { refreshProject } from '../../src/snapshots/application/refresh-use-case.ts';
import { assessFreshness } from '../../src/snapshots/domain/freshness.ts';
import type { SourceSnapshot } from '../../src/snapshots/domain/model.ts';
import { applyOutcome } from '../../src/snapshots/domain/snapshot-rules.ts';
import { evaluateStages } from '../../src/workflow/domain/stage-evaluation.ts';
import { judgePeriodicReview } from '../../src/workflow/domain/stage-rules.ts';
import { DEFAULT_STALE_POLICY, reviewStaleReasons } from '../../src/workflow/domain/staleness.ts';
import { ACCESS_CONFIG, AUD, claims, NOW_MS, NOW_SEC, TEAM } from '../support/access-tokens.ts';
import { actio, actioResponse, actioTeam, activeSprint, concordia, daysAgo, elegantia, fullBundle, NOW, project, sprintTasks, testDeps } from '../support/fixtures.ts';

function coverageOf(classified: number, total: number): AnatomiaCoverageEvidence {
  return { project: 'x', layersDeclared: true, modules: { total: 2, classified: 1 }, symbols: { total, classified }, domainCount: 1 };
}

type Gate = MergedPrReviewFact['anatomiaGate'];

function mergedPr(number: number, day: number, anatomiaGate: Gate, band: string | null = null): MergedPrReviewFact {
  return { number, mergedAt: `2026-09-0${day}T00:00:00.000Z`, mergeCommit: null, anatomiaGate, mergeRisk: band ? { band, score: 1 } : null };
}

const revisorOf = (...merged: MergedPrReviewFact[]): RevisorEvidence => ({ repository: 'LUDIARS/Breviarium', merged });
const passed = (advisoryCount = 0): Gate => ({ status: 'passed', advisoryCount });
const failedGate: Gate = { status: 'failed', advisoryCount: 0 };

function acceptanceOf(passedCount: number, failed: number, blocked: number, runs = 1): PraeformaAcceptanceEvidence {
  return {
    projectId: 'PF01',
    runs: { total: runs, byStatus: {} },
    latestRun: runs ? { status: 'completed', startedAt: null, finishedAt: null, version: null } : null,
    results: { total: passedCount + failed + blocked, passed: passedCount, failed, blocked, pending: 0 },
    specVersion: null,
  };
}

/** The predicates are exercised against the real rules, and against a violation, so they cannot pass vacuously. */
describe('contract predicates hold for the rules', () => {
  const policy = { stale: DEFAULT_STALE_POLICY, snapshotMaxAgeMs: 86_400_000 };
  const snap: SourceSnapshot = { projectCode: 'Br', source: 'git', sourceVersion: 1, subject: 'repo:E:/Work/Breviarium', data: { headSha: 'a' }, dataFetchedAt: NOW, attemptedAt: NOW, status: 'ok', error: null };

  it('C-1 registration', () => {
    const existing = [project()];
    for (const draft of [
      { code: 'Zz', name: 'n', repoPath: 'E:/x', classification: 'public' },
      { code: 'BR', name: 'n', repoPath: 'E:/x', classification: 'public' },
      { code: 'Zz', name: 'n', repoPath: 'x', classification: 'public' },
    ]) {
      assert.equal(planRegistrationContract.post(planRegistration(existing, draft, NOW), existing, draft), true);
    }
    const draft = { code: 'BR', name: 'n', repoPath: 'E:/x', classification: 'public' };
    assert.equal(typeof planRegistrationContract.post({ ok: true, value: project({ code: 'BR' }) }, existing, draft), 'string');
  });

  it('C-2 stages', () => {
    for (const bundle of [EMPTY_BUNDLE, fullBundle()]) assert.equal(evaluateStagesContract.post(evaluateStages(bundle, DEFAULT_STALE_POLICY, NOW), bundle), true);
    const progressed = evaluateStages(fullBundle(), DEFAULT_STALE_POLICY, NOW);
    assert.equal(typeof evaluateStagesContract.post(progressed, EMPTY_BUNDLE), 'string');
  });

  it('C-3 grades', () => {
    for (const r of [null, Number.NaN, 0, 0.49, 0.5, 0.7, 0.9, 1]) assert.equal(gradeRatioContract.post(gradeRatio(r), r), true);
    assert.equal(typeof gradeRatioContract.post('A', null), 'string');
  });

  it('C-4 inspections', () => {
    for (const bundle of [EMPTY_BUNDLE, fullBundle()]) assert.equal(buildInspectionsContract.post(buildInspections(bundle), bundle), true);
    assert.equal(typeof buildInspectionsContract.post(buildInspections(fullBundle()), EMPTY_BUNDLE), 'string');
  });

  it('C-5 Elegantia class', () => {
    for (const e of [null, elegantia(), elegantia({ counts: { none: 3, current: 0, historical_only: 0, passed: 0, failed: 0, blocked: 0, unverified: 0, not_applicable: 0 } })]) {
      assert.equal(inspectElegantiaContract.post(inspectElegantia(e), e), true);
    }
    assert.equal(typeof inspectElegantiaContract.post(inspectElegantia(elegantia()), elegantia({ counts: { ...elegantia().counts, passed: 1 } })), 'string');
  });

  it('C-6 PR repository filter', () => {
    const prs = { grouped: { needs_review: [{ number: 1, repo_origin: 'LUDIARS/A' }, { number: 2, repo_origin: 'LUDIARS/B' }], merged_recent: [] } };
    assert.equal(pullRequestsForContract.post(pullRequestsFor(prs, 'LUDIARS/A'), prs, 'LUDIARS/A'), true);
    const wrong = { ok: true as const, value: { open: [{ number: 2, title: '', url: null, createdAt: null, mergedAt: null, group: 'needs_review' as const }], merged: [] } };
    assert.equal(typeof pullRequestsForContract.post(wrong, prs, 'LUDIARS/A'), 'string');
  });

  it('C-7 keep previous data', () => {
    const ctx = { projectCode: 'Br', source: 'git' as const, at: '2026-09-27T00:00:00.000Z' };
    for (const outcome of [{ kind: 'failed' as const, error: 'x' }, { kind: 'not-connected' as const, reason: 'y' }, { kind: 'ok' as const, data: { v: 1 }, subject: 's' }]) {
      assert.equal(applyOutcomeContract.post(applyOutcome(snap, outcome, ctx), snap, outcome, ctx), true);
    }
    const emptied = { ...snap, data: null, attemptedAt: ctx.at, status: 'failed' as const, error: 'x' };
    assert.equal(typeof applyOutcomeContract.post(emptied, snap, { kind: 'failed', error: 'x' }, ctx), 'string');
  });

  it('C-8 freshness', () => {
    for (const s of [snap, { ...snap, status: 'failed' as const }, { ...snap, dataFetchedAt: '2026-09-01T00:00:00.000Z' }, undefined]) {
      assert.equal(assessFreshnessContract.post(assessFreshness(s, NOW, 3_600_000), s, NOW, 3_600_000), true);
    }
    assert.equal(typeof assessFreshnessContract.post({ state: 'fresh', reasons: [], ageMs: 0 }, { ...snap, status: 'failed' }, NOW, 3_600_000), 'string');
  });

  it('C-9 refresh asks the requested sources only', async () => {
    const { deps, projects, snapshots, clock, sources } = testDeps();
    await registerProject(deps.registry, { code: 'Br', name: 'B', repoPath: 'E:/x', classification: 'public' });
    const refreshDeps = { projects, snapshots, sources, clock };
    for (const requested of [undefined, ['git'], ['praeforma', 'concordia']]) {
      assert.equal(refreshProjectContract.post(await refreshProject(refreshDeps, 'Br', requested), refreshDeps, 'Br', requested), true);
    }
    const all = await refreshProject(refreshDeps, 'Br');
    assert.equal(typeof refreshProjectContract.post(all, refreshDeps, 'Br', ['git']), 'string');
  });

  it('C-10 overview times', () => {
    const overview = composeOverview(project(), [snap], NOW, policy);
    assert.equal(composeOverviewContract.post(overview, project(), [snap]), true);
    assert.equal(typeof composeOverviewContract.post(overview, project(), [{ ...snap, dataFetchedAt: null }]), 'string');
  });

  it('C-11 export classification', () => {
    const failing = { ...snap, status: 'failed' as const, error: "cannot change to 'E:/Work/Breviarium'" };
    for (const p of [project(), project({ classification: 'public' })]) {
      const overview = composeOverview(p, [failing], NOW, policy);
      assert.equal(toExecutiveSummaryContract.post(toExecutiveSummary(overview), overview), true);
    }
    const overview = composeOverview(project(), [failing], NOW, policy);
    const leaking = { ...toExecutiveSummary(overview), notice: `${overview.project.repoPath}` };
    assert.equal(typeof toExecutiveSummaryContract.post(leaking, overview), 'string');
  });

  it('C-12 web entrance', () => {
    const access = buildWebAccess(4370, '.example.test', undefined, 'https://br.example.test');
    for (const headers of [
      { host: '127.0.0.1:4370' },
      { host: 'evil.test' },
      { host: 'localhost:4370', origin: 'https://evil.test' },
      { host: 'br.example.test', origin: 'https://br.example.test' },
      { host: 'other.example.test', origin: 'https://br.example.test' },
    ]) {
      assert.equal(admitWebRequestContract.post(admitWebRequest(headers, access), headers, access), true);
    }
    assert.equal(typeof admitWebRequestContract.post(undefined, { host: 'evil.test' }, access), 'string');
    assert.equal(typeof admitWebRequestContract.post(undefined, { host: 'other.example.test', origin: 'https://br.example.test' }, access), 'string');
  });

  it('C-13 health and C-14 config', () => {
    const env = { BREVIARIUM_DATA_DIR: 'E:/data', BREVIARIUM_HOST: '127.0.0.1', BREVIARIUM_PORT: '4370', CONCORDIA_URL: 'http://127.0.0.1:11111' };
    const config = loadConfig(env);
    assert.equal(loadConfigContract.post(config, env), true);
    assert.equal(typeof loadConfigContract.post({ ...config, refreshIntervalSec: 60 }, env), 'string');
    assert.equal(describeHealthContract.post(describeHealth(config, NOW), config), true);
    const exposing = { ...describeHealth(config, NOW), startedAt: 'http://127.0.0.1:11111' };
    assert.equal(typeof describeHealthContract.post(exposing, config), 'string');
    const published = loadConfig({ ...env, BREVIARIUM_PUBLIC_URL: 'https://br.example.test', BREVIARIUM_CF_ACCESS_TEAM_DOMAIN: TEAM, BREVIARIUM_CF_ACCESS_AUD: AUD });
    assert.equal(describeHealthContract.post(describeHealth(published, NOW), published), true);
    assert.equal(typeof describeHealthContract.post({ ...describeHealth(published, NOW), access: { cloudflareAccess: 'not_connected' } }, published), 'string');
    assert.equal(typeof describeHealthContract.post({ ...describeHealth(published, NOW), startedAt: AUD }, published), 'string');
  });

  it('C-15 escaping', () => {
    for (const v of ['<script>"x"</script>', "it's", 'plain', null, 3]) assert.equal(escContract.post(esc(v)), true);
    assert.equal(typeof escContract.post('<b>'), 'string');
  });

  it('C-16 public origin', () => {
    for (const value of ['https://br.example.test', 'https://br.example.test:8443', undefined, ' ']) {
      assert.equal(readPublicOriginContract.post(readPublicOrigin(value), value), true);
    }
    assert.equal(typeof readPublicOriginContract.post('https://br.example.test/app', 'https://br.example.test/app'), 'string');
    assert.equal(typeof readPublicOriginContract.post('http://br.example.test', 'http://br.example.test'), 'string');
    assert.equal(typeof readPublicOriginContract.post(undefined, 'https://br.example.test'), 'string');
  });

  it('C-17 Cloudflare Access config', () => {
    const json = JSON.stringify({ cloudflareAccess: { teamDomain: TEAM, audience: AUD } });
    for (const env of [{}, { BREVIARIUM_CF_ACCESS_TEAM_DOMAIN: TEAM, BREVIARIUM_CF_ACCESS_AUD: AUD }, { EXCUBITOR_SERVICE_CONFIG_JSON: json }, { EXCUBITOR_SERVICE_CONFIG_JSON: '{}' }]) {
      assert.equal(readCloudflareAccessConfigContract.post(readCloudflareAccessConfig(env), env), true);
    }
    assert.equal(typeof readCloudflareAccessConfigContract.post(undefined, { EXCUBITOR_SERVICE_CONFIG_JSON: json }), 'string');
    assert.equal(typeof readCloudflareAccessConfigContract.post(ACCESS_CONFIG, {}), 'string');
    assert.equal(typeof readCloudflareAccessConfigContract.post({ issuer: 'https://evil.test', audience: AUD }, { BREVIARIUM_CF_ACCESS_TEAM_DOMAIN: TEAM, BREVIARIUM_CF_ACCESS_AUD: AUD }), 'string');
  });

  it('C-18 Access claims', () => {
    for (const payload of [claims(), claims({ aud: AUD }), claims({ iss: 'https://other.cloudflareaccess.com' }), claims({ exp: NOW_SEC }), claims({ nbf: NOW_SEC + 1 }), claims({ exp: undefined })]) {
      assert.equal(acceptsClaimsContract.post(acceptsClaims(payload, ACCESS_CONFIG, NOW_MS), payload, ACCESS_CONFIG, NOW_MS), true);
    }
    assert.equal(typeof acceptsClaimsContract.post(true, claims({ aud: ['x'] }), ACCESS_CONFIG, NOW_MS), 'string');
    assert.equal(typeof acceptsClaimsContract.post(false, claims(), ACCESS_CONFIG, NOW_MS), 'string');
  });

  it('C-19 Cloudflare Access admission', async () => {
    const access = buildWebAccess(4370, '.example.test', undefined, 'https://br.example.test');
    const verdicts: Readonly<Record<string, 'valid' | 'invalid' | 'unavailable'>> = { good: 'valid', bad: 'invalid', down: 'unavailable' };
    const verifier: AccessTokenVerifier = { verify: async (t) => verdicts[t] ?? 'invalid' };
    const cases: Array<[Record<string, string>, AccessTokenVerifier | undefined]> = [
      [{ host: '127.0.0.1:4370' }, verifier],
      [{ host: 'br.example.test', 'cf-access-jwt-assertion': 'good' }, verifier],
      [{ host: 'br.example.test', 'cf-access-jwt-assertion': 'bad' }, verifier],
      [{ host: 'br.example.test', 'cf-access-jwt-assertion': 'down' }, verifier],
      [{ host: '127.0.0.1:4370', 'cf-ray': 'x' }, verifier],
      [{ host: 'br.example.test' }, undefined],
    ];
    const ignore = () => undefined;
    for (const [headers, v] of cases) {
      assert.equal(admitCloudflareRequestContract.post(await admitCloudflareRequest(headers, access, v, ignore), headers, access, v), true, JSON.stringify(headers));
    }
    assert.equal(typeof admitCloudflareRequestContract.post({ level: 'local' }, { host: 'br.example.test' }, access, verifier), 'string');
    assert.equal(typeof admitCloudflareRequestContract.post({ level: 'viewer' }, { host: '127.0.0.1:4370', 'cf-ray': 'x' }, access, verifier), 'string');
  });

  it('C-20 read-only viewer', () => {
    const cases = [['local', 'POST'], ['local', 'DELETE'], ['viewer', 'GET'], ['viewer', 'HEAD'], ['viewer', 'POST'], ['viewer', 'PUT']] as const;
    for (const [level, method] of cases) {
      assert.equal(admitMethodContract.post(admitMethod(level, method), level, method), true);
    }
    assert.equal(typeof admitMethodContract.post(undefined, 'viewer', 'DELETE'), 'string');
    const refusal: HttpResponse = { status: 403, headers: {}, body: '{"error":"read_only_viewer"}' };
    assert.equal(typeof admitMethodContract.post(refusal, 'local', 'POST'), 'string');
  });

  it('C-21 / C-22 viewer pages', () => {
    const overview = composeOverview(project(), [snap], NOW, policy);
    for (const level of ['local', 'viewer'] as const) {
      assert.equal(renderProjectPageContract.post(renderProjectPage(overview, {}, level), overview, {}, level), true, level);
      assert.equal(renderIndexPageContract.post(renderIndexPage([overview], {}, level), [overview], {}, level), true, level);
      assert.equal(renderIndexPageContract.post(renderIndexPage([], {}, level), [], {}, level), true, level);
    }
    assert.equal(typeof renderProjectPageContract.post(renderProjectPage(overview, {}, 'local'), overview, {}, 'viewer'), 'string');
    assert.equal(typeof renderIndexPageContract.post(renderIndexPage([overview], {}, 'local'), [overview], {}, 'viewer'), 'string');
  });

  it('C-23 Actio evidence keeps the contract fields only', () => {
    const noisy = { ...actioResponse(), extra: 'x', teams: [{ ...(actioResponse()['teams'] as object[])[0], members: ['someone'] }] };
    for (const body of [actioResponse(), noisy, { project: 'KD', generatedAt: '2026-09-26T03:00:00Z', teams: [] }, { project: 'KD' }, null, { ...actioResponse(), teams: [{ activeSprint: { startsOn: 'x' } }] }]) {
      assert.equal(extractActioEvidenceContract.post(extractActioEvidence(body), body), true, JSON.stringify(body));
    }
    const leaking = { ok: true as const, value: { ...actio(), teams: [{ ...actioTeam(), members: ['someone'] }] } };
    assert.equal(typeof extractActioEvidenceContract.post(leaking, actioResponse()), 'string');
    assert.equal(typeof extractActioEvidenceContract.post({ ok: true, value: actio() }, { project: 'KD' }), 'string');
    const undated = { ok: true as const, value: actio({ teams: [actioTeam({ activeSprint: activeSprint({ startsOn: '2026-09-22T00:00:00Z' }) })] }) };
    assert.equal(typeof extractActioEvidenceContract.post(undated, actioResponse()), 'string');
  });

  it('C-24 sprint-health class', () => {
    const cases: Array<[number | null, number, number]> = [[0.5, 0.5, 0], [0.35, 0.5, 0], [0.34, 0.5, 0], [0.2, 0.5, 0], [0.19, 0.5, 0], [0.5, 0.5, 1], [0.1, 0.9, 2], [null, 0.5, 1], [1, 0, 0]];
    for (const [c, e, o] of cases) assert.equal(gradeSprintHealthContract.post(gradeSprintHealth(c, e, o), c, e, o), true, JSON.stringify([c, e, o]));
    assert.equal(typeof gradeSprintHealthContract.post('A', 0.5, 0.5, 1), 'string');
    assert.equal(typeof gradeSprintHealthContract.post('C', 0.35, 0.5, 0), 'string');
    assert.equal(typeof gradeSprintHealthContract.post('A', null, 0.5, 0), 'string');
  });

  it('C-25 elapsed ratio', () => {
    for (const today of ['2026-09-01', '2026-09-22', '2026-09-26', '2026-10-05', '2026-10-30']) {
      assert.equal(elapsedRatioContract.post(elapsedRatio('2026-09-22', '2026-10-05', today), '2026-09-22', '2026-10-05', today), true, today);
    }
    assert.equal(elapsedRatioContract.post(elapsedRatio('2026-09-22', '2026-09-22', '2026-09-22'), '2026-09-22', '2026-09-22', '2026-09-22'), true);
    assert.equal(typeof elapsedRatioContract.post(0.9, '2026-09-22', '2026-10-05', '2026-10-05'), 'string');
    assert.equal(typeof elapsedRatioContract.post(0.1, '2026-09-22', '2026-10-05', '2026-09-22'), 'string');
    assert.equal(typeof elapsedRatioContract.post(1.2, '2026-09-22', '2026-10-05', '2026-09-26'), 'string');
  });

  it('C-26 lowest team class', () => {
    const ahead = actioTeam({ teamId: 'a', activeSprint: activeSprint({ tasks: sprintTasks({ project: { total: 4, byStatus: { done: 4 } }, overdue: 0 }) }) });
    for (const e of [null, actio(), actio({ teams: [] }), actio({ teams: [actioTeam({ activeSprint: null })] }), actio({ teams: [ahead, actioTeam()] })]) {
      assert.equal(inspectTerpsichoreContract.post(inspectTerpsichore(e), e), true, JSON.stringify(e?.teams.length));
    }
    const two = actio({ teams: [ahead, actioTeam()] });
    assert.equal(typeof inspectTerpsichoreContract.post(inspectTerpsichore(actio({ teams: [ahead] })), two), 'string');
    assert.equal(typeof inspectTerpsichoreContract.post(inspectTerpsichore(actio()), null), 'string');
  });

  it('C-28 Anatomia coverage keeps counts only', () => {
    const output = { repoPath: 'E:\\Document\\Ars\\X', configPresent: true, modules: [{ moduleId: 'src/a', layer: 'domain', symbolCount: 4, files: ['src/a/x.ts'] }, { moduleId: 'src/b', layer: null, symbolCount: 1 }], totals: { domains: 1 } };
    for (const body of [output, { modules: [] }, {}, null, { modules: 'x' }]) {
      assert.equal(extractAnatomiaCoverageEvidenceContract.post(extractAnatomiaCoverageEvidence('x', body), 'x', body), true, JSON.stringify(body));
    }
    const extracted = extractAnatomiaCoverageEvidence('x', output);
    assert.ok(extracted.ok);
    const leaking = { ok: true as const, value: { ...extracted.value, files: ['src/a/x.ts'] } };
    assert.equal(typeof extractAnatomiaCoverageEvidenceContract.post(leaking, 'x', output), 'string');
    assert.equal(typeof extractAnatomiaCoverageEvidenceContract.post(extracted, 'x', { modules: 'x' }), 'string');
  });

  it('C-29 domain coverage class', () => {
    for (const e of [null, coverageOf(0, 0), coverageOf(90, 100), coverageOf(89, 100), coverageOf(50, 100), coverageOf(10, 100)]) {
      assert.equal(inspectDomainCoverageContract.post(inspectDomainCoverage(e), e), true, JSON.stringify(e?.symbols));
    }
    assert.equal(typeof inspectDomainCoverageContract.post(inspectDomainCoverage(coverageOf(90, 100)), coverageOf(89, 100)), 'string');
    assert.equal(typeof inspectDomainCoverageContract.post(inspectDomainCoverage(coverageOf(90, 100)), null), 'string');
  });

  it('C-30 verify class from the newest merge', () => {
    const newestPassed = revisorOf(mergedPr(2, 2, passed()), mergedPr(1, 1, failedGate));
    for (const e of [null, revisorOf(), newestPassed, revisorOf(mergedPr(1, 1, passed(2))), revisorOf(mergedPr(1, 1, failedGate)), revisorOf(mergedPr(1, 1, null))]) {
      assert.equal(inspectVerifyContract.post(inspectVerify(e), e), true, JSON.stringify(e?.merged));
    }
    assert.equal(typeof inspectVerifyContract.post(inspectVerify(revisorOf(mergedPr(1, 1, failedGate))), newestPassed), 'string');
    assert.equal(typeof inspectVerifyContract.post(inspectVerify(revisorOf(mergedPr(1, 1, passed()))), revisorOf(mergedPr(1, 1, passed(1)))), 'string');
  });

  it('C-31 merge-risk class from the worst band', () => {
    const mixed = revisorOf(mergedPr(3, 3, null, 'low'), mergedPr(2, 2, null, 'critical'), mergedPr(1, 1, null, 'medium'));
    for (const e of [null, revisorOf(), mixed, revisorOf(mergedPr(1, 1, null, 'high')), revisorOf(mergedPr(1, 1, null))]) {
      assert.equal(inspectMergeRiskContract.post(inspectMergeRisk(e), e), true, JSON.stringify(e?.merged));
    }
    assert.equal(typeof inspectMergeRiskContract.post(inspectMergeRisk(revisorOf(mergedPr(3, 3, null, 'low'))), mixed), 'string');
  });

  it('C-32 acceptance class', () => {
    for (const e of [null, acceptanceOf(0, 0, 0, 0), acceptanceOf(0, 0, 0), acceptanceOf(9, 1, 0), acceptanceOf(7, 2, 1), acceptanceOf(1, 4, 5)]) {
      assert.equal(inspectPraeformaAcceptanceContract.post(inspectPraeformaAcceptance(e), e), true, JSON.stringify(e?.results));
    }
    assert.equal(typeof inspectPraeformaAcceptanceContract.post(inspectPraeformaAcceptance(acceptanceOf(9, 1, 0)), acceptanceOf(9, 1, 0, 0)), 'string');
    assert.equal(typeof inspectPraeformaAcceptanceContract.post(inspectPraeformaAcceptance(acceptanceOf(9, 1, 0)), acceptanceOf(7, 2, 1)), 'string');
  });

  it('C-33 periodic review states', () => {
    const withReviews = (c: ConcordiaEvidence | null, r: DomainReviewsEvidence | null) => ({ ...EMPTY_BUNDLE, concordia: c, domainReviews: r });
    const posted: DomainReviewsEvidence = { code: 'Br', postCount: 1, latestPostedAt: daysAgo(3) };
    const off = concordia({ flags: { dddEnabled: true, testsRequired: true, domainReview: false, contractEnabled: false } });
    for (const b of [withReviews(null, posted), withReviews(off, posted), withReviews(concordia(), null), withReviews(concordia(), { ...posted, postCount: 0, latestPostedAt: null }), withReviews(concordia(), posted)]) {
      assert.equal(judgePeriodicReviewContract.post(judgePeriodicReview(b), b), true, JSON.stringify(b.domainReviews));
    }
    assert.equal(typeof judgePeriodicReviewContract.post({ state: 'done', reasons: [], evidenceAt: daysAgo(3) }, withReviews(off, posted)), 'string');
    assert.equal(typeof judgePeriodicReviewContract.post({ state: 'done', reasons: [], evidenceAt: null }, withReviews(concordia(), posted)), 'string');
  });

  it('C-34 review staleness', () => {
    for (const at of [null, 'junk', daysAgo(10), daysAgo(30), daysAgo(31)]) {
      assert.equal(reviewStaleReasonsContract.post(reviewStaleReasons(at, DEFAULT_STALE_POLICY, NOW), at, DEFAULT_STALE_POLICY, NOW), true, String(at));
    }
    assert.equal(typeof reviewStaleReasonsContract.post([], daysAgo(40), DEFAULT_STALE_POLICY, NOW), 'string');
    assert.equal(typeof reviewStaleReasonsContract.post(['x'], daysAgo(1), DEFAULT_STALE_POLICY, NOW), 'string');
  });

  it('C-35 injected git configuration is dropped', () => {
    const env = { GIT_CONFIG_COUNT: '2', GIT_CONFIG_KEY_0: 'a', GIT_CONFIG_VALUE_0: 'b', GIT_CONFIG_KEY_1: 'c', GIT_CONFIG_VALUE_1: 'd', GIT_CONFIG_GLOBAL: 'g', PATH: 'p' };
    for (const e of [env, {}, { PATH: 'p' }]) assert.equal(withoutGitConfigInjectionContract.post(withoutGitConfigInjection(e), e), true);
    assert.equal(typeof withoutGitConfigInjectionContract.post({ PATH: 'p', GIT_CONFIG_COUNT: '2' }, env), 'string');
    assert.equal(typeof withoutGitConfigInjectionContract.post({ PATH: 'p' }, env), 'string');
  });

  it('C-36 newest merged PRs of the repository', () => {
    const list = [
      { number: 1, repository: 'LUDIARS/Breviarium', status: 'merged', mergedAt: '2026-09-01T00:00:00Z' },
      { number: 2, repository: 'LUDIARS/Breviarium', status: 'merged', mergedAt: '2026-09-03T00:00:00Z' },
      { number: 3, repository: 'LUDIARS/Breviarium', status: 'open' },
      { number: 4, repository: 'LUDIARS/Other', status: 'merged', mergedAt: '2026-09-09T00:00:00Z' },
      { number: 5, repository: 'LUDIARS/Breviarium', status: 'merged', mergedAt: '2026-09-02T00:00:00Z' },
    ];
    for (const [l, limit] of [[list, 5], [list, 2], [[], 5], [{ prs: [] }, 5]] as const) {
      assert.equal(latestMergedPrNumbersContract.post(latestMergedPrNumbers(l, 'LUDIARS/Breviarium', limit), l, 'LUDIARS/Breviarium', limit), true, JSON.stringify(l));
    }
    assert.equal(typeof latestMergedPrNumbersContract.post({ ok: true, value: [5, 2] }, list, 'LUDIARS/Breviarium', 2), 'string');
    assert.equal(typeof latestMergedPrNumbersContract.post({ ok: true, value: [4, 2] }, list, 'LUDIARS/Breviarium', 2), 'string');
    assert.equal(typeof latestMergedPrNumbersContract.post({ ok: true, value: [2, 1] }, list, 'LUDIARS/Breviarium', 2), 'string');
  });

  it('C-37 domain-review posts of the code', () => {
    const body = { posts: [{ code: 'Br', posted_at: 1_790_000_000 }, { code: 'Br', posted_at: '2026-09-20T00:00:00Z' }, { code: 'Cc', posted_at: '2026-09-25T00:00:00Z' }] };
    for (const b of [body, { posts: [] }, { items: [] }, null]) {
      assert.equal(extractDomainReviewsEvidenceContract.post(extractDomainReviewsEvidence('Br', b), 'Br', b), true, JSON.stringify(b));
    }
    assert.equal(typeof extractDomainReviewsEvidenceContract.post({ ok: true, value: { code: 'Br', postCount: 3, latestPostedAt: '2026-09-25T00:00:00.000Z' } }, 'Br', body), 'string');
    assert.equal(typeof extractDomainReviewsEvidenceContract.post({ ok: true, value: { code: 'Br', postCount: 2, latestPostedAt: '2026-09-20T00:00:00.000Z' } }, 'Br', body), 'string');
  });

  it('C-13 / C-14 with the CLIs and the hourly refresh configured', () => {
    const env = { BREVIARIUM_DATA_DIR: 'E:/data', BREVIARIUM_HOST: '127.0.0.1', BREVIARIUM_PORT: '4370', BREVIARIUM_ANATOMIA_CLI: 'E:/Tools/anatomia.mjs', BREVIARIUM_REVISOR_CLI: 'E:/Tools/revisor.mjs', BREVIARIUM_REFRESH_INTERVAL_SEC: '3600' };
    const config = loadConfig(env);
    assert.equal(loadConfigContract.post(config, env), true);
    assert.equal(describeHealthContract.post(describeHealth(config, NOW), config), true);
    assert.equal(typeof describeHealthContract.post({ ...describeHealth(config, NOW), startedAt: 'E:/Tools/revisor.mjs' }, config), 'string');
    const report = describeHealth(config, NOW);
    assert.equal(typeof describeHealthContract.post({ ...report, sources: { ...report.sources, anatomiaCli: 'not_connected' } }, config), 'string');
  });

  it('C-27 Actio code', () => {
    for (const p of [project({ bindings: {} }), project({ bindings: { actioProjectCode: 'KD' } })]) assert.equal(actioSprintsPathContract.post(actioSprintsPath(p), p), true);
    assert.equal(typeof actioSprintsPathContract.post('/api/projects/cc/Br/sprints', project({ bindings: { actioProjectCode: 'KD' } })), 'string');
  });
});
