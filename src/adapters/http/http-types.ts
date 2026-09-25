// @implements SPEC-br-web-ui
/** Transport-neutral request/response so routes can be exercised without opening a socket. */
export interface HttpRequest {
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly body: string;
}

export interface HttpResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export type RouteParams = Readonly<Record<string, string>>;

export type RouteHandler = (req: HttpRequest, params: RouteParams) => Promise<HttpResponse>;
