import { type ReactNode } from "react";
import { Loader2, AlertCircle, Inbox } from "lucide-react";

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
          <ChartLoading />
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

function ChartLoading() {
  return (
    <div className="h-full min-h-[280px] flex flex-col items-center justify-center gap-3 text-text-muted">
      <Loader2
        className="w-6 h-6 animate-spin text-accent"
        strokeWidth={2.25}
      />
      <span className="text-xs font-mono uppercase tracking-wider">
        Loading data
      </span>
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
