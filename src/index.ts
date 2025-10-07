// src/index.ts — esporta un McpServer per lo wrapper di Smithery
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// alcune versioni espongono server.tool, altre server.registerTool — gestiamo entrambe
function registerToolCompat(server: any, name: string, def: any, handler: any) {
  const fn = server.registerTool ?? server.tool;
  return fn.call(server, name, def, handler);
}

export default async function createServer() {
  const server = new McpServer({
    name: "google-calendar-mcp",
    version: "1.0.0",
  });

  // Tool minimale per permettere allo scan di trovare qualcosa
  registerToolCompat(
    server,
    "ping",
    {
      description: "Health check",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    async () => ({
      content: [{ type: "text", text: "pong" }],
    })
  );

  return server;
}
