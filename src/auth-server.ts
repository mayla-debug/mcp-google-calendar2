import * as fs from "fs/promises";
import * as path from "path";
import express from "express";
import { OAuth2Client } from "google-auth-library";
import { TokenManager } from "./token-manager.js";
import open from "open";
import { rel } from "./paths.js";

export class AuthServer {
  private server: express.Application | null = null;
  private httpServer: any = null;
  private tokenManager: TokenManager;
  private port: number;
  private credentials: { client_id: string; client_secret: string } | null = null;

  constructor(private oauth2Client: OAuth2Client) {
    this.tokenManager = new TokenManager(oauth2Client);
    this.port = 3000; // porta di default
  }

  private getKeysFilePath(): string {
    // prova prima da env, poi dal file locale
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      return ""; // segnala che useremo le env vars
    }
    return rel("gcp-oauth.keys.json");
  }

  private async loadCredentials(): Promise<void> {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      this.credentials = {
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      };
      return;
    }
    const p = this.getKeysFilePath();
    const content = await fs.readFile(p, "utf-8");
    const keys = JSON.parse(content);
    this.credentials = {
      client_id: keys.installed.client_id,
      client_secret: keys.installed.client_secret,
    };
  }

  private createOAuthClient(port: number): OAuth2Client {
    if (!this.credentials) throw new Error("Credentials not loaded");
    return new OAuth2Client(
      this.credentials.client_id,
      this.credentials.client_secret,
      `http://localhost:${port}/oauth2callback`
    );
  }

  private async startServer(): Promise<boolean> {
    // tenta 3000, poi 3001
    const ports = [3000, 3001];

    for (const port of ports) {
      this.port = port;
      try {
        // crea il client con la porta corrente
        this.oauth2Client = this.createOAuthClient(port);

        this.server = express();

        // callback OAuth
        this.server.get("/oauth2callback", async (req, res) => {
          try {
            const code = req.query.code as string;
            if (!code) throw new Error("No code received");

            const { tokens } = await this.oauth2Client.getToken(code);
            await this.tokenManager.saveTokens(tokens);

            res.send("Autenticazione riuscita! Puoi chiudere questa finestra.");
            await this.stop();
            return true;
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Unknown error";
            console.error("Error in OAuth callback:", msg);
            res.status(500).send("Autenticazione fallita. Riprova.");
            await this.stop();
            return false;
          }
        });

        const serverStarted = await new Promise<boolean>((resolve) => {
          if (!this.server) return resolve(false);

          this.httpServer = this.server.listen(port, () => {
            console.log(`Auth server in ascolto su http://localhost:${port}`);
            resolve(true);
          });

          this.httpServer.on("error", (error: any) => {
            if (error.code === "EADDRINUSE") {
              console.log(`Porta ${port} occupata, provo la successiva...`);
              resolve(false);
            } else {
              console.error("Server error:", error);
              resolve(false);
            }
          });
        });

        if (serverStarted) return true;
      } catch (error) {
        console.error(`Errore avvio server sulla porta ${port}:`, error);
      }
    }

    console.error("Impossibile avviare l'auth server su 3000/3001");
    return false;
  }

  public async start(): Promise<boolean> {
    console.log("Avvio auth server...");
    try {
      const tokens = await this.tokenManager.loadSavedTokens();
      if (tokens) {
        console.log("Token validi trovati: niente auth interattiva necessaria");
        return true;
      }
    } catch (e) {
      // continua con il flow di auth
    }

    try {
      await this.loadCredentials();

      const serverStarted = await this.startServer();
      if (!serverStarted) {
        console.error("Auth server non avviato");
        return false;
      }

      const authorizeUrl = this.oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: ["https://www.googleapis.com/auth/calendar"],
        // redirect_uri è già impostato nel costruttore dell'OAuth2Client
      });

      console.log(`Apro il browser per l'autenticazione su porta ${this.port}...`);
      await open(authorizeUrl);

      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("Autenticazione fallita:", msg);
      await this.stop();
      return false;
    }
  }

  public async stop(): Promise<void> {
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer.close(() => {
          console.log("Auth server fermato");
          this.server = null;
          this.httpServer = null;
          resolve();
        });
      });
    }
  }
}

// Avvio standalone quando il file è eseguito direttamente (bundle CJS)
declare const require: any, module: any;
if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  const oauth2Client = new OAuth2Client();
  const authServer = new AuthServer(oauth2Client);
  authServer.start().catch(console.error);
}
