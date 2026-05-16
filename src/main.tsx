import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./index.css";
import { captureCallback } from "./lib/oauth";
import { useAppStore } from "./lib/store";

/**
 * Run the OAuth callback handler before React renders.
 *
 * On success, captureCallback restores the original ?user= to the URL.
 * We also push it into the Zustand store so the dashboard renders the
 * correct user immediately on first paint (instead of showing the welcome
 * screen for a tick before the URL listener fires).
 */
const callback = captureCallback();
if (callback.kind === "error") {
  (window as Window & { __codeflowAuthError?: string }).__codeflowAuthError =
    callback.message;
} else if (callback.kind === "authenticated" && callback.returnToUsername) {
  // Hydrate the store directly so the dashboard renders the right user
  // without waiting for the popstate listener.
  useAppStore.setState({ username: callback.returnToUsername });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
