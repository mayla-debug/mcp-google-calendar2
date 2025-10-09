// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { google } from "googleapis";

function buildServer() {
  const server = new McpServer({
    name: "google-calendar-mcp",
    version: "1.0.3",
  });

  // ---- health.ping (semplice JSON Schema) ----
  server.tool(
    "health.ping",
    {
      description: "Return 'pong 🏓' if the server is alive.",
      inputSchema: { type: "object", additionalProperties: false },
    },
    async () => ({ content: [{ type: "text", text: "pong 🏓" }] })
  );

  // ---- gcal.listEvents (Service Account) ----
  server.tool(
    "gcal.listEvents",
    {
      description:
        "List events from Google Calendar (Service Account). Defaults: CALENDAR_ID, now → +30 days.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          calendarId: {
            type: "string",
            description:
              "Calendar ID/email. Defaults to env CALENDAR_ID (or 'primary').",
          },
          timeMin: {
            type: "string",
            description:
              "ISO datetime (e.g., 2025-10-09T00:00:00+02:00). Default: now.",
          },
          timeMax: {
            type: "string",
            description:
              "ISO datetime. Default: now + 30 days.",
          },
          q: {
            type: "string",
            description: "Free text search in events.",
          },
          maxResults: {
            type: "number",
            minimum: 1,
            maximum: 2500,
            description: "Default 50.",
          },
        },
      },
    },
    async (args: any) => {
      const clientEmail =
        process.env.client_email || process.env.GOOGLE_CLIENT_EMAIL;
      const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").replace(
        /\\n/g,
        "\n"
      );
      const scopes =
        process.env.GOOGLE_SCOPES ||
        "https://www.googleapis.com/auth/calendar.readonly";
      const defaultCal =
        args?.calendarId ||
        process.env.CALENDAR_ID ||
        process.env.GOOGLE_CALENDAR_ID ||
        "primary";

      if (!clientEmail || !privateKey) {
        throw new Error(
          "Missing service account env: client_email and/or GOOGLE_PRIVATE_KEY"
        );
      }

      const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes,
      });
      const calendar = google.calendar({ version: "v3", auth });

      const now = new Date();
      const plus30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const res = await calendar.events.list({
        calendarId: defaultCal,
        timeMin: args?.timeMin || now.toISOString(),
        timeMax: args?.timeMax || plus30.toISOString(),
        maxResults: args?.maxResults || 50,
        q: args?.q,
        singleEvents: true,
        orderBy: "startTime",
      });

      const items = res.data.items || [];
      if (items.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "Nessun evento trovato nel periodo richiesto.",
            },
          ],
        };
      }

      const lines = items.map((ev) => {
        const start = ev.start?.dateTime || ev.start?.date || "?";
        const end = ev.end?.dateTime || ev.end?.date || "?";
        return `• ${ev.summary || "(senza titolo)"} — ${start} → ${end}`;
      });

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  return server;
}

// 👉 export richiesto da Smithery (@smithery/cli)
export default function ({ config }: { config?: unknown }) {
  return buildServer();
}
