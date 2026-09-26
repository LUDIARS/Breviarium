import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type CatalogServiceFact, EMPTY_BUNDLE, type EvidenceBundle, type RepoArtifactsEvidence } from '../../src/inspections/domain/evidence.ts';
import type { SetupItemId } from '../../src/workflow/domain/setup-checklist.ts';
import { evaluateStartup, type StartupPhase } from '../../src/workflow/domain/startup-phase.ts';
import { actio, anatomia, concordia, excubitor, fullBundle, git, praeforma, repoArtifacts, revisor } from '../support/fixtures.ts';

/** Repository artefacts whose `excubitor.catalog.yaml` has the given services. */
function withCatalog(services: CatalogServiceFact[]): RepoArtifactsEvidence {
  return repoArtifacts({ serviceCatalog: { path: 'excubitor.catalog.yaml', modifiedAt: '2026-09-06T00:00:00.000Z', services } });
}

function startup(overrides: Partial<EvidenceBundle> = {}): StartupPhase {
  return evaluateStartup(fullBundle(overrides));
}

const mvp = (p: StartupPhase) => p.stages[0];
const setup = (p: StartupPhase) => p.stages[1];
const checked = (p: StartupPhase, id: SetupItemId) => p.checklist.find((c) => c.id === id)?.done;

