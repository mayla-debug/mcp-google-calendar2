// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { google } from "googleapis";

// compat fra versioni SDK (registerTool vs tool)
function registerToolCompat(s: any, name: string, def: any, handler: any) {
  const fn = (s as any).registerTool ?? (s as any).tool;
  return fn.call(s, name, def, handler);
}

// Validazione variabili ambiente
const Env = z.object({
  GOOGLE_CLIENT_EMAIL: z.string(),
  GOOGLE_PRIVATE_KEY: z.string(),
  GOOGLE_CALENDAR_ID: z.string()
});

function getCalendarClient() {
  const parsed = Env.safeParse(process.env);
  if (!parsed.success) {
    const missing = Object.keys(parsed.error.flatten().fieldErrors).join(", ");
    throw new Error("Missing env vars: " + missing);
  }

  const { GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY } = parsed.data;
  const key = GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"]
  });

  return google.calendar({ version: "v3", auth });
}

export default function ({ config }: { config?: Record<string, unknown> }) {
  const server = new McpServer({
    name: "google-calendar-mcp",
    version: "1.0.0",
  });

  // 🔹 Tool di test
  registerToolCompat(
    server,
    "ping",
    {
      description: "Health check",
      inputSchema: z.object({}).strict()
    },
    async () => ({
      content: [{ type: "text", text: "pong 🏓" }]
    })
  );

  // 🔹 Tool reale: lista eventi futuri
  const ListSchema = z.object({
    maxResults: z.number().int().positive().max(50).optional().default(5),
    q: z.string().optional()
  }).strict();

  registerToolCompat(
    server,
    "calendar.listUpcoming",
    {
      description: "Lista gli eventi futuri dal calendario Google",
      inputSchema: ListSchema
    },
    async ({ input }) => {
      try {
        const cal = getCalendarClient();
        const res = await cal.events.list({
          calendarId: process.env.GOOGLE_CALENDAR_ID!,
          singleEvents: true,
          orderBy: "startTime",
          maxResults: input.maxResults ?? 5,
          timeMin: new Date().toISOString(),
          q: input.q ?? undefined
        });

        const events = res.data.items ?? [];
        if (events.length === 0) {
          return { content: [{ type: "text", text: "Nessun evento trovato." }] };
        }

        const text = events
          .map(
            (e) =>
              `• ${e.summary ?? "(senza titolo)"} — ${e.start?.dateTime ?? e.start?.date}`
          )
          .join("\n");

        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text",
              text: `Errore in calendar.listUpcoming: ${err.message}`
            }
          ]
        };
      }
    }
  );

  return server;
}
