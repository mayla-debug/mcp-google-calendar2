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
import { BASE_DIR, rel } from "./paths.js"; // ⬅️ nuovo

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

// ---------------- Zod Schemas ----------------
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

// ---------------- MCP Server ----------------
const server = new Server(
  { name: "google-calendar", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ---------------- OAuth2 helper ----------------
async function initializeOAuth2Client() {
  // 1) prova con variabili d’ambiente
  const envId = process.env.GOOGLE_CLIENT_ID;
  const envSecret = process.env.GOOGLE_CLIENT_SECRET;
  const envRedirect =
    process.env.GOOGLE_REDIRECT_URI ||
    "https://developers.google.com/oauthplayground";

  if (envId && envSecret) {
    return new OAuth2Client({
      clientId: envId,
      clientSecret: envSecret,
      redirectUri: envRedirect,
    });
  }

  // 2) fallback a file di chiavi
  try {
    const keysContent = await fs.readFile(getKeysFilePath(), "utf-8");
    const keys = JSON.parse(keysContent);
    const { client_id, client_secret, redirect_uris } = keys.installed;

    return new OAuth2Client({
      clientId: client_id,
      clientSecret: client_secret,
      redirectUri: redirect_uris[0],
    });
  } catch (error) {
    console.error("Error loading OAuth keys:", error);
    throw error;
  }
}

let oauth2Client: OAuth2Client;
let tokenManager: TokenManager;
let authServer: AuthServer;

// -------- secure token path (niente import.meta) --------
function getSecureTokenPath(): string {
  return rel("../.gcp-saved-tokens.json");
}

// -------- path chiavi (niente import.meta) ---------------
function getKeysFilePath(): string {
  return rel("../gcp-oauth.keys.json");
}

// -------- caricamento/refresh token su file --------------
async function loadSavedTokens(): Promise<boolean> {
  try {
    const tokenPath = getSecureTokenPath();

    // se esiste un refresh token in env, salviamolo per sbloccare subito il flusso
    if (process.env.GOOGLE_REFRESH_TOKEN) {
      const bootstrap = { refresh_token: process.env.GOOGLE_REFRESH_TOKEN };
      await fs.writeFile(tokenPath, JSON.stringify(bootstrap, null, 2), {
        mode: 0o600,
      }).catch(() => {});
    }

    const exists = await fs.access(tokenPath).then(() => true).catch(() => false);
    if (!exists) {
      console.error("No token file found");
      return false;
    }

    const tokens = JSON.parse(await fs.readFile(tokenPath, "utf-8"));
    if (!tokens || typeof tokens !== "object") {
      console.error("Invalid token format");
      return false;
    }

    oauth2Client.setCredentials(tokens);

    const expiryDate = (tokens as any).expiry_date;
    const isExpired = expiryDate
      ? Date.now() >= expiryDate - 5 * 60 * 1000
      : true;

    if (isExpired && (tokens as any).refresh_token) {
      try {
        const response = await oauth2Client.refreshAccessToken();
        const newTokens = response.credentials;
        if (!newTokens.access_token) {
          throw new Error("Received invalid tokens during refresh");
        }
        await fs.writeFile(tokenPath, JSON.stringify(newTokens, null, 2), {
          mode: 0o600,
        });
        oauth2Client.setCredentials(newTokens);
      } catch (refreshError) {
        console.error("Error refreshing auth token:", refreshError);
        return false;
      }
    }

    // persiste eventuali update
    oauth2Client.on("tokens", async (newTokens) => {
      try {
        const currentTokens = JSON.parse(await fs.readFile(tokenPath, "utf-8"));
        const updatedTokens = {
          ...currentTokens,
          ...newTokens,
          refresh_token:
            (newTokens as any).refresh_token ||
            (currentTokens as any).refresh_token,
        };
        await fs.writeFile(tokenPath, JSON.stringify(updatedTokens, null, 2), {
          mode: 0o600,
        });
      } catch (error) {
        console.error("Error saving updated tokens:", error);
      }
    });

    return true;
  } catch (error) {
    console.error("Error loading tokens:", error);
    return false;
  }
}

// ---------------- Tools list ----------------
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
            calendarId: {
              type: "string",
              description: "ID of the calendar to list events from",
            },
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
  };
});

