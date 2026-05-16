import { useEffect, useRef, useState } from "react";
import { LogIn, LogOut, ExternalLink } from "lucide-react";
import { useAuthStore } from "../lib/auth";

export function AuthControls() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isOAuthConfigured = useAuthStore((s) => s.isOAuthConfigured);
  const signIn = useAuthStore((s) => s.signIn);

  // Hide the entire control if OAuth isn't configured (e.g. someone running
  // the project locally without setting up their own OAuth app).
  if (!isOAuthConfigured) return null;

  if (!isAuthenticated) {
    return (
      <button
        type="button"
        onClick={signIn}
        aria-label="Sign in with GitHub"
        className="
          shrink-0 inline-flex items-center gap-1.5
          h-9 px-3 rounded-lg
          bg-bg-surface border border-bg-border text-text-secondary
          text-xs font-mono font-medium
          transition-all duration-200
          hover:text-accent hover:border-accent/40 hover:bg-accent/5
          active:scale-95
          focus:outline-none focus:ring-2 focus:ring-accent/40
        "
      >
        <LogIn className="w-3.5 h-3.5" strokeWidth={2.25} />
        <span className="hidden sm:inline">Sign in</span>
      </button>
    );
  }

  return <SignedInPill />;
}

/**
 * The signed-in pill: avatar + @login + dropdown.
 * Click anywhere on the pill to open the menu; clicking outside or pressing
 * Escape closes it.
 */
function SignedInPill() {
  const user = useAuthStore((s) => s.signedInUser);
  const isLoadingUser = useAuthStore((s) => s.isLoadingUser);
  const signOut = useAuthStore((s) => s.signOut);

  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on click-outside or Escape
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  // Loading state — show a placeholder pill instead of empty space
  if (isLoadingUser || !user) {
    return (
      <div
        className="
          shrink-0 flex items-center gap-2
          h-9 pl-1 pr-3 rounded-lg
          bg-bg-surface border border-bg-border
        "
      >
        <div className="w-7 h-7 rounded-md bg-bg-elevated animate-pulse" />
        <div className="hidden sm:block w-16 h-3 rounded bg-bg-elevated animate-pulse" />
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Signed in as ${user.login}. Open account menu.`}
        className="
          flex items-center gap-2
          h-9 pl-1 pr-2 sm:pr-3 rounded-lg
          bg-bg-surface border border-bg-border text-text-primary
          transition-all duration-200
          hover:border-accent/40 hover:bg-accent/5
          active:scale-95
          focus:outline-none focus:ring-2 focus:ring-accent/40
        "
      >
        <img
          src={user.avatar_url}
          alt=""
          className="w-7 h-7 rounded-md ring-1 ring-bg-border"
          loading="lazy"
        />
        <span className="hidden sm:inline font-mono text-xs font-medium">
          @{user.login}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="
            absolute right-0 top-full mt-2 z-40
            w-56 p-1.5
            glass rounded-lg shadow-2xl
            animate-fade-in
          "
        >
          {/* User block */}
          <div className="px-2.5 py-2 border-b border-bg-border mb-1">
            <p className="text-sm font-medium text-text-primary truncate">
              {user.name ?? user.login}
            </p>
            <p className="text-xs font-mono text-text-muted truncate">
              @{user.login}
            </p>
          </div>

          <a
            href={user.html_url}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            className="
              flex items-center gap-2
              w-full px-2.5 py-2 rounded-md
              text-xs font-mono text-text-secondary
              transition-colors duration-150
              hover:text-text-primary hover:bg-bg-elevated
            "
          >
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={2.25} />
            View on GitHub
          </a>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            role="menuitem"
            className="
              flex items-center gap-2 w-full
              px-2.5 py-2 rounded-md
              text-xs font-mono text-text-secondary
              transition-colors duration-150
              hover:text-red-400 hover:bg-red-500/5
              text-left
            "
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={2.25} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
