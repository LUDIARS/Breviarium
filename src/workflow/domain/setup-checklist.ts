// @implements SPEC-br-workflow
import type { EvidenceBundle } from '../../inspections/domain/evidence.ts';
import type { SetupCheck } from './setup-check.ts';
import { actioCheck, anatomiaCheck, concordiaCheck, praeformaCheck } from './setup-registration-checks.ts';
import { excubitorCheck, publishCheck, relatedSettingsCheck } from './setup-service-checks.ts';

export type { SetupCheck, SetupItemId } from './setup-check.ts';

/**
 * The seven checks of the startup setup, in display order: the registrations (Pf / Anatomia / Cc / Actio) and
 * the service operation (publish target by Cc's workflow, Excubitor, related settings that may not apply).
 */
export function setupChecklist(b: EvidenceBundle): SetupCheck[] {
  return [praeformaCheck(b), anatomiaCheck(b), concordiaCheck(b), publishCheck(b), actioCheck(b), excubitorCheck(b), relatedSettingsCheck(b)];
}
