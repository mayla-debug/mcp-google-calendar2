// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { google } from "googleapis";

// Compat tra versioni SDK (registerTool vs tool)
function registerToolCompat(s: any, name: string, def: any, handler: any) {
  const fn = (s as any).registerTool ?? (s as any).tool;
  return fn.call(s, name, def, handler);
}

export default function ({ config }: { config?: Record<string, unknown> }) {
  const server = new McpServer({
    name: "google-calendar-mcp",
    version: "1.0.0",
  });

  // TOOL 1 — ping
  registerToolCompat(
    server,
    "ping",
    {
      description: "Health check per verificare che il server risponda",
      inputSchema: z.object({}).strict(),
    },
    async () => ({
      content: [{ type: "text", text: "pong 🏓" }],
    })
  );

  // TOOL 2 — list_events
  registerToolCompat(
    server,
    "list_events",
    {
      description: "Elenca gli eventi futuri dal Google Calendar configurato",
      inputSchema: z.object({
        maxResults: z.number().optional().default(5),
      }),
    },
    async ({ maxResults }) => {
      try {
        const auth = new google.auth.JWT(
          process.env.GOOGLE_CLIENT_EMAIL,
          undefined,
          // IMPORTANTE: converti \n in vere nuove righe
          process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
          ["https://www.googleapis.com/auth/calendar.readonly"]
        );

        const calendar = google.calendar({ version: "v3", auth });

        const res = await calendar.events.list({
          calendarId: process.env.GOOGLE_CALENDAR_ID,
          timeMin: new Date().toISOString(),
          maxResults,
          singleEvents: true,
          orderBy: "startTime",
        });

        const events = res.data.items || [];
        if (events.length === 0) {
          return { content: [{ type: "text", text: "📭 Nessun evento trovato." }] };
        }

        const list = events
          .map((e) => {
            const start = e.start?.dateTime || e.start?.date || "Senza data";
            const title = e.summary || "(Senza titolo)";
            return `📅 ${start} — ${title}`;
          })
          .join("\n");

        return { content: [{ type: "text", text: list }] };
      } catch (err: any) {
        console.error("Errore list_events:", err);
        return {
          content: [{ type: "text", text: `❌ Errore: ${err.message}` }],
        };
      }
    }
  );

  // DEVI restituire l'istanza del server
  return server;
}
