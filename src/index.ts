// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Compat tra versioni SDK (registerTool vs tool)
function registerToolCompat(s: any, name: string, def: any, handler: any) {
  const fn = (s as any).registerTool ?? (s as any).tool;
  return fn.call(s, name, def, handler);
}

export default function () {
  const server = new McpServer({
    name: "google-calendar-mcp",
    version: "1.0.1",
  });

  registerToolCompat(
    server,
    "ping",
    {
      description: "Health check",
      inputSchema: {
        type: "object",
        properties: {},          // <— importante per JSON Schema “vuoto”
        additionalProperties: false,
      },
    },
    async () => ({ content: [{ type: "text", text: "pong 🏓" }] })
  );

  return server;
}
