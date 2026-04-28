/**
 * OAuth callback endpoint — runs on Vercel as a serverless function.
 *
 * Flow:
 * 1. User clicks "Sign in with GitHub" in our app
 * 2. We redirect them to github.com/login/oauth/authorize?client_id=...&state=...
 * 3. They approve → GitHub redirects them back to:
 *    https://our-app.vercel.app/api/auth/callback?code=XYZ&state=ABC
 * 4. THIS FUNCTION runs. It uses our CLIENT_SECRET (server-side only) to
 *    exchange the temporary `code` for a real access token.
 * 5. We redirect the user back to the app with the token in the URL hash
 *    (hashes are not sent to servers, so the token never leaves the browser
 *    after this point).
 *
 * The CSRF `state` check happens on the client side because that's where
 * the original state was generated. We forward it back unchanged.
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
  // Only GET — this endpoint is hit via redirect, not POST
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, state, error: oauthError } = req.query;

  // GitHub passes ?error= when the user denies permission
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
    // Exchange the temporary code for a real access token.
    // This is the ONE call where we need our client secret — it never leaves
    // this serverless function.
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

    /**
     * Redirect back to the app with the token in the URL hash (#).
     *
     * Why hash instead of query string:
     * - Hashes are NOT sent to servers, only the browser sees them
     * - Server logs / proxies / referrer headers won't capture the token
     * - The frontend reads it via window.location.hash and immediately
     *   strips it from the URL with history.replaceState
     *
     * `state` is forwarded so the frontend can verify it matches what it
     * originally generated (CSRF protection).
     */
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
