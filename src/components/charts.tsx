"use client";

import { useId, useState } from "react";
import { formatHours, shortDate } from "@/lib/sleep";
import styles from "./charts.module.css";

// Dependency-free SVG charts. Geometry lives in a viewBox that scales to the card width; a wide
// chart gets a proportionally wider viewBox, so its text renders at the same size as the others.
const W = 640;
const WIDE_W = 1280;
const H = 200;
const PAD = { top: 12, right: 44, bottom: 24, left: 36 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/** Formatters live here, not in props: a Server Component cannot pass functions to a Client one. */
export type Unit = "score" | "hours" | "ms";
const FORMAT: Record<Unit, (v: number | null) => string> = {
  score: (v) => (v === null ? "—" : String(Math.round(v))),
  hours: formatHours,
  ms: (v) => (v === null ? "—" : `${Math.round(v)} ms`),
};

/** Clean round ticks from 0 to a nice max. */
function ticks(max: number): number[] {
  const raw = max / 3;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const out: number[] = [];
  for (let t = 0; t <= top + 1e-9; t += step) out.push(Math.round(t * 100) / 100);
  return out;
}

function Axes({ yTicks, yMax, labels, w = W }: { yTicks: number[]; yMax: number; labels: [number, string][]; w?: number }) {
  const y = (v: number) => PAD.top + PLOT_H - (v / yMax) * PLOT_H;
  return (
    <g className={styles.axis} aria-hidden="true">
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} className={t === 0 ? styles.baseline : styles.grid} />
          <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      {labels.map(([x, text]) => (
        <text key={`${x}-${text}`} x={x} y={H - 6} textAnchor="middle">
          {text}
        </text>
      ))}
    </g>
  );
}

/** Every ~n-th date label, so they never collide. */
function dateLabels(dates: string[], xAt: (i: number) => number, count = 6): [number, string][] {
  const every = Math.max(1, Math.ceil(dates.length / count));
  return dates.flatMap((d, i) => (i % every === 0 || i === dates.length - 1 ? [[xAt(i), shortDate(d)] as [number, string]] : []))
    .filter((l, i, all) => i === all.length - 1 || all[all.length - 1]![0] - l[0] > 40);
}