// ---------------- CallTool handler ----------------
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Autenticazione prima di qualsiasi tool
  if (!(await tokenManager.validateTokens())) {
    const port = authServer ? 3000 : null;
    const authMessage = port
      ? `Authentication required. Please visit http://localhost:${port} to authenticate with Google Calendar. If this port is unavailable, the server will try ports 3001-3004.`
      : 'Authentication required. Please run "npm run auth" to authenticate with Google Calendar.';
    throw new Error(authMessage);
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
              text: calendars
                .map(
                  (cal: CalendarListEntry) =>
                    `${cal.summary || "Untitled"} (${cal.id || "no-id"})`
                )
                .join("\n"),
            },
          ],
        };
      }

      case "list-events": {
        const validArgs = ListEventsArgumentsSchema.parse(args);
        const response = await calendar.events.list({
          calendarId: validArgs.calendarId,
          timeMin: validArgs.timeMin,
          timeMax: validArgs.timeMax,
          singleEvents: true,
          orderBy: "startTime",
        });

        const events = response.data.items || [];
        return {
          content: [
            {
              type: "text",
              text: events
                .map((event: CalendarEvent) => {
                  const attendeeList = event.attendees
                    ? `\nAttendees: ${event.attendees
                        .map(
                          (a: CalendarEventAttendee) =>
                            `${a.email || "no-email"} (${
                              a.responseStatus || "unknown"
                            })`
                        )
                        .join(", ")}`
                    : "";
                  const locationInfo = event.location
                    ? `\nLocation: ${event.location}`
                    : "";
                  return `${event.summary || "Untitled"} (${
                    event.id || "no-id"
                  })${locationInfo}\nStart: ${
                    event.start?.dateTime ||
                    event.start?.date ||
                    "unspecified"
                  }\nEnd: ${
                    event.end?.dateTime || event.end?.date || "unspecified"
                  }${attendeeList}\n`;
                })
                .join("\n"),
            },
          ],
        };
      }

      case "create-event": {
        const validArgs = CreateEventArgumentsSchema.parse(args);
        const event = await calendar.events
          .insert({
            calendarId: validArgs.calendarId,
            requestBody: {
              summary: validArgs.summary,
              description: validArgs.description,
              start: { dateTime: validArgs.start },
              end: { dateTime: validArgs.end },
              attendees: validArgs.attendees,
              location: validArgs.location,
            },
          })
          .then((r) => r.data);

        return {
          content: [
            {
              type: "text",
              text: `Event created: ${event.summary} (${event.id})`,
            },
          ],
        };
      }

      case "update-event": {
        const validArgs = UpdateEventArgumentsSchema.parse(args);
        const event = await calendar.events
          .patch({
            calendarId: validArgs.calendarId,
            eventId: validArgs.eventId,
            requestBody: {
              summary: validArgs.summary,
              description: validArgs.description,
              start: validArgs.start ? { dateTime: validArgs.start } : undefined,
              end: validArgs.end ? { dateTime: validArgs.end } : undefined,
              attendees: validArgs.attendees,
              location: validArgs.location,
            },
          })
          .then((r) => r.data);

        return {
          content: [
            {
              type: "text",
              text: `Event updated: ${event.summary} (${event.id})`,
            },
          ],
        };
      }

      case "delete-event": {
        const validArgs = DeleteEventArgumentsSchema.parse(args);
        await calendar.events.delete({
          calendarId: validArgs.calendarId,
          eventId: validArgs.eventId,
        });

        return { content: [{ type: "text", text: `Event deleted successfully` }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error("Error processing request:", error);
    throw error;
  }
});

// ---------------- main ----------------
async function main() {
  try {
    oauth2Client = await initializeOAuth2Client();
    tokenManager = new TokenManager(oauth2Client);
    authServer = new AuthServer(oauth2Client);

    // Carica token (se manca tenta bootstrap da env)
    if (!(await loadSavedTokens())) {
      console.log("No valid tokens found, starting auth server...");
      const success = await authServer.start();
      if (!success) {
        console.error("Failed to start auth server");
        process.exit(1);
      }
    }

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Google Calendar MCP Server running on stdio");

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
}

async function cleanup() {
  console.log("Cleaning up...");
  if (authServer) await authServer.stop();
  if (tokenManager) tokenManager.clearTokens();
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
