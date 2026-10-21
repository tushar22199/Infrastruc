
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { retrieveRelevantInspections } from "./ai/retriever/inspection-retriever";
import { z } from "zod";

export function createInfraSightMcpServer() {
  const server = new McpServer({
    name: "infrasight-voice",
    version: "1.0.0",
  });

  server.tool(
    "search_inspections",
    "Search infrastructure inspection records by issue type, severity, status, or natural-language query. This tool is read-only.",
    {
      query: z.string().min(1).max(500).describe(
        "A natural-language search, such as 'show critical active bridge inspections' or 'summarize recent road defects'.",
      ),
    },
    async ({ query }) => {
      try {
        const results = await retrieveRelevantInspections(query);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  query,
                  count: Array.isArray(results) ? results.length : 0,
                  inspections: results,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        console.error("MCP search_inspections failed:", error);

        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Unable to search inspections. Please try again.",
            },
          ],
        };
      }
    },
  );

  return server;
}
