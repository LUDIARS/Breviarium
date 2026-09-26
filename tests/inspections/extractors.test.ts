import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractAnatomiaEvidence } from '../../src/inspections/extractors/anatomia.ts';
import { extractConcordiaEvidence, pullRequestsFor } from '../../src/inspections/extractors/concordia.ts';
import { extractElegantiaEvidence } from '../../src/inspections/extractors/elegantia.ts';
import { extractGitEvidence } from '../../src/inspections/extractors/git.ts';
import { countItemsUnderHeadings, parseFrontMatter } from '../../src/inspections/extractors/markdown-facts.ts';
import { extractPraeformaEvidence } from '../../src/inspections/extractors/praeforma.ts';
import { extractRepoArtifactsEvidence } from '../../src/inspections/extractors/repo-artifacts.ts';
import { extractVoluptasEvidence } from '../../src/inspections/extractors/voluptas.ts';
import { SHA } from '../support/fixtures.ts';

const T = '2026-09-20T00:00:00.000Z';

describe('git extractor', () => {
  it('reads sha, commit time, branch, tag count and the newest v tag (tags come newest first)', () => {
    const r = extractGitEvidence({ head: `${SHA}\n2026-09-25T10:00:00+09:00\n`, branch: 'main\n', tags: 'v0.2.0\nv0.1.0\n' });
    assert.deepEqual(r, { ok: true, value: { headSha: SHA, headCommittedAt: '2026-09-25T01:00:00.000Z', branch: 'main', tagCount: 2, latestVersionTag: 'v0.2.0' } });
  });

  it('takes only `v` plus a digit as a release tag', () => {
    const tagged = (tags: string) => {
      const r = extractGitEvidence({ head: `${SHA}\n${T}`, branch: 'main', tags });
      return r.ok ? r.value.latestVersionTag : 'refused';
    };
    assert.equal(tagged('mvp\nvendor-drop\nv1.0.0\nv0.9.0\n'), 'v1.0.0');
    assert.equal(tagged('mvp\nvendor-drop\n'), null);
    assert.equal(tagged(''), null);
  });

  it('treats a detached HEAD as no branch and refuses unreadable output', () => {
    const r = extractGitEvidence({ head: `${SHA}\n${T}`, branch: 'HEAD', tags: '' });
    assert.equal(r.ok && r.value.branch, null);
    assert.equal(r.ok && r.value.tagCount, 0);
    assert.equal(extractGitEvidence({ head: 'fatal: bad', branch: '', tags: '' }).ok, false);
  });
});

