import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/transport/stdio";
import http from "http";

async function createServer() {
  const server = new Server({ name: "google-calendar-mcp", version: "1.0.0" }, { tools: [] });

  // Trasporto MCP su stdio (ok per strumenti), non disturba Smithery
  server.connect(new StdioServerTransport());

  // Health HTTP per l’Inspect di Smithery
  const port = Number(process.env.PORT || 3000);
  const health = http.createServer((_, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
  });
  health.listen(port, () => console.log(`Health on :${port}`));

  return server;
}

export default createServer;
