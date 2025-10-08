import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Compat tra versioni SDK (registerTool vs tool)
function registerToolCompat(s: any, name: string, def: any, handler: any) {
  const fn = (s as any).registerTool ?? (s as any).tool;
  return fn.call(s, name, def, handler);
}

// Log globali per errori non gestiti
process.on("unhandledRejection", (err: any) => {
  console.error("[MCP] UnhandledRejection:", err);
});
process.on("uncaughtException", (err: any) => {
  console.error("[MCP] UncaughtException:", err);
});

export default function () {
  const server = new McpServer({
    name: "google-calendar-mcp",
    version: "1.0.1"
  });

  // Tool di health check
  registerToolCompat(
    server,
    "ping",
    {
      description: "Health check",
      // Accetta anche null o undefined come input
      inputSchema: {
        type: ["object", "null"],
        properties: {},
        additionalProperties: false
      }
    },
    async (args: unknown) => {
      console.log("[MCP] ping invoked with args:", args);
      return {
        content: [{ type: "text", text: "pong 🏓" }]
      };
    }
  );

  return server;
}
