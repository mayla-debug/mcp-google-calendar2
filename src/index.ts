import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/transport/stdio";
import http from "node:http";

async function createServer() {
  const server = new Server(
    { name: "google-calendar-mcp", version: "1.0.0" },
    { tools: [] }
  );

  server.connect(new StdioServerTransport());

  const port = Number(process.env.PORT || 3000);
  const health = http.createServer((_, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
  });
  health.listen(port, () => {
    console.log(`Health on :${port}`);
  });

  return server;
}

export default createServer;
