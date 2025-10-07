// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { google } from "googleapis";
import { z } from "zod";                         // 👈 usa Zod

function registerToolCompat(s: any, name: string, def: any, handler: any) {
  const fn = (s as any).registerTool ?? (s as any).tool;
  return fn.call(s, name, def, handler);
}

export default function () {
  const server = new McpServer({ name: "google-calendar-mcp", version: "1.0.0" });

  // ✅ ping con Zod
  registerToolCompat(
    server,
    "ping",
    {
      description: "Health check",
      inputSchema: z.object({}).strict(),        // 👈 Zod, non JSON
    },
    async () => ({ content: [{ type: "text", text: "pong 🏓" }] })
  );

  // ✅ list_events con Zod
  registerToolCompat(
    server,
    "list_events",
    {
      description: "Elenca gli eventi futuri dal Google Calendar configurato",
      inputSchema: z.object({
        maxResults: z.number().int().positive().max(50).default(5).optional(),
      }),
    },
    // 👇 l'argomento è già validato/parso da Zod
    async ({ maxResults }: { maxResults?: number }) => {
      try {
        const auth = new google.auth.JWT(
          process.env.GOOGLE_CLIENT_EMAIL,
          undefined,
          (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
          ["https://www.googleapis.com/auth/calendar.readonly"]
        );

        const calendar = google.calendar({ version: "v3", auth });

        const res = await calendar.events.list({
          calendarId: process.env.GOOGLE_CALENDAR_ID,
          timeMin: new Date().toISOString(),
          maxResults: maxResults ?? 5,
          singleEvents: true,
          orderBy: "startTime",
        });

        const items = res.data.items || [];
        if (items.length === 0) {
          return { content: [{ type: "text", text: "📭 Nessun evento trovato." }] };
        }

        const text = items.map((e) => {
          const start = e.start?.dateTime || e.start?.date || "Senza data";
          const title = e.summary || "(Senza titolo)";
          return `📅 ${start} — ${title}`;
        }).join("\n");

        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        console.error("Errore list_events:", err);
        return { content: [{ type: "text", text: `❌ Errore: ${err.message}` }] };
      }
    }
  );

  return server;
}
