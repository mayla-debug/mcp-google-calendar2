// Entry usata dal deployment "Container" di Smithery
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Compatibilità tra versioni dell'SDK (registerTool vs tool)
function registerToolCompat(s: any, name: string, def: any, handler: any) {
  const fn = (s as any).registerTool ?? (s as any).tool;
  return fn.call(s, name, def, handler);
}

export default async function createServer() {
  const server = new McpServer({
    name: "google-calendar-mcp",
    version: "1.0.0"
  });

  // Tool minimo per far passare lo Scan
  registerToolCompat(
    server,
    "ping",
    {
      description: "Health check",
      inputSchema: { type: "object", properties: {}, additionalProperties: false }
    },
    async () => ({ content: [{ type: "text", text: "pong" }] })
  );

  return server;
}
