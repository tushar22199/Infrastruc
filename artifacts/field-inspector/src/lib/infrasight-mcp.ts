const MCP_ENDPOINT = "https://infrastruc.onrender.com/mcp";
const MCP_PROTOCOL_VERSION = "2025-03-26";

export type McpSearchErrorKind = "auth" | "network" | "mcp" | "protocol";

export class McpSearchError extends Error {
  constructor(
    message: string,
    readonly kind: McpSearchErrorKind,
  ) {
    super(message);
    this.name = "McpSearchError";
  }
}

export interface InspectionRecord {
  id?: unknown;
  title?: unknown;
  issueType?: unknown;
  severity?: unknown;
  status?: unknown;
  description?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  geometry?: unknown;
}

export interface InspectionSearchResponse {
  query: string;
  count: number;
  inspections: InspectionRecord[];
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseEventStream(text: string): unknown {
  const events: string[] = [];
  let dataLines: string[] = [];

  const flushEvent = () => {
    if (dataLines.length > 0) {
      events.push(dataLines.join("\n"));
      dataLines = [];
    }
  };

  for (const line of text.split(/\r?\n/)) {
    if (line === "") {
      flushEvent();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^\s/, ""));
    } else if (line.startsWith(":")) {
      continue;
    }
  }
  flushEvent();

  if (events.length === 0) {
    throw new McpSearchError(
      "The MCP response did not contain an event message.",
      "protocol",
    );
  }

  let lastMessage: unknown;
  for (const eventData of events) {
    if (!eventData.trim()) continue;
    try {
      lastMessage = JSON.parse(eventData) as unknown;
    } catch {
      throw new McpSearchError(
        "The MCP event contained malformed JSON.",
        "protocol",
      );
    }
  }

  if (lastMessage === undefined) {
    throw new McpSearchError("The MCP response was empty.", "protocol");
  }
  return lastMessage;
}

async function readRpcResponse(response: Response): Promise<Record<string, unknown>> {
  const body = await response.text();
  if (!body.trim()) {
    throw new McpSearchError("The MCP response was empty.", "protocol");
  }

  let parsed: unknown;
  try {
    const contentType = response.headers.get("content-type") ?? "";
    parsed =
      contentType.includes("text/event-stream") ||
      /^\s*(event:|data:)/m.test(body)
        ? parseEventStream(body)
        : (JSON.parse(body) as unknown);
  } catch (error) {
    if (error instanceof McpSearchError) throw error;
    throw new McpSearchError("The MCP response was not valid JSON.", "protocol");
  }

  const rpc = asRecord(parsed);
  if (!rpc || rpc.jsonrpc !== "2.0") {
    throw new McpSearchError("The MCP response had an invalid JSON-RPC shape.", "protocol");
  }
  return rpc;
}

async function postMcp(
  token: string,
  body: JsonRpcRequest | { jsonrpc: "2.0"; method: string },
  protocolVersion?: string,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(MCP_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(protocolVersion
          ? { "MCP-Protocol-Version": protocolVersion }
          : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new McpSearchError(
      "Could not reach the InfraSight MCP service. Check your connection and try again.",
      "network",
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new McpSearchError(
      "Your session is not authorized for inspection search. Sign in again and retry.",
      "auth",
    );
  }
  if (!response.ok) {
    throw new McpSearchError(
      `The MCP service returned an error (HTTP ${response.status}).`,
      "mcp",
    );
  }
  return response;
}

async function postNotification(
  token: string,
  body: { jsonrpc: "2.0"; method: string },
  protocolVersion: string,
): Promise<void> {
  const response = await postMcp(token, body, protocolVersion);
  // Streamable HTTP servers commonly acknowledge notifications with 202 and no body.
  if (response.status !== 202 && response.status !== 204) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/event-stream") || contentType.includes("application/json")) {
      const rpc = await readRpcResponse(response);
      if (rpc.error) {
        throw new McpSearchError("MCP initialization could not be completed.", "mcp");
      }
    }
  }
}

