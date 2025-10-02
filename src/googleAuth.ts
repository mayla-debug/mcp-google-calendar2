// src/googleAuth.ts
import { google } from "googleapis";

export async function getOAuthClient() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const refresh = process.env.GOOGLE_REFRESH_TOKEN;
  const redirect =
    process.env.GOOGLE_REDIRECT_URI ||
    "https://developers.google.com/oauthplayground";

  if (!id || !secret || !refresh) {
    throw new Error(
      "Google OAuth non configurato: mancano GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN"
    );
  }

  const oAuth2 = new google.auth.OAuth2(id, secret, redirect);
  oAuth2.setCredentials({ refresh_token: refresh });
  return oAuth2;
}
