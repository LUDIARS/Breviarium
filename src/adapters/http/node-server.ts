// @implements SPEC-br-web-ui
// @implements SPEC-br-web-entrance
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { WebAccess } from '../config/web-access.ts';
import type { AccessTokenVerifier } from './cloudflare-access-verifier.ts';
import type { HttpRequest, HttpResponse } from './http-types.ts';
import { admitRequest } from './request-admission.ts';
import type { Router } from './router.ts';

export const MAX_BODY_BYTES = 1_000_000;

class BodyTooLargeError extends Error {}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > MAX_BODY_BYTES) throw new BodyTooLargeError();
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function toHeaders(req: IncomingMessage): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(req.headers)) out[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
  return out;
}

function send(res: ServerResponse, response: HttpResponse): void {
  res.writeHead(response.status, response.headers);
  res.end(response.body);
}

/**
 * Adapts node:http to the transport-neutral router. The entrance (Host/Origin → Cloudflare
 * Access → access level) runs before the body is read or any route is matched. The caller
 * owns the returned server and is responsible for `listen` and `close`.
 */
export function createNodeServer(router: Router, access: WebAccess, verifier: AccessTokenVerifier | undefined, onError: (error: unknown) => void): Server {
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      try {
        const headers = toHeaders(req);
        const method = req.method ?? 'GET';
        const admission = await admitRequest(method, headers, { access, verifier, onError });
        if ('refusal' in admission) {
          send(res, admission.refusal);
          return;
        }
        const url = new URL(req.url ?? '/', 'http://localhost');
        const request: HttpRequest = {
          method,
          path: url.pathname,
          query: url.searchParams,
          headers,
          body: method === 'GET' || method === 'HEAD' ? '' : await readBody(req),
          accessLevel: admission.level,
        };
        send(res, await router.handle(request));
      } catch (error) {
        if (error instanceof BodyTooLargeError) {
          res.writeHead(413, { 'content-type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'payload_too_large' }));
          return;
        }
        onError(error);
        if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'internal_error' }));
      }
    })();
  });
}
