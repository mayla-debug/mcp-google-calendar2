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

  // PING
  server.tool(
    "ping",
    {
      description: "Health check (returns 'pong 🏓')",
      input_schema: {
        anyOf: [
          { type: "object", properties: {}, additionalProperties: false },
          { type: "null" }
        ]
      }
    },
    async (_args) => {
      console.error("[MCP] ping invoked");
      return { content: [{ type: "text", text: "pong 🏓" }] };
    }
  );

  // ECHO
  server.tool(
    "echo",
    {
      description: "Echo back the provided text",
      input_schema: {
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
