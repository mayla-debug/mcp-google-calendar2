// src/mcp.ts — entry usata solo dallo smithery CLI (container)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// compat: alcune versioni hanno server.tool, altre server.registerTool
function registerToolCompat(s: any, name: string, def: any, handler: any) {
  const fn = s.registerTool ?? s.tool;
  return fn.call(s, name, def, handler);
}

export default async function createServer() {
  const server = new McpServer({
    name: "google-calendar-mcp",
    version: "1.0.0",
  });

  // Tool minimo per permettere allo scan di trovare qualcosa
  registerToolCompat(
    server,
    "ping",
    {
      description: "Health check",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    async () => ({ content: [{ type: "text", text: "pong" }] })
  );

  return server;
}
