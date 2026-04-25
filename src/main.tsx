import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./index.css";

/**
 * One QueryClient for the whole app.
 * Defaults configured here apply to every useQuery() unless overridden:
 * - refetchOnWindowFocus: false → don't refetch every time the user tabs
 *   back to the dashboard (annoying for a portfolio app)
 * - retry: 1 → one retry by default (individual hooks override this)
 */
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