describe('praeforma extractor', () => {
  const projects = { items: [{ id: 'PF01', name: 'Conflux' }] };

  it('normalises goal fields, domains and spec statuses', () => {
    const r = extractPraeformaEvidence({
      projectId: 'PF01',
      projects,
      uxGoal: { definition: { experience: 'x', design: 'y', story: '', emotions: ' ', revision: 1 } },
      domains: { items: [{ id: 'd1', description: 'owns x' }, { id: 'd2', description: '' }] },
      specs: { items: [{ status: 'draft', updatedAt: T }, { status: 'confirmed', updatedAt: '2026-09-21T00:00:00.000Z' }, { status: 'draft' }] },
      specVersions: { version: '0.0.13' },
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.value.uxGoal, { filled: ['experience', 'design'], empty: ['story', 'emotions'] });
    assert.deepEqual(r.value.domains, { total: 2, described: 1 });
    assert.deepEqual(r.value.specs, { total: 3, byStatus: { draft: 2, confirmed: 1 }, latestUpdatedAt: '2026-09-21T00:00:00.000Z' });
    assert.equal(r.value.specVersion, '0.0.13');
  });

  it('reports a missing project without inventing counts, and refuses a foreign shape', () => {
    const r = extractPraeformaEvidence({ projectId: 'NOPE', projects });
    assert.equal(r.ok && r.value.projectFound, false);
    assert.equal(r.ok && r.value.uxGoal, null);
    assert.equal(extractPraeformaEvidence({ projectId: 'PF01', projects: '<html>' }).ok, false);
  });
});

describe('anatomia extractor', () => {
  it('counts declarations, unparsable files and memberships', () => {
    const e = extractAnatomiaEvidence({
      declarations: [
        { path: 'spec/domains/b.domain.json', text: '{"name":"b","membership":[{},{}]}', modifiedAt: T },
        { path: 'spec/domains/a.domain.json', text: '{ broken', modifiedAt: '2026-09-21T00:00:00.000Z' },
      ],
      manifest: { path: 'spec/data/generated/anatomia/manifest.json', text: '{"sourceRevision":"sha256:1"}', modifiedAt: T },
    });
    assert.equal(e.declaredCount, 2);
    assert.equal(e.unparsableCount, 1);
    assert.equal(e.membershipTotal, 2);
    assert.equal(e.declarations[0]?.path, 'spec/domains/a.domain.json');
    assert.equal(e.latestDeclarationAt, '2026-09-21T00:00:00.000Z');
    assert.equal(e.manifest?.sourceRevision, 'sha256:1');
  });
});

describe('markdown facts', () => {
  it('reads front matter values without quotes', () => {
    assert.deepEqual(parseFrontMatter('---\nstatus: complete\ntitle: "x: y"\n---\n# body'), { status: 'complete', title: 'x: y' });
    assert.deepEqual(parseFrontMatter('# no front matter'), {});
  });

  it('counts top-level list items under matching headings only', () => {
    const text = '## Debate questions\n\n1. a\n2. b\n   - nested\n```\n- in fence\n```\n## Positions to test\n- p\n## Other\n- x\n';
    assert.equal(countItemsUnderHeadings(text, /debate questions/i), 2);
    assert.equal(countItemsUnderHeadings(text, /positions/i), 1);
  });
});

describe('repo artifacts extractor', () => {
  it('splits plan documents, the Di paper, summary, run plan and audit', () => {
    const e = extractRepoArtifactsEvidence({
      readme: { path: 'README.md', modifiedAt: T },
      productSpec: null,
      featureSpecCount: 2,
      plans: [
        { path: 'spec/plan/03-ludus-analysis.md', modifiedAt: T, text: '---\nstatus: Complete\n---\n' },
        { path: 'spec/plan/12-di-discussion-paper.md', modifiedAt: T, text: '---\nstatus: blocked\nupdated: 2026-07-16\n---\n## Debate questions\n- q1\n- q2\n## Positions to test\n- h1\n' },
        { path: 'spec/plan/13-development-feasibility.md', modifiedAt: T, text: '# no status' },
        { path: 'spec/plan/00-source-manifest.md', modifiedAt: T, text: '' },
      ],
      summary: { path: 'spec/data/omnipotens-summary.json', modifiedAt: T, text: JSON.stringify({ overallAssessment: { label: '有望', score: 7, maxScore: 10 }, vitiaScores: [{ score: 8, maxScore: 10 }, { score: 3 }] }) },
      runPlan: { path: 'spec/data/omnipotens-run-plan.json', modifiedAt: T, text: JSON.stringify({ resolvedAnalysisIds: ['a'], notRequestedAnalysisIds: ['b', 'c'] }) },
      audit: { path: 'spec/data/vitia-game-experience-audit.json', modifiedAt: T, text: JSON.stringify({ status: 'blocked', blocked_by: ['compulsive_loop'] }) },
      finalReport: null,
    });
    assert.deepEqual(e.plans.map((p) => [p.number, p.status]), [[3, 'complete'], [13, null]]);
    assert.equal(e.diPaper?.questionCount, 2);
    assert.equal(e.diPaper?.positionCount, 1);
    assert.equal(e.diPaper?.updated, '2026-07-16');
    assert.deepEqual(e.omnipotens.summary?.overall, { label: '有望', score: 7, maxScore: 10 });
    assert.deepEqual(e.omnipotens.summary?.vitiaRatios, [0.8]);
    assert.deepEqual(e.omnipotens.runPlan?.notRequested, ['b', 'c']);
    assert.equal(e.vitiaAudit?.status, 'blocked');
    assert.deepEqual(e.vitiaAudit?.blockedBy, ['compulsive_loop']);
    assert.equal(e.foundation.featureSpecCount, 2);
  });

  it('keeps an unreadable summary as present without a score', () => {
    const e = extractRepoArtifactsEvidence({ readme: null, productSpec: null, featureSpecCount: 0, plans: [], summary: { path: 's.json', modifiedAt: T, text: 'not json' }, runPlan: null, audit: null, finalReport: null });
    assert.equal(e.omnipotens.summary?.overall, null);
    assert.deepEqual(e.omnipotens.summary?.vitiaRatios, []);
  });
});

describe('voluptas extractor', () => {
  it('counts JSON files and keeps no names', () => {
    const e = extractVoluptasEvidence({ exists: true, truncated: false, files: [{ name: 'a.json', modifiedAt: T }, { name: 'b.JSON', modifiedAt: '2026-09-22T00:00:00.000Z' }, { name: 'c.png', modifiedAt: '2026-09-25T00:00:00.000Z' }] });
    assert.deepEqual(e, { exists: true, jsonFileCount: 2, latestModifiedAt: '2026-09-22T00:00:00.000Z', truncated: false });
  });
});

describe('elegantia extractor', () => {
  it('reads counts, additional achievement, latest testedAt and builds', () => {
    const r = extractElegantiaEvidence('breviarium', {
      counts: { none: 1, current: 2, historical_only: 0, passed: 1, failed: 1, blocked: 0, unverified: 0, not_applicable: 0 },
      items: [
        { criterion: { id: 'a' }, presence: 'current', latest: { verdict: 'passed', additionalAchieved: true, testedAt: T, context: { build: 'b1' } } },
        { criterion: { id: 'b' }, presence: 'current', latest: { verdict: 'failed', additionalAchieved: false, testedAt: '2026-09-21T00:00:00+09:00', context: { build: 'b1' } } },
        { criterion: { id: 'c' }, presence: 'none', latest: null },
      ],
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.value.criteriaTotal, 3);
    assert.equal(r.value.additionalAchieved, 1);
    assert.equal(r.value.latestTestedAt, '2026-09-20T15:00:00.000Z');
    assert.deepEqual(r.value.builds, ['b1']);
    assert.equal(extractElegantiaEvidence('x', { items: [] }).ok, false);
  });
});

describe('concordia extractor', () => {
  const codes = { project_codes: [{ code: 'Br', project: 'Breviarium', ddd_enabled: true, tests_required: false, domain_review: true, contract_enabled: false, revisor_workflow: 'revisor' }, { code: 'BR' }] };
  const prs = {
    grouped: {
      ready: [],
      needs_review: [
        { number: 1, repo_origin: 'LUDIARS/Breviarium', title: 'mine', created_at: 1790350764 },
        { number: 2, repo_origin: 'LUDIARS/Praeforma', title: 'other repo', created_at: 1790350764 },
      ],
      in_progress: [],
      merged_recent: [{ number: 3, repo_origin: 'ludiars/breviarium', title: 'merged', merged_at: 1790000000 }],
    },
  };

  it('matches the code exactly and reads harness flags', () => {
    const r = extractConcordiaEvidence({ code: 'Br', projectCodes: codes, prs: null, githubRepo: null });
    assert.equal(r.ok && r.value.registered, true);
    assert.deepEqual(r.ok && r.value.flags, { dddEnabled: true, testsRequired: false, domainReview: true, contractEnabled: false });
    assert.equal(r.ok && r.value.pullRequests, null);
    const unknown = extractConcordiaEvidence({ code: 'Xx', projectCodes: codes, prs: null, githubRepo: null });
    assert.equal(unknown.ok && unknown.value.registered, false);
    const otherCase = extractConcordiaEvidence({ code: 'BR', projectCodes: codes, prs: null, githubRepo: null });
    assert.equal(otherCase.ok && otherCase.value.flags.dddEnabled, null);
    assert.equal(extractConcordiaEvidence({ code: 'Br', projectCodes: {}, prs: null, githubRepo: null }).ok, false);
  });

  it('counts only PRs whose repo_origin is the bound repository, with unix seconds as ISO', () => {
    const r = pullRequestsFor(prs, 'LUDIARS/Breviarium');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.value.open.map((p) => p.number), [1]);
    assert.equal(r.value.open[0]?.createdAt, new Date(1790350764 * 1000).toISOString());
    assert.deepEqual(r.value.merged.map((p) => p.number), [3]);
    assert.equal(pullRequestsFor({}, 'LUDIARS/Breviarium').ok, false);
  });
});
