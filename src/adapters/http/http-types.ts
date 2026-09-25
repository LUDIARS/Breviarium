// @implements SPEC-br-web-ui
/**
 * Who the entrance admitted the request as (spec/feature/web-entrance.md):
 * `local` = the service's own loopback authority without forwarding headers (all operations);
 * `viewer` = a verified Cloudflare Access request (GET / HEAD only).
 */
export type AccessLevel = 'local' | 'viewer';

/** Transport-neutral request/response so routes can be exercised without opening a socket. */
export interface HttpRequest {
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly body: string;
  /** Set by the entrance only after Host/Origin and Access admission. */
  readonly accessLevel: AccessLevel;
}

export interface HttpResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export type RouteParams = Readonly<Record<string, string>>;

export type RouteHandler = (req: HttpRequest, params: RouteParams) => Promise<HttpResponse>;