function getErrorMessage(rpc: Record<string, unknown>): string {
  const error = asRecord(rpc.error);
  if (typeof error?.message === "string") return error.message;
  return "The MCP service could not complete the inspection search.";
}

function getToolText(result: Record<string, unknown>): string {
  if (!Array.isArray(result.content)) {
    throw new McpSearchError(
      "The MCP tool response did not include result content.",
      "protocol",
    );
  }

  const textBlock = result.content
    .map(asRecord)
    .find((block) => block?.type === "text" && typeof block.text === "string");

  if (!textBlock || typeof textBlock.text !== "string") {
    throw new McpSearchError(
      "The MCP tool response did not include readable result text.",
      "protocol",
    );
  }
  return textBlock.text;
}

function parseToolResult(text: string, requestedQuery: string): InspectionSearchResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new McpSearchError(
      "The MCP tool returned malformed inspection data.",
      "protocol",
    );
  }

  const data = asRecord(parsed);
  if (!data || !Array.isArray(data.inspections)) {
    throw new McpSearchError(
      "The MCP tool response did not contain an inspections list.",
      "protocol",
    );
  }

  const inspections = data.inspections.map((inspection) => {
    const record = asRecord(inspection);
    if (!record) {
      throw new McpSearchError(
        "The MCP tool returned an invalid inspection record.",
        "protocol",
      );
    }
    return record as InspectionRecord;
  });

  return {
    query: typeof data.query === "string" ? data.query : requestedQuery,
    count:
      typeof data.count === "number" &&
      Number.isFinite(data.count) &&
      data.count >= 0
        ? data.count
        : inspections.length,
    inspections,
  };
}

export async function searchInspections(
  query: string,
  token: string,
): Promise<InspectionSearchResponse> {
  const normalizedQuery = query.trim();
  if (!token) {
    throw new McpSearchError(
      "Your sign-in session is missing. Sign in again to search inspections.",
      "auth",
    );
  }
  if (!normalizedQuery) {
    throw new McpSearchError("Enter a search before continuing.", "protocol");
  }
  if (normalizedQuery.length > 500) {
    throw new McpSearchError("Searches must be 500 characters or fewer.", "protocol");
  }

  const initializeResponse = await postMcp(token, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "InfraSight Voice", version: "1.0.0" },
    },
  });
  const initializeRpc = await readRpcResponse(initializeResponse);
  if (initializeRpc.error) {
    throw new McpSearchError(getErrorMessage(initializeRpc), "mcp");
  }
  if (!asRecord(initializeRpc.result)) {
    throw new McpSearchError(
      "The MCP service returned an invalid initialization response.",
      "protocol",
    );
  }
  const negotiatedVersion = asRecord(initializeRpc.result)?.protocolVersion;
  if (typeof negotiatedVersion !== "string") {
    throw new McpSearchError(
      "The MCP service did not return a protocol version.",
      "protocol",
    );
  }

  await postNotification(token, {
    jsonrpc: "2.0",
    method: "notifications/initialized",
  }, negotiatedVersion);

  const searchResponse = await postMcp(token, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "search_inspections",
      arguments: { query: normalizedQuery },
    },
  }, negotiatedVersion);
  const searchRpc = await readRpcResponse(searchResponse);
  if (searchRpc.error) {
    throw new McpSearchError(getErrorMessage(searchRpc), "mcp");
  }

  const result = asRecord(searchRpc.result);
  if (!result) {
    throw new McpSearchError(
      "The MCP service returned an invalid tool response.",
      "protocol",
    );
  }
  if (result.isError === true) {
    const content = Array.isArray(result.content)
      ? result.content
          .map(asRecord)
          .find((block) => typeof block?.text === "string")?.text
      : undefined;
    throw new McpSearchError(
      typeof content === "string"
        ? content
        : "The MCP service could not complete the inspection search.",
      "mcp",
    );
  }

  return parseToolResult(getToolText(result), normalizedQuery);
}
