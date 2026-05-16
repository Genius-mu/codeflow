/**
 * OAuth callback endpoint — runs on Vercel as a serverless function.
 *
 * Flow:
 * 1. User clicks "Sign in with GitHub" in our app
 * 2. We redirect them to github.com/login/oauth/authorize?...&state=encoded
 * 3. They approve → GitHub redirects to /api/auth/callback?code=XYZ&state=encoded
 * 4. We exchange the code for a token using our CLIENT_SECRET (server-only)
 * 5. We redirect to /#access_token=...&state=encoded
 *    (state forwarded unchanged — frontend decodes it for nonce + return-to)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

interface GitHubTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res.redirect(
      302,
      `/?oauth_error=${encodeURIComponent(String(oauthError))}`,
    );
  }

  if (typeof code !== "string" || typeof state !== "string") {
    return res.redirect(302, "/?oauth_error=missing_params");
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET env vars");
    return res.redirect(302, "/?oauth_error=server_misconfigured");
  }

  try {
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      },
    );

    if (!tokenRes.ok) {
      console.error("Token exchange failed:", tokenRes.status);
      return res.redirect(302, "/?oauth_error=exchange_failed");
    }

    const data = (await tokenRes.json()) as GitHubTokenResponse;

    if (data.error || !data.access_token) {
      console.error(
        "GitHub returned error:",
        data.error,
        data.error_description,
      );
      return res.redirect(
        302,
        `/?oauth_error=${encodeURIComponent(data.error ?? "no_token")}`,
      );
    }

    // Forward state UNCHANGED — frontend decodes it for nonce + return-to
    const params = new URLSearchParams({
      access_token: data.access_token,
      state,
    });

    return res.redirect(302, `/#${params.toString()}`);
  } catch (err) {
    console.error("OAuth callback error:", err);
    return res.redirect(302, "/?oauth_error=server_error");
  }
}
