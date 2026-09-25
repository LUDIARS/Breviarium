// @implements SPEC-br-web-entrance
import type { WebAccess } from '../config/web-access.ts';
import { type Admission, admitMethod } from './access-level.ts';
import { admitCloudflareRequest } from './cloudflare-access-guard.ts';
import type { AccessTokenVerifier } from './cloudflare-access-verifier.ts';
import { admitWebRequest } from './host-origin-guard.ts';

type Headers = Readonly<Record<string, string | undefined>>;

export interface EntranceDeps {
  readonly access: WebAccess;
  /** Absent when Cloudflare Access is not configured: every non-local request gets 503. */
  readonly verifier: AccessTokenVerifier | undefined;
  readonly onError: (error: unknown) => void;
}

/**
 * The whole entrance in its fixed order: Host/Origin → Cloudflare Access → access level
 * (a viewer's write is refused). The node adapter reads the body only after this admits.
 */
export async function admitRequest(method: string, headers: Headers, deps: EntranceDeps): Promise<Admission> {
  const hostOrigin = admitWebRequest(headers, deps.access);
  if (hostOrigin) return { refusal: hostOrigin };
  const admission = await admitCloudflareRequest(headers, deps.access, deps.verifier, deps.onError);
  if ('refusal' in admission) return admission;
  const readOnly = admitMethod(admission.level, method);
  return readOnly ? { refusal: readOnly } : admission;
}
