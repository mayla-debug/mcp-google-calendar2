import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Log utili per vedere qualsiasi errore runtime
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

  // Tool PING: schema super permissivo per evitare errori da arguments undefined
  server.tool(
    "ping",
    {
      description: "Health check (returns 'pong 🏓')",
      inputSchema: {
        // Permettiamo object, null e anche omissione (almeno una di queste verrà accettata dalla UI)
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

  // Tool ECHO per testare passaggio args
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
