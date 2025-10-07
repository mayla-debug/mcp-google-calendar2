import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// --- MCP server con un tool minimo (serve solo per far passare lo scan)
const mcp = new McpServer({ name: "google-calendar-mcp", version: "1.0.0" });

// Compatibilità registerTool/tool a seconda della versione dell'SDK
function registerToolCompat(s: any, name: string, def: any, handler: any) {
  const fn = (s as any).registerTool ?? (s as any).tool;
  return fn.call(s, name, def, handler);
}

registerToolCompat(
  mcp,
  "ping",
  {
    description: "Health check",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  async () => ({ content: [{ type: "text", text: "pong" }] })
);

// --- App HTTP (Express) con CORS aperto
const app = express();
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Endpoint MCP (lo scanner di Smithery manda qui le JSON-RPC)
app.all("/mcp", async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true
    });
    await mcp.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP /mcp error:", err);
    res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Error initializing server." }, id: null });
  }
});

// Probe
app.get("/", (_req, res) => res.type("text").send("ok"));

// Porta fornita da Smithery in container
const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`MCP HTTP listening on :${port}  (POST /mcp)`);
});
