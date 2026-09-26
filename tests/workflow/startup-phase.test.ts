import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EMPTY_BUNDLE, type EvidenceBundle } from '../../src/inspections/domain/evidence.ts';
import type { SetupItemId } from '../../src/workflow/domain/setup-checklist.ts';
import { evaluateStartup, type StartupPhase } from '../../src/workflow/domain/startup-phase.ts';
import { actio, anatomia, concordia, fullBundle, git, praeforma, repoArtifacts, revisor } from '../support/fixtures.ts';

function startup(overrides: Partial<EvidenceBundle> = {}): StartupPhase {
  return evaluateStartup(fullBundle(overrides));
}

const mvp = (p: StartupPhase) => p.stages[0];
const setup = (p: StartupPhase) => p.stages[1];
const checked = (p: StartupPhase, id: SetupItemId) => p.checklist.find((c) => c.id === id)?.done;

describe('startup phase', () => {
  it('is MVP then setup with the five registrations, nothing started or checked without evidence', () => {
    const p = evaluateStartup(EMPTY_BUNDLE);
    assert.deepEqual(p.stages.map((s) => s.id), ['startup.mvp', 'startup.setup']);
    assert.deepEqual(p.checklist.map((c) => c.id), ['praeforma', 'anatomia', 'concordia', 'revisor', 'actio']);
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

  it('setup is done when all five registrations are done', () => {
    const p = startup();
    assert.equal(setup(p)?.state, 'done');
    assert.deepEqual(setup(p)?.reasons, ['済 5/5']);
  });

  it('setup is in progress with some registrations done, and names the missing ones', () => {
    const p = startup({ revisor: revisor({ registered: false }), actio: actio({ teams: [] }) });
    assert.equal(setup(p)?.state, 'in-progress');
    assert.deepEqual(setup(p)?.reasons, ['済 3/5', '未: Revisor 登録', '未: Actio のチーム所属']);
  });

  it('each registration needs its own evidence', () => {
    assert.equal(checked(startup({ praeforma: praeforma({ uxGoal: { filled: [], empty: ['experience'] } }) }), 'praeforma'), false);
    assert.equal(checked(startup({ anatomia: anatomia({ unparsableCount: 1 }) }), 'anatomia'), false);
    assert.equal(checked(startup({ concordia: concordia({ flags: { dddEnabled: false, testsRequired: true, domainReview: true, contractEnabled: false } }) }), 'concordia'), false);
    assert.equal(checked(startup({ concordia: concordia({ registered: false }) }), 'concordia'), false);
    const noRevisor = startup({ revisor: null });
    assert.equal(checked(noRevisor, 'revisor'), false);
    assert.ok(noRevisor.checklist.find((c) => c.id === 'revisor')?.reasons[0]?.includes('未取得'));
    assert.equal(checked(startup({ actio: null }), 'actio'), false);
  });

  it('setup is not started when no registration is done', () => {
    const p = evaluateStartup({ ...EMPTY_BUNDLE, git: git({ tagCount: 0 }), repoArtifacts: repoArtifacts() });
    assert.equal(setup(p)?.state, 'not-started');
    assert.equal(mvp(p)?.state, 'in-progress');
  });
});
