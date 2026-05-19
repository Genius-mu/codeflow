import { useState, useMemo } from "react";
import { Users, ExternalLink, ChevronDown } from "lucide-react";
import type { GitHubFollower } from "../lib/schemas";
import { useAppStore } from "../lib/store";
import { formatCompact } from "../lib/utils";

interface FollowersGridProps {
  followers: GitHubFollower[];
  /** Total followers per the user profile — used to show "+N more" */
  totalCount: number;
  loading?: boolean;
}

const INITIAL_VISIBLE = 24; // 4 rows on desktop (6 wide)

export function FollowersGrid({
  followers,
  totalCount,
  loading = false,
}: FollowersGridProps) {
  const setUsername = useAppStore((s) => s.setUsername);
  const [expanded, setExpanded] = useState(false);

  const visible = useMemo(
    () => (expanded ? followers : followers.slice(0, INITIAL_VISIBLE)),
    [followers, expanded],
  );

  const hiddenCount = followers.length - INITIAL_VISIBLE;
  const beyondFetchedCount = Math.max(0, totalCount - followers.length);

  if (loading) {
    return <FollowersGridSkeleton />;
  }

  if (followers.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-text-muted font-mono">
        No followers yet
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2 sm:gap-3">
        {visible.map((follower) => (
          <FollowerTile
            key={follower.id}
            follower={follower}
            onClick={() => setUsername(follower.login)}
          />
        ))}
      </div>

      {(hiddenCount > 0 || beyondFetchedCount > 0) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {hiddenCount > 0 && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="
                inline-flex items-center gap-1.5
                px-4 py-2 rounded-lg
                bg-bg-elevated border border-bg-border text-text-secondary
                text-xs font-mono font-medium
                transition-all duration-200
                hover:text-accent hover:border-accent/40 hover:bg-accent/5
                active:scale-95
              "
            >
              <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.25} />
              Show {hiddenCount} more
            </button>
          )}

          {beyondFetchedCount > 0 && (
            <span className="text-xs font-mono text-text-muted">
              + {formatCompact(beyondFetchedCount)} more on GitHub
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Individual avatar tile. Click → jump to that user's dashboard via the
 * Zustand store. Hover → reveals username pill below the avatar.
 *
 * The tile is a button (not a link) because we don't want a full navigation —
 * just a state update that triggers the existing data layer for the new user.
 */
function FollowerTile({
  follower,
  onClick,
}: {
  follower: GitHubFollower;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative aspect-square"
      aria-label={`View ${follower.login}'s dashboard`}
      title={follower.login}
    >
      <img
        src={follower.avatar_url}
        alt=""
        loading="lazy"
        className="
          w-full h-full rounded-lg
          ring-1 ring-bg-border
          transition-all duration-200 ease-out
          group-hover:ring-2 group-hover:ring-accent/60
          group-hover:scale-110 group-hover:z-10
          group-hover:shadow-[0_0_20px_var(--accent-glow-medium)]
          group-active:scale-100
          relative
        "
      />
      {/* Subtle external-link icon top-right on hover, hints at "you can click" */}
      <ExternalLink
        className="
          absolute top-1 right-1 w-3 h-3
          text-bg-base bg-accent rounded-sm p-0.5
          opacity-0 group-hover:opacity-100
          transition-opacity duration-200
          pointer-events-none
        "
        strokeWidth={3}
      />
      {/* Username tooltip on hover */}
      <span
        className="
          absolute left-1/2 -translate-x-1/2 top-full mt-1.5
          px-2 py-0.5 rounded-md
          glass text-[10px] font-mono text-text-primary
          whitespace-nowrap
          opacity-0 group-hover:opacity-100
          transition-opacity duration-200
          pointer-events-none z-20
        "
      >
        @{follower.login}
      </span>
    </button>
  );
}

function FollowersGridSkeleton() {
  return (
    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2 sm:gap-3">
      {Array.from({ length: INITIAL_VISIBLE }).map((_, i) => (
        <div
          key={i}
          className="aspect-square rounded-lg bg-bg-elevated relative overflow-hidden"
        >
          <div
            className="
              absolute inset-0 -translate-x-full animate-shimmer
              bg-gradient-to-r from-transparent via-bg-border to-transparent
              bg-[length:1000px_100%]
            "
            style={{ animationDelay: `${i * 25}ms` }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Section header — exported so it can sit outside the grid if needed.
 * Renders the icon, title, and count consistent with other dashboard sections.
 */
export function FollowersSectionHeader({ totalCount }: { totalCount: number }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
      <div>
        <h3 className="font-display font-semibold text-base sm:text-lg text-text-primary tracking-tight flex items-center gap-2">
          <Users className="w-4 h-4 text-accent" strokeWidth={2.25} />
          Followers
        </h3>
        <p className="mt-0.5 text-xs text-text-muted">
          {totalCount === 0
            ? "No followers yet"
            : `${formatCompact(totalCount)} ${totalCount === 1 ? "person follows" : "people follow"} this user`}
        </p>
      </div>
    </div>
  );
}
