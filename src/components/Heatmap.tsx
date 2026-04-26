import { useMemo, useState } from "react";
import type { ContributionCalendar, ContributionDay } from "../lib/schemas";

interface HeatmapProps {
  calendar: ContributionCalendar;
}

/**
 * Lime palette for activity intensity — 5 buckets.
 * Index 0 is the "no activity" color; 1–4 step up in saturation.
 * Designed to read clearly on both dark and light backgrounds.
 *
 * The empty cell uses bg-elevated (theme-aware via CSS variable).
 * Active cells use literal hex so they pop in light mode too.
 */
const LIME_SCALE = [
  "var(--color-bg-elevated)", // 0 — no activity
  "#3f6212", // 1 — lime-900
  "#65a30d", // 2 — lime-700
  "#84cc16", // 3 — lime-500
  "#a3e635", // 4 — lime-400 (matches accent)
];

/**
 * Bucket a contribution count into a 0–4 intensity level.
 * Thresholds chosen to give good visual distribution:
 * - 0 stays as 0 (special — no activity)
 * - 1–3 commits is "light" activity
 * - 4–7 is moderate
 * - 8–14 is heavy
 * - 15+ is the brightest
 *
 * Avoiding raw count → color saturation mapping because most users have a
 * long tail of single-commit days; linear scaling makes everything look pale.
 */
function intensityLevel(count: number): number {
  if (count === 0) return 0;
  if (count < 4) return 1;
  if (count < 8) return 2;
  if (count < 15) return 3;
  return 4;
}

interface HoveredCell {
  day: ContributionDay;
  x: number;
  y: number;
}

export function Heatmap({ calendar }: HeatmapProps) {
  const [hovered, setHovered] = useState<HoveredCell | null>(null);

  /**
   * Pre-compute the layout once per calendar.
   * GitHub returns weeks already aligned (Sunday → Saturday) so we just need
   * to figure out which weeks need a month label above them.
   */
  const layout = useMemo(() => {
    const cellSize = 11; // square edge length in svg units
    const cellGap = 3;
    const stride = cellSize + cellGap;

    // Reserve space at the top for month labels and at the left for day labels
    const topPadding = 18;
    const leftPadding = 28;

    const weekCount = calendar.weeks.length;
    const width = leftPadding + weekCount * stride;
    const height = topPadding + 7 * stride;

    /**
     * Month labels appear above the FIRST week of each month.
     * We track the previous week's month so we only label transitions.
     */
    const monthLabels: { x: number; label: string }[] = [];
    let lastMonth = -1;
    calendar.weeks.forEach((week, weekIndex) => {
      const firstDay = week.contributionDays[0];
      if (!firstDay) return;
      const month = new Date(firstDay.date).getMonth();
      if (month !== lastMonth) {
        // Skip the very first label if it would be too close to the start
        // (GitHub does the same — first label is usually the second month visible)
        if (weekIndex > 0 || lastMonth !== -1) {
          const monthName = new Date(firstDay.date).toLocaleDateString(
            "en-US",
            {
              month: "short",
            },
          );
          monthLabels.push({
            x: leftPadding + weekIndex * stride,
            label: monthName,
          });
        }
        lastMonth = month;
      }
    });

    return {
      cellSize,
      stride,
      topPadding,
      leftPadding,
      width,
      height,
      monthLabels,
    };
  }, [calendar]);

  const dayLabels = ["Mon", "Wed", "Fri"]; // GitHub style: only show every other day

  return (
    <div className="relative">
      {/* Scrollable wrapper — heatmap can be wider than container on small screens */}
      <div className="overflow-x-auto -mx-1 px-1 pb-2">
        <svg
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="block"
          aria-label={`Contribution heatmap: ${calendar.totalContributions} contributions in the last year`}
        >
          {/* Month labels along the top */}
          {layout.monthLabels.map((m, i) => (
            <text
              key={`${m.label}-${i}`}
              x={m.x}
              y={12}
              fill="var(--color-text-muted)"
              fontSize={9}
              fontFamily="var(--font-mono)"
              className="select-none"
            >
              {m.label}
            </text>
          ))}

          {/* Day-of-week labels along the left (Mon, Wed, Fri) */}
          {dayLabels.map((label, i) => {
            // GitHub's grid: Sunday = 0, Saturday = 6. We label rows 1, 3, 5.
            const rowIndex = i * 2 + 1;
            const y =
              layout.topPadding +
              rowIndex * layout.stride +
              layout.cellSize -
              1;
            return (
              <text
                key={label}
                x={4}
                y={y}
                fill="var(--color-text-muted)"
                fontSize={9}
                fontFamily="var(--font-mono)"
                className="select-none"
              >
                {label}
              </text>
            );
          })}

          {/* The grid of cells */}
          {calendar.weeks.map((week, weekIndex) =>
            week.contributionDays.map((day) => {
              const dayOfWeek = new Date(day.date).getUTCDay();
              const x = layout.leftPadding + weekIndex * layout.stride;
              const y = layout.topPadding + dayOfWeek * layout.stride;
              const level = intensityLevel(day.contributionCount);
              const isHovered = hovered?.day.date === day.date;

              return (
                <rect
                  key={day.date}
                  x={x}
                  y={y}
                  width={layout.cellSize}
                  height={layout.cellSize}
                  rx={2}
                  fill={LIME_SCALE[level]}
                  stroke={
                    isHovered ? "var(--color-text-primary)" : "transparent"
                  }
                  strokeWidth={1}
                  className="transition-colors duration-150 cursor-pointer"
                  onMouseEnter={() =>
                    setHovered({ day, x: x + layout.cellSize / 2, y })
                  }
                  onMouseLeave={() => setHovered(null)}
                />
              );
            }),
          )}
        </svg>
      </div>

      {/* Tooltip — absolutely positioned over the SVG */}
      {hovered && (
        <HeatmapTooltip
          day={hovered.day}
          x={hovered.x}
          y={hovered.y}
          containerWidth={layout.width}
        />
      )}

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-3 text-xs text-text-muted font-mono">
        <span>Less</span>
        <div className="flex gap-1">
          {LIME_SCALE.map((color, i) => (
            <span
              key={i}
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

/**
 * Tooltip rendered as a positioned div, not an SVG element — easier to style
 * with the existing .glass class and theme tokens.
 *
 * Position math:
 * - x is the horizontal center of the hovered cell
 * - We center the tooltip on x, but clamp so it doesn't overflow the container
 */
function HeatmapTooltip({
  day,
  x,
  y,
  containerWidth,
}: {
  day: ContributionDay;
  x: number;
  y: number;
  containerWidth: number;
}) {
  const dateLabel = new Date(day.date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Clamp horizontal position so tooltip stays inside container
  const tooltipWidth = 180;
  const halfWidth = tooltipWidth / 2;
  const left = Math.max(halfWidth, Math.min(x, containerWidth - halfWidth));

  return (
    <div
      className="
        absolute pointer-events-none
        glass rounded-lg px-3 py-2 text-xs shadow-xl
        animate-fade-in
        whitespace-nowrap
      "
      style={{
        left,
        top: y - 8,
        transform: "translate(-50%, -100%)",
        width: tooltipWidth,
      }}
    >
      <div className="font-mono text-text-primary font-semibold tabular-nums">
        {day.contributionCount}{" "}
        {day.contributionCount === 1 ? "contribution" : "contributions"}
      </div>
      <div className="font-mono text-text-muted text-[11px] mt-0.5">
        {dateLabel}
      </div>
    </div>
  );
}
