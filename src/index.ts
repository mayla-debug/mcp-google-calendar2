// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { google } from "googleapis";

// Compatibilità SDK (tool vs registerTool)
function registerToolCompat(s: any, name: string, def: any, handler: any) {
  const fn = (s as any).registerTool ?? (s as any).tool;
  return fn.call(s, name, def, handler);
}

export default function ({ config }: { config?: Record<string, unknown> }) {
  const server = new McpServer({
    name: "google-calendar-mcp",
    version: "1.0.0",
  });

  // 🟢 Test tool
  registerToolCompat(
    server,
    "ping",
    {
      description: "Health check",
      inputSchema: z.object({}).strict(),
    },
    async () => ({
      content: [{ type: "text", text: "pong 🏓" }],
    })
  );

  // 🟢 Tool: list_events
  registerToolCompat(
    server,
    "list_events",
    {
      description: "Elenca gli eventi futuri dal calendario Google",
      inputSchema: z.object({
        maxResults: z.number().optional().default(5),
      }),
    },
    async ({ maxResults }) => {
      try {
        const auth = new google.auth.JWT(
          process.env.GOOGLE_CLIENT_EMAIL,
          undefined,
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
          return {
            content: [{ type: "text", text: "📭 Nessun evento trovato." }],
          };
        }

        const list = events
          .map((e) => {
            const start = e.start?.dateTime || e.start?.date || "Senza data";
            return `📅 ${start} — ${e.summary ?? "(Senza titolo)"}`;
          })
          .join("\n");

        return { content: [{ type: "text", text: list }] };
      } catch (err: any) {
        console.error("Errore list_events:", err);
        return {
          content: [
            {
              type: "text",
              text: `❌ Errore: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  return server;
}
