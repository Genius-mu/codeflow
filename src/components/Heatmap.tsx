import { useState, useMemo } from "react";
import type { ContributionCalendar } from "../lib/schemas";

interface HeatmapProps {
  calendar: ContributionCalendar;
  /**
   * Override the default lime accent — used by column B in compare mode
   * to switch to sky blue.
   */
  accentHex?: string;
}

/**
 * GitHub-style contribution heatmap.
 *
 * Renders 53 weeks × 7 days as a grid of SVG rects.
 * Color intensity scales with contribution count using a 5-step ramp
 * derived from the accent color (lime by default, sky in column B).
 */
export function Heatmap({ calendar, accentHex = "#a3e635" }: HeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{
    date: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  const palette = useMemo(() => deriveHeatmapPalette(accentHex), [accentHex]);

  // Find the max contribution day to scale intensities meaningfully.
  // Without this, a casual user (max 4) and a power user (max 80) would look
  // the same — everything would max out at level 4 immediately.
  const maxCount = useMemo(() => {
    let max = 0;
    for (const week of calendar.weeks) {
      for (const day of week.contributionDays) {
        if (day.contributionCount > max) max = day.contributionCount;
      }
    }
    return max;
  }, [calendar]);

  function getColor(count: number): string {
    if (count === 0) return palette[0];
    if (maxCount === 0) return palette[0];
    const ratio = count / maxCount;
    if (ratio > 0.75) return palette[4];
    if (ratio > 0.5) return palette[3];
    if (ratio > 0.25) return palette[2];
    return palette[1];
  }

  return (
    <div className="relative overflow-x-auto -mx-1 px-1">
      <div className="flex gap-[3px] py-2">
        {calendar.weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-[3px]">
            {week.contributionDays.map((day) => (
              <div
                key={day.date}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredCell({
                    date: day.date,
                    count: day.contributionCount,
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                  });
                }}
                onMouseLeave={() => setHoveredCell(null)}
                className="w-[11px] h-[11px] rounded-[2px] transition-transform hover:scale-150 hover:z-10 relative cursor-default"
                style={{ background: getColor(day.contributionCount) }}
                aria-label={`${day.contributionCount} contributions on ${day.date}`}
                title={`${day.contributionCount} contributions on ${day.date}`}
              />
            ))}
          </div>
        ))}
      </div>

      {hoveredCell && (
        <div
          className="
            fixed z-50 pointer-events-none
            glass rounded-md px-2 py-1
            text-[11px] font-mono
            -translate-x-1/2 -translate-y-full
            mt-[-8px]
            shadow-xl
          "
          style={{ left: hoveredCell.x, top: hoveredCell.y }}
        >
          <div className="font-semibold" style={{ color: accentHex }}>
            {hoveredCell.count} contribution{hoveredCell.count === 1 ? "" : "s"}
          </div>
          <div className="text-text-muted">
            {new Date(hoveredCell.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 justify-end mt-3 text-[10px] text-text-muted font-mono">
        <span>Less</span>
        {palette.map((c, i) => (
          <span
            key={i}
            className="w-[10px] h-[10px] rounded-[2px]"
            style={{ background: c }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

/**
 * Build a 5-step palette from an accent color.
 * Step 0 is the "no contributions" empty cell — translucent white so it works
 * on both dark and light themes.
 * Steps 1-4 are the accent at increasing alpha.
 */
function deriveHeatmapPalette(accentHex: string): string[] {
  const r = parseInt(accentHex.slice(1, 3), 16);
  const g = parseInt(accentHex.slice(3, 5), 16);
  const b = parseInt(accentHex.slice(5, 7), 16);

  return [
    "rgba(255, 255, 255, 0.05)",
    `rgba(${r}, ${g}, ${b}, 0.25)`,
    `rgba(${r}, ${g}, ${b}, 0.5)`,
    `rgba(${r}, ${g}, ${b}, 0.75)`,
    `rgba(${r}, ${g}, ${b}, 1)`,
  ];
}
