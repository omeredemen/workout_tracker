"use client";

import { useState } from "react";
import { linear } from "./scale";
import { useWidth } from "./useWidth";

export type Column = { label: string; value: number; detail: string };

const HEIGHT = 140;
const PAD = { top: 14, right: 8, bottom: 22, left: 8 };
const MAX_BAR = 24;
const RADIUS = 4;

/**
 * Single-series columns from a zero baseline, with an optional reference line
 * (e.g. planned workouts). Each column's full slot is its hover/focus target.
 */
export function ColumnChart({
  title,
  columns,
  reference,
}: {
  title: string;
  columns: Column[];
  reference?: { value: number; label: string };
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const top = Math.max(
    reference?.value ?? 0,
    ...columns.map((c) => c.value),
    1,
  );
  const y = linear(0, top, HEIGHT - PAD.bottom, PAD.top);
  const slot = (width - PAD.left - PAD.right) / columns.length;
  const bar = Math.min(MAX_BAR, slot * 0.6);
  const activeColumn = active === null ? null : columns[active]!;

  return (
    <figure className="flex flex-col gap-2">
      <div ref={ref} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={title}
          className="overflow-visible"
        >
          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={y(0)}
            y2={y(0)}
            className="stroke-border"
            strokeWidth={1}
          />
          {reference && (
            <g>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(reference.value)}
                y2={y(reference.value)}
                className="stroke-surface-2"
                strokeWidth={1}
              />
              <text
                x={width - PAD.right}
                y={y(reference.value) - 4}
                textAnchor="end"
                className="fill-muted text-[10px]"
              >
                {reference.label}
              </text>
            </g>
          )}
          {columns.map((c, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const h = y(0) - y(c.value);
            const r = Math.min(RADIUS, h, bar / 2);
            const x0 = cx - bar / 2;
            const yTop = y(c.value);
            return (
              <g
                key={c.label}
                tabIndex={0}
                role="img"
                aria-label={`${c.label}: ${c.detail}`}
                onPointerEnter={() => setActive(i)}
                onPointerDown={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="outline-none"
              >
                <rect
                  x={PAD.left + slot * i}
                  y={PAD.top}
                  width={slot}
                  height={HEIGHT - PAD.top}
                  fill="transparent"
                />
                {h > 0 && (
                  <path
                    d={`M${x0},${y(0)} V${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} H${x0 + bar - r} Q${x0 + bar},${yTop} ${x0 + bar},${yTop + r} V${y(0)} Z`}
                    className={`fill-series-1 ${active === i ? "opacity-80" : ""}`}
                  />
                )}
                <text
                  x={cx}
                  y={HEIGHT - 6}
                  textAnchor="middle"
                  className="fill-muted text-[10px] tabular-nums"
                >
                  {c.label}
                </text>
              </g>
            );
          })}
        </svg>
        {activeColumn && active !== null && (
          <div
            role="status"
            className="border-border bg-surface pointer-events-none absolute top-0 w-[150px] rounded-lg border px-2.5 py-1.5 text-xs shadow"
            style={{
              left: Math.min(
                Math.max(PAD.left + slot * active + slot / 2 - 75, 0),
                width - 150,
              ),
            }}
          >
            <p className="text-muted">{activeColumn.label}</p>
            <p className="font-semibold">{activeColumn.detail}</p>
          </div>
        )}
      </div>
      <details className="text-sm">
        <summary className="text-muted cursor-pointer text-xs">
          Show as table
        </summary>
        <table className="mt-2 w-full text-left text-xs tabular-nums">
          <tbody>
            {columns.map((c) => (
              <tr key={c.label} className="border-surface-2 border-t">
                <td className="py-1">{c.label}</td>
                <td className="py-1 text-right">{c.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
