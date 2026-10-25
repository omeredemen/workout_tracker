"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { parseIsoDate } from "@/domain/dates";
import type { IsoDate } from "@/domain/types";
import { formatShortDate } from "@/lib/format";
import { linear, niceTicks } from "./scale";
import { useWidth } from "./useWidth";

export type LineSeries = {
  name: string;
  points: { x: IsoDate; y: number }[];
  /** "line": the series the chart is about; "dots": raw readings behind it, de-emphasised. */
  style: "line" | "dots";
};

const HEIGHT = 180;
const PAD = { top: 16, right: 52, bottom: 24, left: 36 };

/**
 * A small time-series chart: one highlighted line (series colour) and
 * optional de-emphasised dots, a crosshair tooltip on hover/arrow keys, the
 * latest value labelled at the line's end, and a table view.
 */
export function LineChart({
  title,
  series,
  formatY,
}: {
  title: string;
  series: LineSeries[];
  formatY: (value: number) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const dates = [
    ...new Set(series.flatMap((s) => s.points.map((p) => p.x))),
  ].sort();
  const values = series.flatMap((s) => s.points.map((p) => p.y));
  if (dates.length === 0) return null;

  const times = dates.map((d) => parseIsoDate(d).getTime());
  const x = linear(times[0]!, times.at(-1)!, PAD.left, width - PAD.right);
  const { ticks, min, max } = niceTicks(
    Math.min(...values),
    Math.max(...values),
    3,
  );
  const y = linear(min, max, HEIGHT - PAD.bottom, PAD.top);
  const at = (date: IsoDate) => x(parseIsoDate(date).getTime());
  const main = series.find((s) => s.style === "line");
  const last = main?.points.at(-1);
  const multi = series.length > 1;

  const nearest = (px: number) =>
    times.reduce(
      (best, t, i) =>
        Math.abs(x(t) - px) < Math.abs(x(times[best]!) - px) ? i : best,
      0,
    );
  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setActive(nearest(e.clientX - rect.left));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const step = e.key === "ArrowLeft" ? -1 : 1;
    setActive((i) =>
      Math.min(
        dates.length - 1,
        Math.max(0, (i ?? dates.length - 1) + (i === null ? 0 : step)),
      ),
    );
  };

  const activeDate = active === null ? null : dates[active]!;
  const tooltipLeft = activeDate
    ? Math.min(Math.max(at(activeDate) - 70, 0), width - 140)
    : 0;

  return (
    <figure className="flex flex-col gap-2">
      {multi && (
        <figcaption className="text-muted flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5">
              {s.style === "line" ? (
                <span className="bg-series-1 h-0.5 w-4 rounded" aria-hidden />
              ) : (
                <span className="bg-muted/60 size-2 rounded-full" aria-hidden />
              )}
              {s.name}
            </span>
          ))}
        </figcaption>
      )}
      <div ref={ref} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${title}. Use the arrow keys to read values.`}
          tabIndex={0}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={onKey}
          className="focus-visible:ring-accent touch-pan-y overflow-visible outline-none focus-visible:ring-2"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                className="stroke-surface-2"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                className="fill-muted text-[10px] tabular-nums"
              >
                {formatY(t)}
              </text>
            </g>
          ))}
          <text x={PAD.left} y={HEIGHT - 6} className="fill-muted text-[10px]">
            {formatShortDate(dates[0]!).slice(4)}
          </text>
          {dates.length > 1 && (
            <text
              x={width - PAD.right}
              y={HEIGHT - 6}
              textAnchor="end"
              className="fill-muted text-[10px]"
            >
              {formatShortDate(dates.at(-1)!).slice(4)}
            </text>
          )}

          {activeDate && (
            <line
              x1={at(activeDate)}
              x2={at(activeDate)}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              className="stroke-border"
              strokeWidth={1}
            />
          )}

          {series
            .filter((s) => s.style === "dots")
            .flatMap((s) => s.points)
            .map((p) => (
              <circle
                key={`d-${p.x}`}
                cx={at(p.x)}
                cy={y(p.y)}
                r={3}
                className="fill-muted/60"
              />
            ))}

          {main && main.points.length > 1 && (
            <polyline
              points={main.points.map((p) => `${at(p.x)},${y(p.y)}`).join(" ")}
              fill="none"
              className="stroke-series-1"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {main?.points
            .filter((p) => p === last || p.x === activeDate)
            .map((p) => (
              <circle
                key={`m-${p.x}`}
                cx={at(p.x)}
                cy={y(p.y)}
                r={4}
                className="fill-series-1 stroke-surface"
                strokeWidth={2}
              />
            ))}
          {last && (
            <text
              x={at(last.x) + 8}
              y={y(last.y)}
              dy="0.32em"
              className="fill-foreground text-[11px] font-semibold tabular-nums"
            >
              {formatY(last.y)}
            </text>
          )}
        </svg>

        {activeDate && (
          <div
            role="status"
            className="border-border bg-surface pointer-events-none absolute top-0 w-[140px] rounded-lg border px-2.5 py-1.5 text-xs shadow"
            style={{ left: tooltipLeft }}
          >
            <p className="text-muted">{formatShortDate(activeDate)}</p>
            {series.map((s) => {
              const point = s.points.find((p) => p.x === activeDate);
              return (
                point && (
                  <p key={s.name} className="flex items-center gap-1.5">
                    <span
                      className={
                        s.style === "line"
                          ? "bg-series-1 h-0.5 w-3 rounded"
                          : "bg-muted/60 size-1.5 rounded-full"
                      }
                      aria-hidden
                    />
                    <strong className="tabular-nums">{formatY(point.y)}</strong>
                    {multi && (
                      <span className="text-muted truncate">{s.name}</span>
                    )}
                  </p>
                )
              );
            })}
          </div>
        )}
      </div>

      <details className="text-sm">
        <summary className="text-muted cursor-pointer text-xs">
          Show as table
        </summary>
        <table className="mt-2 w-full text-left text-xs tabular-nums">
          <thead className="text-muted">
            <tr>
              <th className="py-1 font-medium">Date</th>
              {series.map((s) => (
                <th key={s.name} className="py-1 text-right font-medium">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...dates].reverse().map((d) => (
              <tr key={d} className="border-surface-2 border-t">
                <td className="py-1">{formatShortDate(d)}</td>
                {series.map((s) => {
                  const point = s.points.find((p) => p.x === d);
                  return (
                    <td key={s.name} className="py-1 text-right">
                      {point ? formatY(point.y) : "–"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