function DataTable({ caption, dates, columns }: { caption: string; dates: string[]; columns: { name: string; values: (number | null)[]; format: (v: number | null) => string }[] }) {
  return (
    <details className={styles.table}>
      <summary>Show table</summary>
      <table>
        <caption className={styles.srOnly}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            {columns.map((c) => (
              <th scope="col" key={c.name}>{c.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map((d, i) => (
            <tr key={d}>
              <td>{shortDate(d)}</td>
              {columns.map((c) => (
                <td key={c.name}>{c.format(c.values[i] ?? null)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export function ColumnChart(props: {
  title: string;
  dates: string[];
  values: (number | null)[];
  unit: Unit;
  yMax?: number;
}) {
  const { title, dates, values } = props;
  const format = FORMAT[props.unit];
  const [hover, setHover] = useState<number | null>(null);
  const present = values.filter((v): v is number => v !== null);
  const yTicks = ticks(props.yMax ?? Math.max(1, ...present));
  const yMax = yTicks[yTicks.length - 1]!;
  const slot = PLOT_W / Math.max(1, dates.length);
  const barW = Math.min(24, Math.max(2, slot - 2));
  const xAt = (i: number) => PAD.left + slot * i + slot / 2;
  const y = (v: number) => PAD.top + PLOT_H - (v / yMax) * PLOT_H;
  // No end label on columns: at 30+ bars it collides with the neighbouring bar, and the stat
  // tiles above already show last night's value. The tooltip and table carry every value.

  return (
    <figure className={styles.card}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.plot}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}, column chart`}>
          <Axes yTicks={yTicks} yMax={yMax} labels={dateLabels(dates, xAt)} />
          {values.map((v, i) => {
            if (v === null) return null;
            const top = y(v);
            const h = PAD.top + PLOT_H - top;
            const r = Math.min(4, barW / 2, h);
            const x = xAt(i) - barW / 2;
            // Rounded data-end, square at the baseline.
            const d = `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + h} Z`;
            return <path key={dates[i]} d={d} className={hover === i ? `${styles.bar} ${styles.barHover}` : styles.bar} />;
          })}
          {dates.map((d, i) => (
            <rect
              key={d}
              x={PAD.left + slot * i}
              y={PAD.top}
              width={slot}
              height={PLOT_H}
              fill="transparent"
              tabIndex={0}
              aria-label={`${shortDate(d)}: ${format(values[i] ?? null)}`}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          ))}
        </svg>
        {hover !== null && (
          <div className={styles.tooltip} style={{ left: `${(xAt(hover) / W) * 100}%` }}>
            <strong>{format(values[hover] ?? null)}</strong>
            <span>{shortDate(dates[hover]!)}</span>
          </div>
        )}
      </div>
      <DataTable caption={title} dates={dates} columns={[{ name: title, values, format }]} />
    </figure>
  );
}

export function LineChart(props: {
  title: string;
  dates: string[];
  series: { name: string; values: (number | null)[]; tone: "primary" | "secondary" }[];
  unit: Unit;
  wide?: boolean;
}) {
  const { title, dates, series } = props;
  const format = FORMAT[props.unit];
  const [hover, setHover] = useState<number | null>(null);
  const clipId = useId();
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const yTicks = ticks(Math.max(1, ...all));
  const yMax = yTicks[yTicks.length - 1]!;
  const w = props.wide ? WIDE_W : W;
  const plotW = w - PAD.left - PAD.right;
  const step = plotW / Math.max(1, dates.length - 1);
  const xAt = (i: number) => PAD.left + step * i;
  const y = (v: number) => PAD.top + PLOT_H - (v / yMax) * PLOT_H;

  const pathFor = (values: (number | null)[]) => {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${xAt(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  };

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - box.left) / box.width;
    setHover(Math.max(0, Math.min(dates.length - 1, Math.round(frac * (dates.length - 1)))));
  };

  return (
    <figure className={props.wide ? `${styles.card} ${styles.wide}` : styles.card}>
      <figcaption className={styles.title}>{title}</figcaption>
      <ul className={styles.legend}>
        {series.map((s) => (
          <li key={s.name}>
            <span className={`${styles.key} ${styles[s.tone]}`} aria-hidden="true" />
            {s.name}
          </li>
        ))}
      </ul>
      <div className={styles.plot}>
        <svg viewBox={`0 0 ${w} ${H}`} role="img" aria-label={`${title}, line chart`}>
          <clipPath id={clipId}>
            <rect x={PAD.left} y={0} width={plotW + 8} height={H} />
          </clipPath>
          <Axes yTicks={yTicks} yMax={yMax} w={w} labels={dateLabels(dates, xAt, props.wide ? 12 : 6)} />
          {hover !== null && (
            <line className={styles.crosshair} x1={xAt(hover)} x2={xAt(hover)} y1={PAD.top} y2={PAD.top + PLOT_H} />
          )}
          <g clipPath={`url(#${clipId})`}>
            {series.map((s) => (
              <path key={s.name} d={pathFor(s.values)} className={`${styles.line} ${styles[s.tone]}`} />
            ))}
          </g>
          {series.map((s, si) => {
            const i = s.values.findLastIndex((v) => v !== null);
            if (i < 0) return null;
            const labelY = y(s.values[i]!);
            // End labels that would collide are dropped, not nudged apart: a nudged label detaches
            // from its line. The legend and tooltip still carry that series.
            const collides = series.slice(0, si).some((p) => {
              const j = p.values.findLastIndex((v) => v !== null);
              return j >= 0 && Math.abs(y(p.values[j]!) - labelY) < 14;
            });
            return (
              <g key={s.name}>
                <circle cx={xAt(i)} cy={labelY} r={4} className={`${styles.dot} ${styles[s.tone]}`} />
                {!collides && (
                  <text className={styles.endLabel} x={xAt(i) + 8} y={labelY} dy="0.32em">
                    {format(s.values[i]!)}
                  </text>
                )}
              </g>
            );
          })}
          {hover !== null &&
            series.map((s) =>
              s.values[hover] == null ? null : (
                <circle key={s.name} cx={xAt(hover)} cy={y(s.values[hover]!)} r={4} className={`${styles.dot} ${styles[s.tone]}`} />
              ),
            )}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={plotW}
            height={PLOT_H}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {hover !== null && (
          <div className={styles.tooltip} style={{ left: `${(xAt(hover) / w) * 100}%` }}>
            <span>{shortDate(dates[hover]!)}</span>
            {series.map((s) => (
              <span key={s.name} className={styles.tipRow}>
                <span className={`${styles.key} ${styles[s.tone]}`} aria-hidden="true" />
                <strong>{format(s.values[hover] ?? null)}</strong> {s.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <DataTable
        caption={title}
        dates={dates}
        columns={series.map((s) => ({ name: s.name, values: s.values, format }))}
      />
    </figure>
  );
}
