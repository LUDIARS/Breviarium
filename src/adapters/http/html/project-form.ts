// @implements SPEC-br-web-ui
import type { Project } from '../../../registry/domain/model.ts';
import { esc } from './escape.ts';

function field(id: string, name: string, label: string, value: string, extra = ''): string {
  return `<label for="${id}">${esc(label)}<input id="${id}" name="${name}" value="${esc(value)}" ${extra}></label>`;
}

/**
 * Registration fields shared by the create and edit forms. The code is only asked for
 * when creating (it never changes). `idPrefix` keeps ids unique on one page.
 */
export function projectFields(idPrefix: string, project?: Project): string {
  const b = project?.bindings ?? {};
  const classification = project?.classification ?? 'internal';
  const option = (value: string, label: string) => `<option value="${value}"${classification === value ? ' selected' : ''}>${esc(label)}</option>`;
  return [
    project ? '' : field(`${idPrefix}-code`, 'code', 'code (Cc の略称)', '', 'required maxlength="16" pattern="[A-Za-z][A-Za-z0-9]{0,15}" autocomplete="off"'),
    field(`${idPrefix}-name`, 'name', '名前', project?.name ?? '', 'required maxlength="120"'),
    field(`${idPrefix}-repo`, 'repoPath', 'repoPath (ローカル checkout の絶対パス)', project?.repoPath ?? '', 'required maxlength="400" autocomplete="off"'),
    `<label for="${idPrefix}-class">分類<select id="${idPrefix}-class" name="classification">${option('internal', 'internal (LUDIARS 内)')}${option('public', 'public')}</select></label>`,
    field(`${idPrefix}-pf`, 'praeformaProjectId', 'Praeforma プロジェクト id (任意)', b.praeformaProjectId ?? '', 'maxlength="64" autocomplete="off"'),
    field(`${idPrefix}-el`, 'elegantiaProduct', 'Elegantia product (任意)', b.elegantiaProduct ?? '', 'maxlength="160" autocomplete="off"'),
    field(`${idPrefix}-vo`, 'voluptasPath', 'Voluptas データの相対パス (任意)', b.voluptasPath ?? '', 'maxlength="200" autocomplete="off"'),
    field(`${idPrefix}-gh`, 'githubRepo', 'GitHub リポ owner/name (任意、PR の照合に使う)', b.githubRepo ?? '', 'maxlength="201" autocomplete="off"'),
    field(`${idPrefix}-ac`, 'actioProjectCode', 'Actio の Cc 略称 (任意、未入力なら code でスプリントを読む)', b.actioProjectCode ?? '', 'maxlength="16" pattern="[A-Za-z][A-Za-z0-9]{0,15}" autocomplete="off"'),
  ].join('');
}
