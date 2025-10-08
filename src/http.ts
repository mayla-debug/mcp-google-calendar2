import createServer from "./index.js";
import { SseServerTransport } from "@modelcontextprotocol/sdk/server/transports/sse.js";

async function start() {
  const server = createServer();
  const port = Number(process.env.PORT) || 3000;

  const transport = new SseServerTransport({ port });
  await server.connect(transport);

  console.error(`[MCP] SSE server listening on :${port}`);
}

start().catch((err) => {
  console.error("[MCP] failed to start:", err);
  process.exit(1);
});
