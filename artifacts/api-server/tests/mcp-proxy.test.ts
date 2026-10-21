import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/app";

const MCP_URL = "https://infrastruc.onrender.com/mcp";

function sseResponse(body: unknown): Response {
  return new Response(
    `event: message\ndata: ${JSON.stringify(body)}\n\n`,
    { headers: { "content-type": "text/event-stream" } },
  );
}

describe("same-origin MCP preview proxy", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards authenticated MCP requests and preserves SSE responses", async () => {
    const rpcResponse = {
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        serverInfo: { name: "InfraSight", version: "1.0.0" },
      },
    };
    fetchMock.mockResolvedValueOnce(sseResponse(rpcResponse));

    const requestBody = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    };
    const response = await request(app)
      .post("/api/mcp-proxy")
      .set("Origin", "http://127.0.0.1")
      .set("Authorization", "Bearer test-only-token")
      .set("Content-Type", "application/json")
      .send(requestBody);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.text).toContain("event: message");
    expect(response.text).toContain(JSON.stringify(rpcResponse));
    expect(response.headers["access-control-allow-origin"]).toBe("http://127.0.0.1");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      MCP_URL,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-only-token",
          Accept: "application/json, text/event-stream",
        }),
        body: JSON.stringify(requestBody),
      }),
    );
  });

  it("forwards MCP initialization notifications and their empty acknowledgement", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 202 }));

    const response = await request(app)
      .post("/api/mcp-proxy")
      .set("Origin", "http://127.0.0.1")
      .set("Authorization", "Bearer test-only-token")
      .send({ jsonrpc: "2.0", method: "notifications/initialized" });

    expect(response.status).toBe(202);
    expect(response.text).toBe("");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1].body).toBe(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    );
  });

  it("forwards only the read-only inspection search tool call", async () => {
    const toolResponse = {
      jsonrpc: "2.0",
      id: 2,
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({ query: "Show all inspections", count: 0, inspections: [] }),
          },
        ],
      },
    };
    fetchMock.mockResolvedValueOnce(sseResponse(toolResponse));

    const requestBody = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "search_inspections",
        arguments: { query: "Show all inspections" },
      },
    };
    const response = await request(app)
      .post("/api/mcp-proxy")
      .set("Origin", "http://127.0.0.1")
      .set("Authorization", "Bearer test-only-token")
      .set("MCP-Protocol-Version", "2025-03-26")
      .send(requestBody);

    expect(response.status).toBe(200);
    expect(response.text).toContain(JSON.stringify(toolResponse));
    expect(fetchMock).toHaveBeenCalledWith(
      MCP_URL,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-only-token",
          "MCP-Protocol-Version": "2025-03-26",
        }),
        body: JSON.stringify(requestBody),
      }),
    );
  });

  it("rejects missing credentials and non-read-only tools before forwarding", async () => {
    const missingToken = await request(app)
      .post("/api/mcp-proxy")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(missingToken.status).toBe(401);

    const writeTool = await request(app)
      .post("/api/mcp-proxy")
      .set("Authorization", "Bearer test-only-token")
      .send({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "delete_inspection", arguments: {} },
      });
    expect(writeTool.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows the preview origin but rejects unrelated browser origins", async () => {
    const allowed = await request(app)
      .options("/api/mcp-proxy")
      .set("Origin", "http://127.0.0.1")
      .set("Access-Control-Request-Method", "POST")
      .set(
        "Access-Control-Request-Headers",
        "authorization,content-type,mcp-protocol-version",
      );
    expect(allowed.status).toBe(204);
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://127.0.0.1");

    const blocked = await request(app)
      .options("/api/mcp-proxy")
      .set("Origin", "https://untrusted.example")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "authorization,content-type");
    expect(blocked.status).toBeGreaterThanOrEqual(400);
    expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
