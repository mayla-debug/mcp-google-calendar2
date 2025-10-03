import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as fs from "fs/promises";
import * as path from "path";
import { z } from "zod";
import { AuthServer } from "./auth-server.js";
import { TokenManager } from "./token-manager.js";
import { rel } from "./paths.js";

interface CalendarListEntry {
  id?: string | null;
  summary?: string | null;
}

interface CalendarEvent {
  id?: string | null;
  summary?: string | null;
  start?: { dateTime?: string | null; date?: string | null };
  end?: { dateTime?: string | null; date?: string | null };
  location?: string | null;
  attendees?: CalendarEventAttendee[] | null;
}

interface CalendarEventAttendee {
  email?: string | null;
  responseStatus?: string | null;
}

const ListEventsArgumentsSchema = z.object({
  calendarId: z.string(),
  timeMin: z.string().optional(),
  timeMax: z.string().optional(),
});

const CreateEventArgumentsSchema = z.object({
  calendarId: z.string(),
  summary: z.string(),
  description: z.string().optional(),
  start: z.string(),
  end: z.string(),
  attendees: z.array(z.object({ email: z.string() })).optional(),
  location: z.string().optional(),
});

const UpdateEventArgumentsSchema = z.object({
  calendarId: z.string(),
  eventId: z.string(),
  summary: z.string().optional(),
  description: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  attendees: z.array(z.object({ email: z.string() })).optional(),
  location: z.string().optional(),
});

const DeleteEventArgumentsSchema = z.object({
  calendarId: z.string(),
  eventId: z.string(),
});

const server = new Server(
  { name: "google-calendar", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

async function initializeOAuth2Client() {
  // preferisci env, poi file gcp-oauth.keys.json
  const envId = process.env.GOOGLE_CLIENT_ID;
  const envSecret = process.env.GOOGLE_CLIENT_SECRET;
  const envRedirect = process.env.GOOGLE_REDIRECT_URI;

  if (envId && envSecret && envRedirect) {
    return new OAuth2Client({
      clientId: envId,
      clientSecret: envSecret,
      redirectUri: envRedirect,
    });
  }

  const keyPath = rel("gcp-oauth.keys.json");
  const keysContent = await fs.readFile(keyPath, "utf-8");
  const keys = JSON.parse(keysContent);
  const { client_id, client_secret, redirect_uris } = keys.installed;

  return new OAuth2Client({
    clientId: client_id,
    clientSecret: client_secret,
    redirectUri: redirect_uris[0],
  });
}

let oauth2Client: OAuth2Client;
let tokenManager: TokenManager;
let authServer: AuthServer;

function getSecureTokenPath(): string {
  return rel(".gcp-saved-tokens.json");
}

// — Tools list
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list-calendars",
        description: "List all available calendars",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "list-events",
        description: "List events from a calendar",
        inputSchema: {
          type: "object",
          properties: {
            calendarId: { type: "string", description: "Calendar ID" },
            timeMin: { type: "string", description: "ISO start (optional)" },
            timeMax: { type: "string", description: "ISO end (optional)" },
          },
          required: ["calendarId"],
        },
      },
      {
        name: "create-event",
        description: "Create a new calendar event",
        inputSchema: {
          type: "object",
          properties: {
            calendarId: { type: "string" },
            summary: { type: "string" },
            description: { type: "string" },
            start: { type: "string" },
            end: { type: "string" },
            location: { type: "string" },
            attendees: {
              type: "array",
              items: { type: "object", properties: { email: { type: "string" } }, required: ["email"] },
            },
          },
          required: ["calendarId", "summary", "start", "end"],
        },
      },
      {
        name: "update-event",
        description: "Update an existing calendar event",
        inputSchema: {
          type: "object",
          properties: {
            calendarId: { type: "string" },
            eventId: { type: "string" },
            summary: { type: "string" },
            description: { type: "string" },
            start: { type: "string" },
            end: { type: "string" },
            location: { type: "string" },
            attendees: {
              type: "array",
              items: { type: "object", properties: { email: { type: "string" } }, required: ["email"] },
            },
          },
          required: ["calendarId", "eventId"],
        },
      },
      {
        name: "delete-event",
        description: "Delete a calendar event",
        inputSchema: {
          type: "object",
          properties: {
            calendarId: { type: "string" },
            eventId: { type: "string" },
          },
          required: ["calendarId", "eventId"],
        },
      },
    ],
  };
});

// — Tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!(await tokenManager.validateTokens())) {
    const port = 3000;
    throw new Error(
      `Authentication required. Avvia l'auth locale e visita http://localhost:${port} per collegare Google Calendar.`
    );
  }

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  try {
    switch (name) {
      case "list-calendars": {
        const response = await calendar.calendarList.list();
        const calendars = response.data.items || [];
        return {
          content: [
            {
              type: "text",
              text: calendars.map((c: CalendarListEntry) => `${c.summary || "Untitled"} (${c.id || "no-id"})`).join("\n"),
            },
          ],
        };
      }

      case "list-events": {
        const valid = ListEventsArgumentsSchema.parse(args);
        const response = await calendar.events.list({
          calendarId: valid.calendarId,
          timeMin: valid.timeMin,
          timeMax: valid.timeMax,
          singleEvents: true,
          orderBy: "startTime",
        });
        const events = response.data.items || [];
        return {
          content: [
            {
              type: "text",
              text: events
                .map((e: CalendarEvent) => {
                  const loc = e.location ? `\nLocation: ${e.location}` : "";
                  const att =
                    e.attendees && e.attendees.length
                      ? `\nAttendees: ${e.attendees
                          .map((a) => `${a.email || "no-email"} (${a.responseStatus || "unknown"})`)
                          .join(", ")}`
                      : "";
                  return `${e.summary || "Untitled"} (${e.id || "no-id"})${loc}\nStart: ${
                    e.start?.dateTime || e.start?.date || "unspecified"
                  }\nEnd: ${e.end?.dateTime || e.end?.date || "unspecified"}${att}\n`;
                })
                .join("\n"),
            },
          ],
        };
      }

      case "create-event": {
        const valid = CreateEventArgumentsSchema.parse(args);
        const event = await calendar.events
          .insert({
            calendarId: valid.calendarId,
            requestBody: {
              summary: valid.summary,
              description: valid.description,
              start: { dateTime: valid.start },
              end: { dateTime: valid.end },
              attendees: valid.attendees,
              location: valid.location,
            },
          })
          .then((r) => r.data);

        return { content: [{ type: "text", text: `Event created: ${event.summary} (${event.id})` }] };
      }

      case "update-event": {
        const valid = UpdateEventArgumentsSchema.parse(args);
        const event = await calendar.events
          .patch({
            calendarId: valid.calendarId,
            eventId: valid.eventId,
            requestBody: {
              summary: valid.summary,
              description: valid.description,
              start: valid.start ? { dateTime: valid.start } : undefined,
              end: valid.end ? { dateTime: valid.end } : undefined,
              attendees: valid.attendees,
              location: valid.location,
            },
          })
          .then((r) => r.data);

        return { content: [{ type: "text", text: `Event updated: ${event.summary} (${event.id})` }] };
      }

      case "delete-event": {
        const valid = DeleteEventArgumentsSchema.parse(args);
        await calendar.events.delete({ calendarId: valid.calendarId, eventId: valid.eventId });
        return { content: [{ type: "text", text: "Event deleted successfully" }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    console.error("Error processing request:", err);
    throw err;
  }
});

async function main() {
  try {
    oauth2Client = await initializeOAuth2Client();
    tokenManager = new TokenManager(oauth2Client);
    authServer = new AuthServer(oauth2Client);

    // se manca un token valido, avvia il server di auth locale
    if (!(await tokenManager.loadSavedTokens())) {
      console.log("Nessun token valido trovato, avvio auth server...");
      const ok = await authServer.start();
      if (!ok) {
        console.error("Impossibile avviare l'auth server");
        process.exit(1);
      }
    }

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Google Calendar MCP Server running on stdio");

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  } catch (e) {
    console.error("Server startup failed:", e);
    process.exit(1);
  }
}

async function cleanup() {
  try {
    if (authServer) await authServer.stop();
    if (tokenManager) tokenManager.clearTokens();
  } finally {
    process.exit(0);
  }
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
