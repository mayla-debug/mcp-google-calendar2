import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// istanzia il server una sola volta ed esportalo
export const server = new McpServer({
  name: "google-calendar-mcp",
  version: "1.0.3",
});

// ---- tools ----
server.tool(
  "ping",
  {
    description: "Health check (returns 'pong 🏓')",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  async () => {
    console.error("[MCP] ping invoked");
    return { content: [{ type: "text", text: "pong 🏓" }] };
  }
);

server.tool(
  "echo",
  {
    description: "Echo back the provided text",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
      additionalProperties: false,
    },
  },
  async (args: any) => {
    const text = typeof args?.text === "string" ? args.text : String(args?.text ?? "");
    console.error("[MCP] echo invoked with:", text);
    return { content: [{ type: "text", text }] };
  }
);

// export default opzionale (alcuni toolchain lo usano)
export default server;
