import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
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
import refreshProjectContract from '../../contracts/refresh-project.contract.ts';
import toExecutiveSummaryContract from '../../contracts/to-executive-summary.contract.ts';
import { loadConfig } from '../../src/adapters/config/load-config.ts';
import { buildWebAccess } from '../../src/adapters/config/web-access.ts';
import { toExecutiveSummary } from '../../src/adapters/http/export/summary-json.ts';
import { describeHealth } from '../../src/adapters/http/health.ts';
import { admitWebRequest } from '../../src/adapters/http/host-origin-guard.ts';
import { esc } from '../../src/adapters/http/html/escape.ts';
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
    const access = buildWebAccess(4370, undefined, undefined);
    for (const headers of [{ host: '127.0.0.1:4370' }, { host: 'evil.test' }, { host: 'localhost:4370', origin: 'https://evil.test' }]) {
      assert.equal(admitWebRequestContract.post(admitWebRequest(headers, access), headers, access), true);
    }
    assert.equal(typeof admitWebRequestContract.post(undefined, { host: 'evil.test' }, access), 'string');
  });

  it('C-13 health and C-14 config', () => {
    const env = { BREVIARIUM_DATA_DIR: 'E:/data', BREVIARIUM_HOST: '127.0.0.1', BREVIARIUM_PORT: '4370', CONCORDIA_URL: 'http://127.0.0.1:11111' };
    const config = loadConfig(env);
    assert.equal(loadConfigContract.post(config, env), true);
    assert.equal(typeof loadConfigContract.post({ ...config, refreshIntervalSec: 60 }, env), 'string');
    assert.equal(describeHealthContract.post(describeHealth(config, NOW), config), true);
    const exposing = { ...describeHealth(config, NOW), startedAt: 'http://127.0.0.1:11111' };
    assert.equal(typeof describeHealthContract.post(exposing, config), 'string');
  });

  it('C-15 escaping', () => {
    for (const v of ['<script>"x"</script>', "it's", 'plain', null, 3]) assert.equal(escContract.post(esc(v)), true);
    assert.equal(typeof escContract.post('<b>'), 'string');
  });
});
