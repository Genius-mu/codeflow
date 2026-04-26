import { type ReactNode } from "react";
import { AlertCircle, Inbox } from "lucide-react";

type SkeletonType = "donut" | "bars" | "line" | "spinner";

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  loading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  className?: string;
  /** Shape of the skeleton to show while loading. Defaults to "spinner". */
  skeletonType?: SkeletonType;
}

export function ChartContainer({
  title,
  subtitle,
  action,
  children,
  loading = false,
  error = null,
  isEmpty = false,
  emptyMessage = "No data to display",
  className = "",
  skeletonType = "spinner",
}: ChartContainerProps) {
  return (
    <section
      className={`
        card card-hover p-5 sm:p-6
        animate-slide-up
        flex flex-col
        ${className}
      `}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-base sm:text-lg text-text-primary tracking-tight truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/* Body — one of four states: loading / error / empty / chart */}
      <div className="flex-1 min-h-[280px]">
        {loading ? (
          <ChartSkeleton type={skeletonType} />
        ) : error ? (
          <ChartError message={error} />
        ) : isEmpty ? (
          <ChartEmpty message={emptyMessage} />
        ) : (
          <div className="w-full h-full animate-fade-in">{children}</div>
        )}
      </div>
    </section>
  );
}

/* ---------- Substates ---------- */

function ChartSkeleton({ type }: { type: SkeletonType }) {
  if (type === "donut") return <DonutSkeleton />;
  if (type === "bars") return <BarsSkeleton />;
  if (type === "line") return <LineSkeleton />;
  return <SpinnerSkeleton />;
}

/**
 * Generic spinner — fallback for charts that don't specify a skeleton type.
 */
function SpinnerSkeleton() {
  return (
    <div className="h-full min-h-[280px] flex items-center justify-center">
      <ShimmerBlock className="w-32 h-32 rounded-full" />
    </div>
  );
}

/**
 * Donut skeleton — outer ring (faded), inner hole (transparent), legend dots below.
 * Matches the silhouette of the real donut chart so the layout doesn't shift.
 */
function DonutSkeleton() {
  return (
    <div className="h-full min-h-[280px] flex flex-col items-center justify-center gap-4 py-2">
      {/* Donut shape: ring with a hole */}
      <div className="relative w-[180px] h-[180px]">
        <ShimmerBlock className="absolute inset-0 rounded-full" />
        {/* The "hole" — same color as card surface so it carves the donut */}
        <div className="absolute inset-[28%] rounded-full bg-bg-surface" />
      </div>
      {/* Legend rows */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center">
        {[60, 50, 70, 45].map((w, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <ShimmerBlock className="w-2.5 h-2.5 rounded-sm" />
            <ShimmerBlock className="h-3 rounded" style={{ width: w }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Horizontal bars skeleton — 5 rows of varying widths to suggest sorted data.
 * Widths decrease top-to-bottom mimicking how the real chart sorts by stars desc.
 */
function BarsSkeleton() {
  const widths = ["95%", "78%", "62%", "48%", "35%"];
  return (
    <div className="h-full min-h-[280px] flex flex-col justify-center gap-2.5 py-4 px-2">
      {widths.map((w, i) => (
        <div key={i} className="flex items-center gap-3">
          <ShimmerBlock
            className="h-3 rounded shrink-0"
            style={{ width: 80 }}
          />
          <ShimmerBlock className="h-5 rounded-r-md" style={{ width: w }} />
        </div>
      ))}
    </div>
  );
}

/**
 * Line chart skeleton — animated SVG zigzag tracing a wave path.
 * The dashed-stroke + animated dashoffset effect is more interesting than a flat block.
 */
function LineSkeleton() {
  return (
    <div className="h-full min-h-[280px] relative px-2 py-4">
      <svg
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
        className="w-full h-full"
        aria-hidden
      >
        {/* Grid lines — match the real chart's CartesianGrid */}
        {[40, 80, 120, 160].map((y) => (
          <line
            key={y}
            x1="0"
            x2="400"
            y1={y}
            y2={y}
            stroke="var(--color-bg-border)"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
        ))}
        {/* Faux line path — matches typical commit activity shape */}
        <path
          d="M0,150 L40,140 L80,120 L120,90 L160,110 L200,70 L240,80 L280,50 L320,60 L360,40 L400,30"
          fill="none"
          stroke="var(--color-bg-elevated)"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="line-skeleton-path"
        />
      </svg>
      <style>{`
        .line-skeleton-path {
          stroke-dasharray: 6 6;
          animation: line-skeleton-flow 1.5s linear infinite;
        }
        @keyframes line-skeleton-flow {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -24; }
        }
      `}</style>
    </div>
  );
}

/**
 * Reusable shimmer block — used by every skeleton above.
 * The actual shimmer animation is defined in index.css.
 */
function ShimmerBlock({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`
        relative overflow-hidden bg-bg-elevated
        ${className}
      `}
      style={style}
    >
      <div
        className="
          absolute inset-0 -translate-x-full animate-shimmer
          bg-gradient-to-r from-transparent via-bg-border to-transparent
          bg-[length:1000px_100%]
        "
      />
    </div>
  );
}

function ChartError({ message }: { message: string }) {
  return (
    <div className="h-full min-h-[280px] flex flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-500/10 ring-1 ring-red-500/20">
        <AlertCircle className="w-5 h-5 text-red-400" strokeWidth={2.25} />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary">
          Couldn't load chart
        </p>
        <p className="mt-1 text-xs text-text-muted max-w-xs">{message}</p>
      </div>
    </div>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="h-full min-h-[280px] flex flex-col items-center justify-center gap-3 text-text-muted">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-bg-elevated ring-1 ring-bg-border">
        <Inbox className="w-5 h-5" strokeWidth={2.25} />
      </div>
      <p className="text-xs font-mono uppercase tracking-wider">{message}</p>
    </div>
  );
}
