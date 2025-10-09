// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { google } from "googleapis";

/**
 * Esporta un'unica istanza di MCP server.
 * Il trasporto HTTP/SSE lo gestisce lo wrapper Smithery (.smithery/index.cjs).
 */
const server = new McpServer({
  name: "mcp-google-calendar2",
  version: "1.1.1",
});

// --- Shim di compatibilità: se manca server.tool, alias su registerTool(name, def, handler)
const anyServer: any = server as any;
if (typeof anyServer.tool !== "function" && typeof anyServer.registerTool === "function") {
  anyServer.tool = (def: any, handler: any) => anyServer.registerTool(def.name, def, handler);
}

// ---------- Tool di health check ----------
server.tool(
  {
    name: "ping",
    description: "Health check",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  async () => ({ content: [{ type: "text", text: "pong 🏓" }] })
);

// ---------- Helpers Google (Service Account) ----------
async function getAuth() {
  const scope =
    process.env.GOOGLE_SCOPES ||
    "https://www.googleapis.com/auth/calendar.readonly";

  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    const key = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");
    return new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key,
      scopes: [scope],
      subject: process.env.GOOGLE_SUBJECT || undefined, // opzionale (Domain-Wide Delegation)
    });
  }

  throw new Error(
    "Google auth non configurato: imposta GOOGLE_CLIENT_EMAIL e GOOGLE_PRIVATE_KEY nei Secrets."
  );
}

async function getCalendar(calendarIdOverride?: string) {
  const auth = await getAuth();
  const cal = google.calendar({ version: "v3", auth });
  const calendarId = calendarIdOverride || process.env.CALENDAR_ID || "primary";
  return { cal, calendarId };
}

const asText = (obj: unknown) =>
  ({ type: "text" as const, text: JSON.stringify(obj, null, 2) });

// ---------- TOOL: gcal.listEvents ----------
server.tool(
  {
    name: "gcal.listEvents",
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
      return { content: [asText({ error: e?.message || String(e) })] };
    }
  }
);

export default server;
