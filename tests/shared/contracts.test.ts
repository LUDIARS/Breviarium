import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import acceptsClaimsContract from '../../contracts/accepts-claims.contract.ts';
import admitCloudflareRequestContract from '../../contracts/admit-cloudflare-request.contract.ts';
import admitMethodContract from '../../contracts/admit-method.contract.ts';
import admitWebRequestContract from '../../contracts/admit-web-request.contract.ts';
import applyOutcomeContract from '../../contracts/apply-outcome.contract.ts';
import assessFreshnessContract from '../../contracts/assess-freshness.contract.ts';
import buildInspectionsContract from '../../contracts/build-inspections.contract.ts';
import composeOverviewContract from '../../contracts/compose-overview.contract.ts';
import describeHealthContract from '../../contracts/describe-health.contract.ts';
import escContract from '../../contracts/esc.contract.ts';
import evaluateStagesContract from '../../contracts/evaluate-stages.contract.ts';
import gradeRatioContract from '../../contracts/grade-ratio.contract.ts';
import inspectElegantiaContract from '../../contracts/inspect-elegantia.contract.ts';
import loadConfigContract from '../../contracts/load-config.contract.ts';
import planRegistrationContract from '../../contracts/plan-registration.contract.ts';
import pullRequestsForContract from '../../contracts/pull-requests-for.contract.ts';
import readCloudflareAccessConfigContract from '../../contracts/read-cloudflare-access-config.contract.ts';
import readPublicOriginContract from '../../contracts/read-public-origin.contract.ts';
import refreshProjectContract from '../../contracts/refresh-project.contract.ts';
import renderIndexPageContract from '../../contracts/render-index-page.contract.ts';
import renderProjectPageContract from '../../contracts/render-project-page.contract.ts';
import toExecutiveSummaryContract from '../../contracts/to-executive-summary.contract.ts';
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
import { esc } from '../../src/adapters/http/html/escape.ts';
import { renderIndexPage } from '../../src/adapters/http/html/index-page.ts';
import { renderProjectPage } from '../../src/adapters/http/html/project-page.ts';
import type { HttpResponse } from '../../src/adapters/http/http-types.ts';
import { buildInspections } from '../../src/inspections/domain/build-inspections.ts';
import { EMPTY_BUNDLE } from '../../src/inspections/domain/evidence.ts';
import { gradeRatio } from '../../src/inspections/domain/grading.ts';
import { inspectElegantia } from '../../src/inspections/domain/service-inspections.ts';
import { pullRequestsFor } from '../../src/inspections/extractors/concordia.ts';
import { registerProject } from '../../src/registry/application/registry-use-cases.ts';
import { planRegistration } from '../../src/registry/domain/registration-rules.ts';
import { composeOverview } from '../../src/snapshots/application/project-overview.ts';
import { refreshProject } from '../../src/snapshots/application/refresh-use-case.ts';
import { assessFreshness } from '../../src/snapshots/domain/freshness.ts';
import type { SourceSnapshot } from '../../src/snapshots/domain/model.ts';
import { applyOutcome } from '../../src/snapshots/domain/snapshot-rules.ts';
import { evaluateStages } from '../../src/workflow/domain/stage-evaluation.ts';
import { DEFAULT_STALE_POLICY } from '../../src/workflow/domain/staleness.ts';
import { ACCESS_CONFIG, AUD, claims, NOW_MS, NOW_SEC, TEAM } from '../support/access-tokens.ts';
import { elegantia, fullBundle, NOW, project, testDeps } from '../support/fixtures.ts';

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
});
