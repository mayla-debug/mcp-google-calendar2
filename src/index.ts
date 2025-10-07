// src/index.ts (ESM + NodeNext)
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// Crea MCP server (senza tool per ora; li aggiungiamo dopo)
const server = new McpServer({
  name: "google-calendar-mcp",
  version: "1.0.0",
});

const app = express();
app.use(express.json());

// Endpoint MCP (Streamable HTTP). Smithery chiamerà questo.
app.all("/mcp", async (req, res) => {
  // un transport per richiesta (evita collisioni di ID)
  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true,
  });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// Health probe per l’Inspect
app.get("/", (_req, res) => res.type("text").send("ok"));

const port = parseInt(process.env.PORT ?? "3000", 10);
app.listen(port, () => {
  console.log(`MCP HTTP online: http://localhost:${port}/mcp`);
});
