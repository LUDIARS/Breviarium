// @implements SPEC-br-workflow
import type { EvidenceBundle } from '../../inspections/domain/evidence.ts';
import { check, type SetupCheck } from './setup-check.ts';

/** Praeforma: the project with its UX goal (experience), domains and specs. */
export function praeformaCheck(b: EvidenceBundle): SetupCheck {
  const label = 'Praeforma (UX 目標・ドメイン・仕様)';
  const p = b.praeforma;
  if (!p) return check('praeforma', label, false, ['Praeforma 未取得 (未接続・未登録)']);
  if (!p.projectFound) return check('praeforma', label, false, [`Pf にプロジェクト ${p.projectId} がない`]);
  const hasExperience = p.uxGoal?.filled.includes('experience') ?? false;
  const reasons = [`UX 体験 ${hasExperience ? 'あり' : 'なし'}`, `ドメイン ${p.domains.total} 件`, `仕様 ${p.specs.total} 件`];
  return check('praeforma', label, hasExperience && p.domains.total > 0 && p.specs.total > 0, reasons);
}

/** Anatomia: at least one `spec/domains` declaration and none that fails to parse. */
export function anatomiaCheck(b: EvidenceBundle): SetupCheck {
  const label = 'Anatomia (spec/domains 宣言)';
  const a = b.anatomia;
  if (!a) return check('anatomia', label, false, ['Anatomia 未取得']);
  return check('anatomia', label, a.declaredCount > 0 && a.unparsableCount === 0, [`ドメイン宣言 ${a.declaredCount} 件 (parse 不能 ${a.unparsableCount})`]);
}

/** Concordia: the project is registered and DDD is enabled (the other flags are listed for reference). */
export function concordiaCheck(b: EvidenceBundle): SetupCheck {
  const label = 'Cc (プロジェクト登録・DDD 等の設定)';
  const c = b.concordia;
  if (!c) return check('concordia', label, false, ['Cc 未取得']);
  if (!c.registered) return check('concordia', label, false, ['Cc 未登録']);
  const flag = (name: string, value: boolean | null) => `${name} ${value === true ? '有効' : value === false ? '無効' : '不明'}`;
  const reasons = ['Cc 登録あり', flag('DDD', c.flags.dddEnabled), flag('テスト必須', c.flags.testsRequired), flag('domain_review', c.flags.domainReview)];
  return check('concordia', label, c.flags.dddEnabled === true, reasons);
}

/** Actio: the project belongs to at least one team. */
export function actioCheck(b: EvidenceBundle): SetupCheck {
  const label = 'Actio のチーム所属';
  const a = b.actio;
  if (!a) return check('actio', label, false, ['Actio 未取得']);
  return check('actio', label, a.teams.length > 0, [a.teams.length > 0 ? `チーム ${a.teams.map((t) => t.teamName).join(' / ')}` : 'チーム所属なし']);
}
