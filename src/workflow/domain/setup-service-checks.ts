// @implements SPEC-br-workflow
import type { EvidenceBundle, ExcubitorEvidence, GitEvidence, RevisorEvidence, ServiceCatalogFact } from '../../inspections/domain/evidence.ts';
import { check, notApplicable, type SetupCheck } from './setup-check.ts';

/** Cc's `revisor_workflow` value of the projects that publish through Revisor; any other value publishes on GitHub itself. */
const REVISOR_WORKFLOW = 'revisor';
const PUBLISH_LABEL = '公開先 (Revisor / GitHub)';

const sameCode = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

/** Revisor workflow: `revisor repo list` has the bound GitHub repository. */
function revisorRegistration(r: RevisorEvidence | null): SetupCheck {
  const label = 'Revisor 登録';
  const why = `Cc のワークフロー ${REVISOR_WORKFLOW}`;
  if (!r) return check('revisor', label, false, [why, 'Revisor 未取得 (CLI 未設定・bindings.githubRepo 未登録)']);
  return check('revisor', label, r.registered, [why, `${r.repository} は Revisor に${r.registered ? '登録あり' : '未登録'}`]);
}

/** GitHub (non-Revisor) workflow: the checkout has an `origin` remote; only its host is shown, never the URL. */
function remoteCheck(git: GitEvidence | null, workflow: string): SetupCheck {
  const label = '公開先 (GitHub remote)';
  const why = `Cc のワークフロー ${workflow}`;
  if (!git) return check('revisor', label, false, [why, 'git 未取得']);
  if (!git.origin) return check('revisor', label, false, [why, 'remote origin なし']);
  return check('revisor', label, true, [why, `remote origin (${git.origin.host ?? 'ローカルパス'})`]);
}

/**
 * Where the project is published, by Cc's `revisor_workflow`: `revisor` needs the Revisor registration, any
 * other workflow (`github` …) needs an `origin` remote, and an unset workflow is 未 with the reason.
 */
export function publishCheck(b: EvidenceBundle): SetupCheck {
  const c = b.concordia;
  if (!c) return check('revisor', PUBLISH_LABEL, false, ['Cc 未取得 (ワークフロー不明)']);
  const workflow = c.revisorWorkflow?.trim().toLowerCase() ?? '';
  if (workflow === '') return check('revisor', PUBLISH_LABEL, false, ['Cc のワークフロー未設定 (revisor_workflow なし)']);
  return workflow === REVISOR_WORKFLOW ? revisorRegistration(b.revisor) : remoteCheck(b.git, workflow);
}

function catalogCodes(catalog: ServiceCatalogFact): string {
  return catalog.services.length > 0 ? `code ${catalog.services.map((s) => s.code).join(', ')}` : 'サービスなし';
}

function catalogService(catalog: ServiceCatalogFact | null, code: string): ServiceCatalogFact['services'][number] | null {
  return catalog?.services.find((service) => sameCode(service.code, code)) ?? null;
}

/** When the looked-up code is missing but Excubitor has the catalog's first code, say how to match them. */
function codeHint(catalog: ServiceCatalogFact | null, ex: ExcubitorEvidence): string[] {
  const first = catalog?.services[0]?.code;
  if (ex.found || !first || sameCode(first, ex.service) || !ex.serviceCodes.some((c) => sameCode(c, first))) return [];
  return [`Excubitor には catalog 先頭の ${first} がある (bindings.excubitorService=${first} で照合)`];
}

/**
 * Excubitor 登録 (required of every project — games and single apps use Excubitor in their automated tests): a
 * service-owned `excubitor.catalog.yaml` at the checkout root, and the service in Excubitor's catalog.
 */
export function excubitorCheck(b: EvidenceBundle): SetupCheck {
  const label = 'Excubitor 登録 (catalog と Ex)';
  const r = b.repoArtifacts;
  if (!r) return check('excubitor', label, false, ['リポ成果物 未取得 (excubitor.catalog.yaml を読めない)']);
  const catalog = r.serviceCatalog;
  const catalogPart = catalog ? `excubitor.catalog.yaml あり (${catalogCodes(catalog)})` : 'excubitor.catalog.yaml なし';
  const ex = b.excubitor;
  if (!ex) return check('excubitor', label, false, [catalogPart, 'Excubitor 未取得 (未接続)']);
  const ownedService = catalogService(catalog, ex.service);
  const reasons = [catalogPart, `Excubitor に ${ex.service} ${ex.found ? 'あり' : 'なし'}`, ...codeHint(catalog, ex)];
  if (catalog && !ex.found) reasons.unshift('catalog はあるが Ex 未反映');
  if (!catalog && ex.found) reasons.unshift('Ex にあるが catalog なし');
  if (catalog && !ownedService) reasons.unshift(`catalog に照合 code ${ex.service} なし`);
  return check('excubitor', label, ownedService !== null && ex.found, reasons);
}

function envConfigPart(env: ExcubitorEvidence['envConfig']): string {
  if (!env) return 'env-config 未取得';
  return env.ready === true && env.missingCount === 0 ? 'env-config ready (不足 0 件)' : `env-config 未 ready (不足 ${env.missingCount} 件)`;
}

/**
 * 関連設定 (dependencies and hubs), only for a catalog that declares depends_on / required_env / provides / a hub
 * (uses_corpus, cernere_launch_credentials): Excubitor's env-config is ready with nothing missing and every
 * depends_on service is in Excubitor's catalog. Without such a declaration it does not apply (該当なし).
 */
export function relatedSettingsCheck(b: EvidenceBundle): SetupCheck {
  const label = '関連設定 (依存サービス・ハブ)';
  const r = b.repoArtifacts;
  if (!r) return check('related', label, false, ['リポ成果物 未取得']);
  if (!r.serviceCatalog) return notApplicable('related', label, ['excubitor.catalog.yaml なし']);
  const ex = b.excubitor;
  if (!ex) {
    const declarations = unique(r.serviceCatalog.services.flatMap((service) => service.declarations));
    if (declarations.length === 0) return notApplicable('related', label, ['関連設定の宣言なし']);
    return check('related', label, false, [`宣言: ${declarations.join('・')}`, 'Excubitor 未取得 (照合 service 不明)']);
  }
  const service = catalogService(r.serviceCatalog, ex.service);
  if (!service) return check('related', label, false, [`catalog に照合 code ${ex.service} なし`]);
  const declarations = unique(service.declarations);
  if (declarations.length === 0) return notApplicable('related', label, ['関連設定の宣言なし']);
  const declared = `宣言: ${declarations.join('・')}`;
  if (!ex.found) return check('related', label, false, [declared, `Excubitor に ${ex.service} なし (env-config を読めない)`]);
  const dependsOn = unique(service.dependsOn);
  const absent = dependsOn.filter((d) => !ex.serviceCodes.some((c) => sameCode(c, d)));
  const dependsPart =
    dependsOn.length === 0 ? 'depends_on なし' : absent.length === 0 ? `depends_on ${dependsOn.length} 件すべて Ex にあり` : `depends_on のうち Ex に無い: ${absent.join(', ')}`;
  const envReady = ex.envConfig?.ready === true && ex.envConfig.missingCount === 0;
  return check('related', label, envReady && absent.length === 0, [declared, envConfigPart(ex.envConfig), dependsPart]);
}
