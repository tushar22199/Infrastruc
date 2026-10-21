import { Router, type Request, type Response } from "express";

const MCP_UPSTREAM = "https://infrastruc.onrender.com/mcp";
const SEARCH_TOOL = "search_inspections";
const ALLOWED_METHODS = new Set([
  "initialize",
  "notifications/initialized",
  "tools/list",
  "tools/call",
]);

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateRequestBody(body: unknown): string | null {
  if (!isJsonObject(body) || body.jsonrpc !== "2.0") {
    return "Expected a JSON-RPC 2.0 request.";
  }
  if (typeof body.method !== "string" || !ALLOWED_METHODS.has(body.method)) {
    return "This MCP method is not available through the preview proxy.";
  }

  if (body.method === "notifications/initialized") {
    if ("id" in body) return "MCP notifications must not include an id.";
    return null;
  }

  if (
    typeof body.id !== "string" &&
    !(typeof body.id === "number" && Number.isFinite(body.id))
  ) {
    return "MCP requests must include a valid id.";
  }

  if (body.method === "tools/call") {
    const params = isJsonObject(body.params) ? body.params : null;
    const args =
      params && isJsonObject(params.arguments) ? params.arguments : null;
    if (params?.name !== SEARCH_TOOL) {
      return "Only the read-only inspection search tool is available.";
    }
    if (
      typeof args?.query !== "string" ||
      !args.query.trim() ||
      args.query.length > 500
    ) {
      return "Search queries must contain 1 to 500 characters.";
    }
  }

  return null;
}

async function proxyMcpRequest(req: Request, res: Response): Promise<void> {
  const authorization = req.get("authorization");
  if (!authorization?.startsWith("Bearer ") || !authorization.slice(7).trim()) {
    res.status(401).json({ error: "A bearer token is required." });
    return;
  }

  const validationError = validateRequestBody(req.body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const requestBody = JSON.stringify(req.body);
  if (requestBody.length > 16_384) {
    res.status(413).json({ error: "The MCP request is too large." });
    return;
  }

  const headers: Record<string, string> = {
    Accept: "application/json, text/event-stream",
    Authorization: authorization,
    "Content-Type": "application/json",
  };
  const protocolVersion = req.get("MCP-Protocol-Version");
  if (protocolVersion && protocolVersion.length <= 32) {
    headers["MCP-Protocol-Version"] = protocolVersion;
  }

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(MCP_UPSTREAM, {
      method: "POST",
      headers,
      body: requestBody,
    });
  } catch {
    req.log.warn("MCP upstream request failed");
    res.status(502).json({ error: "The MCP service could not be reached." });
    return;
  }

  const contentType = upstream.headers.get("content-type");
  if (contentType) res.setHeader("Content-Type", contentType);
  for (const headerName of [
    "mcp-protocol-version",
    "mcp-session-id",
    "retry-after",
  ]) {
    const value = upstream.headers.get(headerName);
    if (value) res.setHeader(headerName, value);
  }
  res.setHeader("Cache-Control", "no-store");

  const responseBody = Buffer.from(await upstream.arrayBuffer());
  res.status(upstream.status);
  if (responseBody.length === 0) {
    res.end();
    return;
  }
  res.end(responseBody);
}

const mcpProxyRouter = Router();
mcpProxyRouter.all("/", async (req, res): Promise<void> => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Only POST is supported." });
    return;
  }
  await proxyMcpRequest(req, res);
});

export default mcpProxyRouter;
