// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Compat tra versioni SDK (registerTool vs tool)
function registerToolCompat(s: any, name: string, def: any, handler: any) {
  const fn = (s as any).registerTool ?? (s as any).tool;
  return fn.call(s, name, def, handler);
}

// Log base per capire cosa succede
process.on("unhandledRejection", (err: any) => {
  console.error("[MCP] UnhandledRejection:", err);
});
process.on("uncaughtException", (err: any) => {
  console.error("[MCP] UncaughtException:", err);
});

export default function () {
  const server = new McpServer({
    name: "google-calendar-mcp",
    version: "1.0.1",
  });

  // Tool di healthcheck — accetta anche null/undefined come input
  registerToolCompat(
    server,
    "ping",
    {
      description: "Health check",
      // Alcune UI passano arguments: undefined → permettiamo anche null
      inputSchema: {
        type: ["object", "null"],
        properties: {},
        additionalProperties: false,
      },
    },
    async (args: unknown) => {
      // Log per verificare che arrivi qui e cosa riceviamo
      console.log("[MCP] ping invoked with args:", args);
      return {
        content: [{ type: "text", text: "pong 🏓" }],
      };
    }
  );

  return server;
}
