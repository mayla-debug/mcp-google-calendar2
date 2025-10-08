server.tool(
  "ping",
  {
    description: "Health check (returns 'pong 🏓')",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
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
      additionalProperties: false
    }
  },
  async (args:any) => ({
    content: [{ type: "text", text: String(args?.text ?? "") }]
  })
);
