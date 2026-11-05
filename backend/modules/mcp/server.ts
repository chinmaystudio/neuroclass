/**
 * MCP server (JSON-RPC 2.0 over HTTP, "Streamable HTTP" transport).
 *
 * One POST to /api/mcp carries one request or a batch. Responses are plain
 * JSON; we never open an SSE stream because every tool call is request /
 * response. GET returns 405 (clients fall back to POST), and an OPTIONS
 * preflight passes CORS.
 *
 * Supported methods (spec: 2025-06-18):
 *   initialize, initialized, ping, tools/list, tools/call
 */
import { authenticateToken } from '../tokens/service';
import { callTool, listTools } from './tools';
import type { AuthedUser } from '../core/http';

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'neuroclass', version: '1.0.0' };
const MAX_BODY = 1_000_000;

type JsonRpcRequest = { jsonrpc?: string; id?: number | string | null; method: string; params?: any };
type JsonRpcResponse = { jsonrpc: '2.0'; id: number | string | null } & ({ result: unknown } | { error: { code: number; message: string; data?: unknown } });

const E = {
  parse: -32700, invalidRequest: -32600, methodNotFound: -32601, invalidParams: -32602, internal: -32603,
};

/** Ties an MCP response to its request id, and formats errors JSON-RPC style. */
function respond(id: number | string | null, out: Promise<unknown>): Promise<JsonRpcResponse> {
  return out.then(
    (result) => ({ jsonrpc: '2.0', id, result } as JsonRpcResponse),
    (err) => {
      const anyErr = err as { status?: number; message?: string; code?: number; data?: unknown };
      const code = anyErr.status === 404 ? E.methodNotFound : anyErr.status === 400 ? E.invalidParams : anyErr.status === 403 ? -32001 : typeof anyErr.code === 'number' ? anyErr.code : E.internal;
      const message = anyErr.message ?? 'Internal server error.';
      return { jsonrpc: '2.0', id, error: { code, message, data: anyErr.data } };
    },
  );
}

async function dispatchOne(user: AuthedUser, req: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  const id = req.id ?? null;
  if (req.method === 'initialize') {
    return respond(id, Promise.resolve({ protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: 'Use list_my_classrooms to see classrooms, then create_test or create_assignment inside one. Every tool keeps the caller’s role: teacher tokens cannot act as students and vice versa.' }));
  }
  if (req.method === 'notifications/initialized') return null; // notification: no response
  if (req.method === 'ping') return respond(id, Promise.resolve({}));
  if (req.method === 'tools/list') {
    return respond(id, listTools(user).then((tools) => ({ tools })));
  }
  if (req.method === 'tools/call') {
    const params = req.params ?? {};
    const name = String(params.name ?? '');
    if (!name) return respond(id, Promise.reject({ status: 400, message: 'tools/call requires a name.' }));
    return respond(id, callTool(user, name, params.arguments).then((result) => ({
      content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }],
      structuredContent: result as any,
      isError: false,
    })).catch((err) => {
      // Tool-execution errors come back in the result (isError: true) so the
      // model can read them and recover, rather than as transport errors.
      const message = (err as { message?: string }).message ?? String(err);
      return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
    }));
  }
  return respond(id, Promise.reject({ status: 404, message: `Method not found: ${req.method}` }));
}

function corsHeaders(origin: string | null) {
  // MCP tokens auth every request, so this endpoint is safe to expose to any
  // origin — a browser can only use it if it already has a token in hand.
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Protocol-Version, Mcp-Session-Id',
    'Access-Control-Expose-Headers': 'Mcp-Protocol-Version',
    'Access-Control-Max-Age': '3600',
    Vary: 'Origin',
  } as Record<string, string>;
}

/** Handles POST /api/mcp. Returns a plain JSON-RPC response. */
export async function handleMcp(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  const base = { 'content-type': 'application/json', ...corsHeaders(origin) } as Record<string, string>;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method === 'GET') {
    // Browsers hit the URL to check it exists: a tiny JSON pointer is friendlier than 404.
    return new Response(JSON.stringify({ server: SERVER_INFO, protocolVersion: PROTOCOL_VERSION, transport: 'streamable-http', documentation: 'https://neuroclass.pages.dev/help/mcp' }), { status: 200, headers: base });
  }
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...base, allow: 'POST, OPTIONS' } });

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Authentication is required. Pass "Authorization: Bearer nc_live_…".' } }), { status: 401, headers: { ...base, 'www-authenticate': 'Bearer realm="NeuroClass MCP"' } });
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_BODY) return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Request is too large.' } }), { status: 413, headers: base });

  const user = await authenticateToken(token);
  if (!user) return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Token is invalid, expired or revoked.' } }), { status: 401, headers: base });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: E.parse, message: 'Request body is not valid JSON.' } }), { status: 400, headers: base });
  }

  const requests = Array.isArray(payload) ? payload as JsonRpcRequest[] : [payload as JsonRpcRequest];
  const results = (await Promise.all(requests.map((r) => dispatchOne(user, r ?? ({} as any))))).filter((r): r is JsonRpcResponse => r !== null);
  if (results.length === 0) return new Response(null, { status: 202, headers: base }); // notifications only
  const body = Array.isArray(payload) ? results : results[0];
  return new Response(JSON.stringify(body), { status: 200, headers: { ...base, 'Mcp-Protocol-Version': PROTOCOL_VERSION } });
}
