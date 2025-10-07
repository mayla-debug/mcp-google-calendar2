import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const server = new McpServer({ name: "google-calendar-mcp", version: "1.0.0" });

const app = express();
app.use(express.json({ limit: "5mb" }));

app.all("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: true
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/", (_req, res) => res.type("text").send("ok"));

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`MCP HTTP online: http://localhost:${port}/mcp`));
