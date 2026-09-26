import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeRepoPath, validateBindings, validateCode } from '../../src/registry/domain/field-rules.ts';
import { planRegistration, planUpdate } from '../../src/registry/domain/registration-rules.ts';
import { NOW, project } from '../support/fixtures.ts';

const draft = { code: 'Br', name: 'Breviarium', repoPath: 'E:\\Document\\Ars\\Breviarium\\', classification: 'internal' };

describe('registration rules', () => {
  it('accepts Cc-style codes and refuses others', () => {
    for (const code of ['Br', 'SUPERFAT', 'AC', 'L', 'Ld2']) assert.equal(validateCode(code).ok, true, code);
    for (const code of ['', '1A', 'B r', 'Br-x', 'A'.repeat(17), '../x']) assert.equal(validateCode(code).ok, false, code);
  });

  it('normalises absolute repo paths and refuses relative or dotted ones', () => {
    assert.deepEqual(normalizeRepoPath('e:\\Document\\Ars\\X\\'), { ok: true, value: 'E:/Document/Ars/X' });
    assert.deepEqual(normalizeRepoPath('/home/dev//x/'), { ok: true, value: '/home/dev/x' });
    for (const bad of ['relative/path', 'E:relative', 'E:/a/../b', './x', '//server/share', '', 'E:/a\u0000b']) {
      assert.equal(normalizeRepoPath(bad).ok, false, bad);
    }
  });

  it('accepts a Cc code as the Actio project code binding', () => {
    assert.deepEqual(validateBindings({ actioProjectCode: ' KD ' }), { ok: true, value: { actioProjectCode: 'KD' } });
    assert.deepEqual(validateBindings({ actioProjectCode: '' }), { ok: true, value: {} });
  });

  it('accepts an Anatomia project id binding and refuses ids that are not plain names', () => {
    assert.deepEqual(validateBindings({ anatomiaProject: ' breviarium ' }), { ok: true, value: { anatomiaProject: 'breviarium' } });
    assert.deepEqual(validateBindings({ anatomiaProject: 'ars-module.v2' }), { ok: true, value: { anatomiaProject: 'ars-module.v2' } });
    for (const bad of ['-x', 'a b', 'a/b', '../x', 'x'.repeat(65)]) assert.equal(validateBindings({ anatomiaProject: bad }).ok, false, bad);
  });

  it('validates bindings and treats empty values as unbound', () => {
    const ok = validateBindings({ praeformaProjectId: '01M2RZXD2WVGQP0NKXEE9WRYZ1', githubRepo: 'LUDIARS/Breviarium', voluptasPath: 'answers\\team', elegantiaProduct: '' });
    assert.deepEqual(ok, { ok: true, value: { praeformaProjectId: '01M2RZXD2WVGQP0NKXEE9WRYZ1', githubRepo: 'LUDIARS/Breviarium', voluptasPath: 'answers/team' } });
    for (const bad of [{ unknown: 'x' }, { voluptasPath: '../secret' }, { voluptasPath: '/abs' }, { voluptasPath: 'E:/abs' }, { githubRepo: 'no-slash' }, { praeformaProjectId: 'has space' }, { actioProjectCode: 'K-D' }, { actioProjectCode: '1KD' }]) {
      assert.equal(validateBindings(bad).ok, false, JSON.stringify(bad));
    }
  });

  it('registers a project with normalised fields', () => {
    const result = planRegistration([], { ...draft, bindings: { githubRepo: 'LUDIARS/Breviarium' } }, NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.repoPath, 'E:/Document/Ars/Breviarium');
    assert.equal(result.value.registeredAt, NOW);
    assert.deepEqual(result.value.bindings, { githubRepo: 'LUDIARS/Breviarium' });
  });

  it('refuses a code that differs only by case (snapshot directories would collide)', () => {
    const result = planRegistration([project({ code: 'Br' })], { ...draft, code: 'BR' }, NOW);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'duplicate_project');
  });

  it('refuses unknown classifications and bad names', () => {
    assert.equal(planRegistration([], { ...draft, classification: 'secret' }, NOW).ok, false);
    assert.equal(planRegistration([], { ...draft, name: '   ' }, NOW).ok, false);
  });

  it('updates without changing the code and replaces bindings as a whole', () => {
    const existing = [project()];
    const result = planUpdate(existing, 'br', { name: '新しい名前', bindings: { elegantiaProduct: 'br' } }, NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.code, 'Br');
    assert.equal(result.value.name, '新しい名前');
    assert.deepEqual(result.value.bindings, { elegantiaProduct: 'br' });
    assert.equal(result.value.updatedAt, NOW);
    assert.equal(result.value.registeredAt, existing[0]?.registeredAt);
  });

  it('refuses updates of unknown projects and invalid fields', () => {
    const missing = planUpdate([], 'Zz', { name: 'x' }, NOW);
    assert.equal(!missing.ok && missing.error.code, 'project_not_found');
    assert.equal(planUpdate([project()], 'Br', { repoPath: 'relative' }, NOW).ok, false);
    assert.equal(planUpdate([project()], 'Br', { classification: 'x' }, NOW).ok, false);
  });
});
