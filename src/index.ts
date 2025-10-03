import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as fs from "fs/promises";
import * as path from "path";
import { z } from "zod";
import { TokenManager } from "./token-manager.js";

/* ---------- Tipi utili ---------- */
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

/* ---------- Schemi Zod ---------- */
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

/* ---------- MCP Server ---------- */
const mcp = new Server(
  { name: "google-calendar", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

/* ---------- OAuth helper (solo ENV in hosted) ---------- */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function buildOAuthClientFromEnv(): Promise<OAuth2Client> {
  const client = new OAuth2Client({
    clientId: requireEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
    redirectUri: process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth2callback",
  });

  const refresh = process.env.GOOGLE_REFRESH_TOKEN;
  if (refresh) client.setCredentials({ refresh_token: refresh });

  return client;
}

let oauth2Client: OAuth2Client;
let tokenManager: TokenManager;

/* ---------- Tools list ---------- */
mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
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
            items: {
              type: "object",
              properties: { email: { type: "string" } },
              required: ["email"],
            },
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
            items: {
              type: "object",
              properties: { email: { type: "string" } },
              required: ["email"],
            },
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
}));

/* ---------- Tool calls ---------- */
mcp.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // In hosted richiediamo token già presenti (via ENV); niente auth interattiva
  if (!(await tokenManager.validateTokens())) {
    throw new Error(
      "Authentication required: assicurati di aver impostato GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REFRESH_TOKEN nelle variabili d'ambiente del deployment."
    );
  }

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  switch (name) {
    case "list-calendars": {
      const response = await calendar.calendarList.list();
      const calendars = response.data.items || [];
      return {
        content: [
          {
            type: "text",
            text: calendars
              .map((c: CalendarListEntry) => `${c.summary || "Untitled"} (${c.id || "no-id"})`)
              .join("\n"),
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
});

/* ------------------------------------------------------------------ */
/* DEFAULT EXPORT per Smithery: restituisce una Express app (HTTP MCP) */
/* ------------------------------------------------------------------ */
export default async function (_opts: { sessionId?: string; config?: Record<string, any> }) {
  // OAuth via ENV
  oauth2Client = await buildOAuthClientFromEnv();
  tokenManager = new TokenManager(oauth2Client);

  const app = express();

  // monta MCP su HTTP
  const transport = new HttpServerTransport({ app, path: "/" }); // Smithery aggiunge CORS
  await mcp.connect(transport);

  // rotta di health opzionale
  app.get("/health", (_req, res) => res.status(200).send("ok"));

  return app; // <- ciò che Smithery si aspetta dal default export
}
