import { create } from "zustand";
import axios from "axios";
import {
  getStoredToken,
  clearStoredToken,
  startSignIn,
  isOAuthConfigured,
} from "./oauth";
import { GitHubUserSchema, type GitHubUser } from "./schemas";

interface AuthState {
  token: string | null;
  signedInUser: GitHubUser | null;
  isLoadingUser: boolean;
  isAuthenticated: boolean;
  isOAuthConfigured: boolean;

  signIn: () => void;
  signOut: () => void;

  /** Fetch the signed-in user's profile and cache it on the store. */
  loadSignedInUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: getStoredToken(),
  signedInUser: null,
  isLoadingUser: false,
  // Plain boolean derived once at construction. Kept in sync via signIn/signOut
  // calls below — Zustand's `set` will update it whenever the token changes.
  isAuthenticated: Boolean(getStoredToken()),
  isOAuthConfigured: isOAuthConfigured(),

  signIn: () => startSignIn(),

  signOut: () => {
    clearStoredToken();
    set({ token: null, signedInUser: null, isAuthenticated: false });
  },

  loadSignedInUser: async () => {
    const token = get().token;
    if (!token || get().signedInUser || get().isLoadingUser) return;

    set({ isLoadingUser: true });
    try {
      const { data } = await axios.get("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user = GitHubUserSchema.parse(data);
      set({ signedInUser: user, isLoadingUser: false });
    } catch (err) {
      // Token might be expired/revoked. Sign out cleanly.
      console.warn("Failed to load signed-in user, signing out:", err);
      clearStoredToken();
      set({
        token: null,
        signedInUser: null,
        isAuthenticated: false,
        isLoadingUser: false,
      });
    }
  },
}));

/**
 * One-time bootstrap: if we have a token in storage, fetch the user profile.
 * Runs on module import so the header can show the signed-in pill from
 * first paint instead of flickering.
 */
if (typeof window !== "undefined" && getStoredToken()) {
  // Fire and forget — store handles errors
  void useAuthStore.getState().loadSignedInUser();
}
