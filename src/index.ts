// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod"; // ✅ aggiunta importazione Zod

// compat fra versioni SDK (registerTool vs tool)
function registerToolCompat(s: any, name: string, def: any, handler: any) {
  const fn = (s as any).registerTool ?? (s as any).tool;
  return fn.call(s, name, def, handler);
}

/**
 * Default export richiesto da Smithery.
 * Firma accettata: export default function({ config }) { ... }
 * (Se vuoi lo stateful, usa { sessionId, config }).
 */
export default function ({ config }: { config?: Record<string, unknown> }) {
  const server = new McpServer({
    name: "google-calendar-mcp",
    version: "1.0.0",
  });

  // ✅ Tool di test “ping” con schema Zod
  registerToolCompat(
    server,
    "ping",
    {
      description: "Health check",
      inputSchema: z.object({}).strict() // <- cambia solo questa parte
    },
    async () => ({
      content: [{ type: "text", text: "pong 🏓" }]
    })
  );

  return server;
}
