// @implements SPEC-br-web-ui
import type { HttpRequest, HttpResponse, RouteHandler, RouteParams } from './http-types.ts';
import { BadRequestError } from './request-parsing.ts';
import { jsonResponse } from './responses.ts';

interface Route {
  readonly method: string;
  readonly segments: readonly string[];
  readonly handler: RouteHandler;
}

function match(route: Route, method: string, parts: readonly string[]): RouteParams | undefined {
  if (route.method !== method || route.segments.length !== parts.length) return undefined;
  const params: Record<string, string> = {};
  for (let i = 0; i < parts.length; i++) {
    const seg = route.segments[i] as string;
    const part = parts[i] as string;
    if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(part);
    else if (seg !== part) return undefined;
  }
  return params;
}

function split(path: string): string[] {
  return path.split('/').filter((p) => p.length > 0);
}

/** Tiny path router: `/projects/:code/variants/:id` style patterns, exact segment count. */
export class Router {
  private readonly routes: Route[] = [];

  add(method: string, pattern: string, handler: RouteHandler): this {
    this.routes.push({ method, segments: split(pattern), handler });
    return this;
  }

  async handle(req: HttpRequest): Promise<HttpResponse> {
    const parts = split(req.path);
    for (const route of this.routes) {
      let params: RouteParams | undefined;
      try {
        params = match(route, req.method, parts);
      } catch (error) {
        if (error instanceof URIError) return jsonResponse(400, { error: 'bad_request', message: 'malformed path encoding' });
        throw error;
      }
      if (!params) continue;
      try {
        return await route.handler(req, params);
      } catch (error) {
        if (error instanceof BadRequestError) return jsonResponse(400, { error: 'bad_request', message: error.message });
        throw error;
      }
    }
    return jsonResponse(404, { error: 'not_found' });
  }
}
