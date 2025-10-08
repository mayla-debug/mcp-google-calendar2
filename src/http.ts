// src/http.ts
import createServer from "./index.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/transports/http.js";

async function start() {
  const server = createServer();
  const port = Number(process.env.PORT) || 3000;

  const transport = new HttpServerTransport({ port });
  await server.connect(transport);

  console.log(`[MCP] HTTP server listening on :${port}`);
}

start().catch((err) => {
  console.error("[MCP] failed to start:", err);
  process.exit(1);
});
