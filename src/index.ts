import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/transport/stdio";
import http from "http";

async function createServer() {
  const server = new Server({ name: "google-calendar-mcp", version: "1.0.0" }, { tools: [] });
  server.connect(new StdioServerTransport());

  const port = Number(process.env.PORT || 3000);
  http.createServer((_, res) => { res.writeHead(200); res.end("ok"); })
      .listen(port, () => console.log(`Health on :${port}`));

  return server;
}
export default createServer;
