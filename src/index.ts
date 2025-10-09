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
        "https://www.googleapis.com/auth/calendar.readonly";

      // Import dinanmico qui, così l'avvio non dipende da googleapis
      const { google } = await import("googleapis");

      if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
        const key = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");
        return new google.auth.JWT({
          email: process.env.GOOGLE_CLIENT_EMAIL,
          key,
          scopes: [scope],
          subject: process.env.GOOGLE_SUBJECT || undefined, // opzionale
        });
      }
      throw new Error(
        "Google auth non configurato: imposta GOOGLE_CLIENT_EMAIL e GOOGLE_PRIVATE_KEY nei Secrets."
      );
    }

    async function getCalendar(calendarIdOverride?: string) {
      const { google } = await import("googleapis"); // import lazy
      const auth = await getAuth();
      const cal = google.calendar({ version: "v3", auth });
      const calendarId = calendarIdOverride || process.env.CALENDAR_ID || "primary";
      return { cal, calendarId };
    }

    // ---------- TOOL: gcal.listEvents ----------
    registerToolCompat(
      server,
      "gcal.listEvents",
      {
        description: "Elenca eventi (default: da adesso in poi).",
        inputSchema: {
          type: "object",
          properties: {
            calendarId: { type: "string", description: "es. 'primary' (default)" },
            timeMin: { type: "string", description: "ISO 8601 (default: adesso)" },
            timeMax: { type: "string", description: "ISO 8601" },
            q: { type: "string", description: "Filtro testuale" },
            maxResults: { type: "number", default: 10 },
            singleEvents: { type: "boolean", default: true }
          },
          additionalProperties: false
        }
      },
      async ({ arguments: args }) => {
        try {
          const { cal, calendarId } = await getCalendar(args?.calendarId);
          const res = await cal.events.list({
            calendarId,
            timeMin: args?.timeMin ?? new Date().toISOString(),
            timeMax: args?.timeMax,
            q: args?.q,
            maxResults: args?.maxResults ?? 10,
            singleEvents: args?.singleEvents ?? true,
            orderBy: "startTime"
          });
          return { content: [asText(res.data.items ?? [])] };
        } catch (e: any) {
          console.error("[gcal.listEvents] error:", e?.stack || e?.message || e);
          return { content: [asText({ error: e?.message || String(e) })] };
        }
      }
    );

    return server;
  } catch (bootErr: any) {
    // Se qualcosa va storto in factory, NON facciamo fallire l’initialize:
    console.error("[MCP BOOT] errore in createServer:", bootErr?.stack || bootErr?.message || bootErr);
    const safe = new McpServer({ name: "mcp-google-calendar2", version: "1.3.0-fallback" });
    // ping minimale, così almeno l’initialize passa e puoi vedere i tools
    try {
      registerToolCompat(
        safe,
        "health.ping",
        {
          description: "Health check (returns 'pong 🏓')",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
        },
        async () => ({ content: [{ type: "text", text: "pong 🏓 (fallback)" }] })
      );
    } catch {}
    return safe;
  }
}