describe('startup phase', () => {
  it('is MVP then setup with the seven checks, nothing started or checked without evidence', () => {
    const p = evaluateStartup(EMPTY_BUNDLE);
    assert.deepEqual(p.stages.map((s) => s.id), ['startup.mvp', 'startup.setup']);
    assert.deepEqual(p.checklist.map((c) => c.id), ['praeforma', 'anatomia', 'concordia', 'revisor', 'actio', 'excubitor', 'related']);
    assert.ok(p.stages.every((s) => s.state === 'not-started'));
    assert.ok(p.checklist.every((c) => !c.done));
  });

  it('MVP needs a README and a spec plus a first tag or a Cc registration', () => {
    assert.equal(mvp(startup())?.state, 'done');
    assert.equal(mvp(startup({ git: git({ tagCount: 0 }), concordia: concordia({ registered: false }) }))?.state, 'in-progress');
    assert.equal(mvp(startup({ git: git({ tagCount: 0 }) }))?.state, 'done');
    const noReadme = repoArtifacts({ foundation: { readme: null, productSpec: null, featureSpecCount: 0 } });
    assert.equal(mvp(evaluateStartup({ ...EMPTY_BUNDLE, repoArtifacts: noReadme }))?.state, 'not-started');
  });

  it('setup is done when all seven checks are done', () => {
    const p = startup();
    assert.equal(setup(p)?.state, 'done');
    assert.deepEqual(setup(p)?.reasons, ['済 7/7']);
  });

  it('setup is in progress with some registrations done, and names the missing ones', () => {
    const p = startup({ revisor: revisor({ registered: false }), actio: actio({ teams: [] }) });
    assert.equal(setup(p)?.state, 'in-progress');
    assert.deepEqual(setup(p)?.reasons, ['済 5/7', '未: Revisor 登録', '未: Actio のチーム所属']);
  });

  it('each registration needs its own evidence', () => {
    assert.equal(checked(startup({ praeforma: praeforma({ uxGoal: { filled: [], empty: ['experience'] } }) }), 'praeforma'), false);
    assert.equal(checked(startup({ anatomia: anatomia({ unparsableCount: 1 }) }), 'anatomia'), false);
    assert.equal(checked(startup({ concordia: concordia({ flags: { dddEnabled: false, testsRequired: true, domainReview: true, contractEnabled: false } }) }), 'concordia'), false);
    assert.equal(checked(startup({ concordia: concordia({ registered: false }) }), 'concordia'), false);
    const noRevisor = startup({ revisor: null });
    assert.equal(checked(noRevisor, 'revisor'), false);
    assert.ok(noRevisor.checklist.find((c) => c.id === 'revisor')?.reasons.some((r) => r.startsWith('Revisor 未取得')));
    assert.equal(checked(startup({ actio: null }), 'actio'), false);
  });

  it('the publish check follows Cc: Revisor registration for revisor, an origin remote otherwise, 未 without a workflow', () => {
    const publish = (overrides: Partial<EvidenceBundle>) => startup(overrides).checklist.find((c) => c.id === 'revisor');
    assert.deepEqual(publish({})?.label, 'Revisor 登録');
    const github = publish({ concordia: concordia({ revisorWorkflow: 'github' }), revisor: null });
    assert.deepEqual({ label: github?.label, done: github?.done, reasons: github?.reasons }, { label: '公開先 (GitHub remote)', done: true, reasons: ['Cc のワークフロー github', 'remote origin (github.com)'] });
    const noRemote = publish({ concordia: concordia({ revisorWorkflow: 'github' }), git: git({ origin: null }) });
    assert.deepEqual({ done: noRemote?.done, reasons: noRemote?.reasons }, { done: false, reasons: ['Cc のワークフロー github', 'remote origin なし'] });
    const unset = publish({ concordia: concordia({ revisorWorkflow: null }) });
    assert.deepEqual({ label: unset?.label, done: unset?.done, reasons: unset?.reasons }, { label: '公開先 (Revisor / GitHub)', done: false, reasons: ['Cc のワークフロー未設定 (revisor_workflow なし)'] });
    assert.equal(publish({ concordia: null })?.done, false);
  });

  it('Excubitor 登録 needs both the service-owned catalog and the service in Excubitor, and says which side is missing', () => {
    const ex = (overrides: Partial<EvidenceBundle>) => startup(overrides).checklist.find((c) => c.id === 'excubitor');
    assert.equal(ex({})?.done, true);
    const notInEx = ex({ excubitor: excubitor({ found: false, state: null, autostart: null, envConfig: null, serviceCodes: ['breviarium'] }), repoArtifacts: withCatalog([{ code: 'breviarium', dependsOn: [], declarations: [] }]) });
    assert.equal(notInEx?.done, false);
    assert.deepEqual(notInEx?.reasons, [
      'catalog に照合 code br なし',
      'catalog はあるが Ex 未反映',
      'excubitor.catalog.yaml あり (code breviarium)',
      'Excubitor に br なし',
      'Excubitor には catalog 先頭の breviarium がある (bindings.excubitorService=breviarium で照合)',
    ]);
    const noCatalog = ex({ repoArtifacts: repoArtifacts({ serviceCatalog: null }) });
    assert.deepEqual({ done: noCatalog?.done, first: noCatalog?.reasons[0] }, { done: false, first: 'Ex にあるが catalog なし' });
    const emptyCatalog = ex({ repoArtifacts: withCatalog([]) });
    assert.deepEqual({ done: emptyCatalog?.done, first: emptyCatalog?.reasons[0] }, { done: false, first: 'catalog に照合 code br なし' });
    const unrelatedCatalog = ex({ repoArtifacts: withCatalog([{ code: 'web', dependsOn: [], declarations: [] }]) });
    assert.deepEqual({ done: unrelatedCatalog?.done, first: unrelatedCatalog?.reasons[0] }, { done: false, first: 'catalog に照合 code br なし' });
    assert.equal(ex({ repoArtifacts: repoArtifacts({ serviceCatalog: null }), excubitor: excubitor({ found: false, state: null, autostart: null, envConfig: null }) })?.done, false);
    assert.ok(ex({ excubitor: null })?.reasons.includes('Excubitor 未取得 (未接続)'));
  });

  it('関連設定 applies only to a catalog with declarations: env-config ready and every depends_on in Excubitor', () => {
    const related = (overrides: Partial<EvidenceBundle>) => startup(overrides).checklist.find((c) => c.id === 'related');
    assert.equal(related({})?.done, true);
    const plain = startup({ repoArtifacts: withCatalog([{ code: 'br', dependsOn: [], declarations: [] }]) });
    const na = plain.checklist.find((c) => c.id === 'related');
    assert.deepEqual({ applicable: na?.applicable, done: na?.done, reasons: na?.reasons }, { applicable: false, done: false, reasons: ['関連設定の宣言なし'] });
    assert.deepEqual({ state: setup(plain)?.state, reasons: setup(plain)?.reasons }, { state: 'done', reasons: ['済 6/6、該当なし 1'] });
    const missingEnv = related({ excubitor: excubitor({ envConfig: { ready: false, missingCount: 2 } }) });
    assert.deepEqual({ done: missingEnv?.done, env: missingEnv?.reasons[1] }, { done: false, env: 'env-config 未 ready (不足 2 件)' });
    const absentDependency = related({ repoArtifacts: withCatalog([{ code: 'br', dependsOn: ['actio', 'cernere'], declarations: ['depends_on'] }]) });
    assert.deepEqual({ done: absentDependency?.done, deps: absentDependency?.reasons[2] }, { done: false, deps: 'depends_on のうち Ex に無い: cernere' });
    const otherServiceDeclaration = related({
      repoArtifacts: withCatalog([
        { code: 'br', dependsOn: [], declarations: [] },
        { code: 'web', dependsOn: ['cernere'], declarations: ['depends_on', 'required_env'] },
      ]),
    });
    assert.deepEqual(
      { applicable: otherServiceDeclaration?.applicable, done: otherServiceDeclaration?.done, reasons: otherServiceDeclaration?.reasons },
      { applicable: false, done: false, reasons: ['関連設定の宣言なし'] },
    );
    assert.equal(related({ excubitor: excubitor({ envConfig: null }) })?.reasons[1], 'env-config 未取得');
  });

  it('setup is not started when no registration is done', () => {
    const p = evaluateStartup({ ...EMPTY_BUNDLE, git: git({ tagCount: 0 }), repoArtifacts: repoArtifacts() });
    assert.equal(setup(p)?.state, 'not-started');
    assert.equal(mvp(p)?.state, 'in-progress');
  });
});
