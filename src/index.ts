import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Log utili
process.on("unhandledRejection", (err: any) => {
  console.error("[MCP] UnhandledRejection:", err);
});
process.on("uncaughtException", (err: any) => {
  console.error("[MCP] UncaughtException:", err);
});

export default function createServer() {
  const server = new McpServer({
    name: "google-calendar-mcp",
    version: "1.0.3"
  });

  // Tool PING — schema permissivo (alcune UI inviano arguments: undefined)
  server.tool(
    "ping",
    {
      description: "Health check (returns 'pong 🏓')",
      inputSchema: {
        anyOf: [
          { type: "object", properties: {}, additionalProperties: false },
          { type: "null" }
        ]
      }
    },
    async (_args) => {
      console.log("[MCP] ping invoked");
      return { content: [{ type: "text", text: "pong 🏓" }] };
    }
  );

  // (Facoltativo) Tool echo per testare gli argomenti
  server.tool(
    "echo",
    {
      description: "Echo back the provided text",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
        additionalProperties: false
      }
    },
    async (args: any) => {
      const text = String(args?.text ?? "");
      console.log("[MCP] echo invoked with:", text);
      return { content: [{ type: "text", text }] };
    }
  );

  return server;
}
