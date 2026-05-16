/**
 * Client-side OAuth flow for GitHub.
 *
 * Three jobs:
 * 1. Redirect the user to GitHub's authorize page with a CSRF state
 * 2. After they return via /api/auth/callback, parse the token from the URL hash
 * 3. Store the token in localStorage so it survives reloads
 *
 * The `state` parameter does double duty:
 * - CSRF protection (random nonce that must match)
 * - Carrier for the page state we want to return to (current `?user=`)
 *
 * We encode it as JSON in the state value and decode on the way back.
 */

const STATE_KEY = "codeflow-oauth-state";
const TOKEN_KEY = "codeflow-oauth-token";

const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined;

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Encode a CSRF nonce and current return-to params as a single state string.
 * Format: base64url(JSON({ n: nonce, u: username }))
 *
 * Why JSON in base64: GitHub allows arbitrary state, but we want to keep it
 * URL-safe and round-trip cleanly through redirects.
 */
function encodeState(nonce: string, username: string | null): string {
  const payload = JSON.stringify({ n: nonce, u: username ?? "" });
  return btoa(payload)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

interface DecodedState {
  nonce: string;
  username: string;
}

function decodeState(encoded: string): DecodedState | null {
  try {
    // Re-pad base64 if needed
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded + "===".slice((padded.length + 3) % 4));
    const parsed = JSON.parse(json);
    if (typeof parsed?.n !== "string") return null;
    return {
      nonce: parsed.n,
      username: typeof parsed.u === "string" ? parsed.u : "",
    };
  } catch {
    return null;
  }
}

export function isOAuthConfigured(): boolean {
  return Boolean(CLIENT_ID);
}

export function getStoredToken(): string | null {
  return (
    localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem("github_token")
  );
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("github_token");
}

/**
 * Begin the OAuth dance.
 * Captures the current ?user= so we can restore it after the round trip.
 */
export function startSignIn(): void {
  if (!CLIENT_ID) {
    console.error("VITE_GITHUB_CLIENT_ID not set");
    return;
  }

  // Read current ?user= so we can restore it after sign-in
  const currentUsername = new URLSearchParams(window.location.search).get(
    "user",
  );

  const nonce = generateNonce();
  const state = encodeState(nonce, currentUsername);

  // Store ONLY the nonce — we'll compare the decoded nonce on return
  sessionStorage.setItem(STATE_KEY, nonce);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    state,
    scope: "read:user",
    redirect_uri: `${window.location.origin}/api/auth/callback`,
  });

  window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export type CallbackResult =
  | { kind: "authenticated"; returnToUsername: string }
  | { kind: "error"; message: string }
  | { kind: "no-callback" };

let callbackHandled = false;

/**
 * Run on every app load. If we just came back from GitHub, captures the token
 * and tells the caller what username to restore in the URL.
 */
export function captureCallback(): CallbackResult {
  if (callbackHandled) return { kind: "no-callback" };

  // 1. ?oauth_error=... from our backend
  const queryParams = new URLSearchParams(window.location.search);
  const errorParam = queryParams.get("oauth_error");
  if (errorParam) {
    callbackHandled = true;
    cleanQueryParam("oauth_error");
    return { kind: "error", message: humanizeError(errorParam) };
  }

  // 2. Hash-based token redirect
  if (!window.location.hash || window.location.hash.length < 2) {
    return { kind: "no-callback" };
  }

  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const token = hashParams.get("access_token");
  const returnedState = hashParams.get("state");

  if (!token || !returnedState) {
    return { kind: "no-callback" };
  }

  callbackHandled = true;

  // Decode the state — it carries both the nonce and the username to restore
  const decoded = decodeState(returnedState);
  const storedNonce = sessionStorage.getItem(STATE_KEY);

  if (!decoded || !storedNonce || decoded.nonce !== storedNonce) {
    history.replaceState(
      {},
      "",
      window.location.pathname + window.location.search,
    );
    sessionStorage.removeItem(STATE_KEY);
    return {
      kind: "error",
      message: "Sign-in failed: state mismatch. Please try again.",
    };
  }

  // Success: store token, clean up, return the username to restore
  setStoredToken(token);
  sessionStorage.removeItem(STATE_KEY);

  // Rebuild URL with the original ?user= preserved (drop the hash)
  const url = new URL(window.location.href);
  url.hash = "";
  if (decoded.username) {
    url.searchParams.set("user", decoded.username);
  }
  history.replaceState({}, "", url.toString());

  return { kind: "authenticated", returnToUsername: decoded.username };
}

function cleanQueryParam(key: string): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(key);
  history.replaceState({}, "", url.toString());
}

function humanizeError(code: string): string {
  switch (code) {
    case "access_denied":
      return "Sign-in cancelled.";
    case "missing_params":
      return "Sign-in failed: missing parameters.";
    case "exchange_failed":
      return "Sign-in failed: GitHub didn't return a token.";
    case "server_misconfigured":
      return "Sign-in unavailable: server is missing OAuth credentials.";
    case "server_error":
      return "Sign-in failed: server error. Try again.";
    default:
      return `Sign-in failed: ${code}`;
  }
}
