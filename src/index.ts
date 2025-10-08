import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export default function createServer() {
  const server = new McpServer({
    name: "google-calendar-mcp",
    version: "1.0.3",
  });

  server.tool(
    "ping",
    {
      description: "Health check (returns 'pong 🏓')",
      inputSchema: {                       // 👈 camelCase, non annotations
        type: "object",
        properties: {},
        additionalProperties: false
      }
    },
    async () => {
      console.error("[MCP] ping invoked");
      return { content: [{ type: "text", text: "pong 🏓" }] };
    }
  );

  server.tool(
    "echo",
    {
      description: "Echo back the provided text",
      inputSchema: {                       // 👈 camelCase
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
        additionalProperties: false
      }
    },
    async (args: any) => {
      const text = typeof args?.text === "string" ? args.text : String(args?.text ?? "");
      console.error("[MCP] echo invoked with:", text);
      return { content: [{ type: "text", text }] };
    }
  );

  return server;
}
