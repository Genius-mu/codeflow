import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
  loading?: boolean;
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  trend,
  loading = false,
}: MetricCardProps) {
  if (loading) {
    return (
      <div className="card p-5 relative overflow-hidden">
        <div
          className="absolute inset-0 -translate-x-full animate-shimmer
                        bg-gradient-to-r from-transparent via-bg-elevated to-transparent
                        bg-[length:1000px_100%]"
        />
        <div className="space-y-3">
          <div className="h-3 w-20 rounded bg-bg-elevated" />
          <div className="h-8 w-24 rounded bg-bg-elevated" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="
        card card-hover p-5 group cursor-default
        animate-fade-in
        relative overflow-hidden
      "
    >
      {/* Subtle accent glow on hover — barely visible, just adds life */}
      <div
        className="
          absolute -top-12 -right-12 w-32 h-32 rounded-full
          bg-accent/0 group-hover:bg-accent/[0.06]
          blur-2xl transition-colors duration-500
          pointer-events-none
        "
        aria-hidden
      />

      {/* Top row: label + icon */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <span
          className="
            text-xs uppercase tracking-wider font-medium
            text-text-muted
          "
        >
          {label}
        </span>
        {Icon && (
          <div
            className="
              flex items-center justify-center w-8 h-8 rounded-lg
              bg-bg-elevated text-text-secondary
              transition-all duration-300
              group-hover:bg-accent/10 group-hover:text-accent
              group-hover:scale-110
            "
          >
            <Icon className="w-4 h-4" strokeWidth={2.25} />
          </div>
        )}
      </div>

      {/* Value — the hero */}
      <div className="flex items-baseline gap-2 flex-wrap">
        <span
          className="
            font-display font-bold text-3xl sm:text-4xl
            text-text-primary tabular-nums
            tracking-tight
          "
        >
          {value}
        </span>
        {trend && (
          <span
            className={`
              text-xs font-mono font-medium
              ${trend.direction === "up" ? "text-accent" : ""}
              ${trend.direction === "down" ? "text-red-400" : ""}
              ${trend.direction === "neutral" ? "text-text-muted" : ""}
            `}
          >
            {trend.direction === "up" && "↑ "}
            {trend.direction === "down" && "↓ "}
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
