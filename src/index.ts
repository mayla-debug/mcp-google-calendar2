// src/index.ts
// Factory attesa da Smithery: export default function({ sessionId?, config? }) { return server }
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ---- compat: registra un tool indipendentemente dalla variante SDK ----
function registerToolCompat(
  server: any,
  name: string,
  def: any,
  handler: (args: any) => Promise<any>
) {
  try {
    if (typeof server.registerTool === "function") {
      // forma classica: (name, def, handler)
      return server.registerTool(name, def, handler);
    }
    if (typeof server.tool === "function") {
      // possono esistere 2 firme diverse:
      // - tool(name, def, handler)
      // - tool(defConNome, handler)
      if (server.tool.length >= 3) {
        return server.tool(name, def, handler);
      } else {
        const withName = { ...def, name };
        return server.tool(withName, handler);
      }
    }
    throw new Error("Nessun metodo di registrazione tool trovato sull'istanza MCP.");
  } catch (e: any) {
    // ignora duplicati se lo wrapper ricarica
    if (typeof e?.message === "string" && /already registered/i.test(e.message)) {
      console.warn(`[MCP] tool '${name}' già registrato → skip`);
      return;
    }
    throw e;
  }
}

export default function createServer(_opts: { sessionId?: string; config?: unknown } = {}) {
  try {
    const server = new McpServer({
      name: "mcp-google-calendar2",
      version: "1.3.0",
    });

    // ---------- Tool di health check (rinominato per evitare collisioni) ----------
    registerToolCompat(
      server,
      "health.ping",
      {
        description: "Health check (returns 'pong 🏓')",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
      },
      async () => ({ content: [{ type: "text", text: "pong 🏓" }] })
    );

    // ---------- Helpers Google (Service Account) ----------
    const asText = (obj: unknown) =>
      ({ type: "text" as const, text: JSON.stringify(obj, null, 2) });

    async function getAuth() {
      const scope =
        process.env.GOOGLE_SCOPES ||
        "https://www.googleapis.com/auth/ca
