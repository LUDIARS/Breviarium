// @implements SPEC-br-workflow
export type SetupItemId = 'praeforma' | 'anatomia' | 'concordia' | 'revisor' | 'actio' | 'excubitor' | 'related';

/**
 * One registration the startup setup needs: done (済) or not (未), with why. Missing evidence is 未. A check that
 * does not apply to the project (`applicable: false`, 該当なし) is never done and is not counted.
 */
export interface SetupCheck {
  readonly id: SetupItemId;
  readonly label: string;
  readonly applicable: boolean;
  readonly done: boolean;
  readonly reasons: readonly string[];
}

export function check(id: SetupItemId, label: string, done: boolean, reasons: readonly string[]): SetupCheck {
  return { id, label, applicable: true, done, reasons };
}

export function notApplicable(id: SetupItemId, label: string, reasons: readonly string[]): SetupCheck {
  return { id, label, applicable: false, done: false, reasons };
}

/** 「済」「未」「該当なし」. */
export function setupCheckMark(c: SetupCheck): string {
  return c.applicable ? (c.done ? '済' : '未') : '該当なし';
}
