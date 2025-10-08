import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/transport/http.js";

const server = new Server(
  { name: "mcp-google-calendar2", version: "1.0.0" },
  { capabilities: {} }
);

server.tool(
  {
    name: "ping",
    description: "Health check",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  async () => {
    return { content: [{ type: "text", text: "pong" }] };
  }
);

// (opzionale) registra tool Google Calendar solo se le ENV ci sono
const hasGcalEnv =
  !!process.env.GOOGLE_CLIENT_ID &&
  !!process.env.GOOGLE_CLIENT_SECRET &&
  !!process.env.CALENDAR_ID;

if (!hasGcalEnv) {
  console.warn("GCAL env mancanti → registro solo 'ping'.");
  // qui puoi uscire o proseguire con solo ping
} else {
  // TODO: registra i tool gcal
}

const port = Number(process.env.PORT || 0); // "0" = porta effimera gestita dall'host
const transport = new HttpServerTransport({ port, stream: true });

await server.connect(transport);
console.log("MCP HTTP server ready on port", transport.port);
