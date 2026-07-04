import { Chart as ChartJS } from "./register";

import type { Component } from "solid-js";
import { createEffect, onCleanup } from "solid-js";
import type { ChartData, ChartOptions, ChartType } from "chart.js";

import { cn } from "~/shared/lib/cn";
import { prefs } from "~/shared/prefs";

export interface ChartProps {
  type: ChartType;
  data: ChartData;
  options?: ChartOptions;
  class?: string;
  height?: number;
}

/** Reads the current theme's grid/tick colours off `--chart-grid`/`--chart-tick` (index.css) so
 * axes stay legible in dark mode instead of Chart.js's hardcoded default grey. */
function themeChartColors() {
  const styles = getComputedStyle(document.documentElement);
  const grid = styles.getPropertyValue("--chart-grid").trim() || "#e6e6e9";
  const tick = styles.getPropertyValue("--chart-tick").trim() || "#6b6b72";
  return { grid, tick };
}

/** Thin canvas wrapper around Chart.js — destroys/rebuilds on data/theme change, respects reduced motion. */
export const Chart: Component<ChartProps> = (props) => {
  let canvas: HTMLCanvasElement | undefined;
  let instance: ChartJS | undefined;

  const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  createEffect(() => {
    // Read reactively so a new `data`/`type`/`options` reference — or a theme/contrast change —
    // triggers a rebuild (grid/tick colours are read fresh from CSS variables below).
    const data = props.data;
    const type = props.type;
    const options = props.options;
    prefs.theme();
    prefs.contrast();
    if (!canvas) return;

    const { grid, tick } = themeChartColors();
    ChartJS.defaults.color = tick;
    ChartJS.defaults.borderColor = grid;

    instance?.destroy();
    instance = new ChartJS(canvas, {
      type,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: reducedMotion ? false : undefined,
        scales:
          type === "doughnut" ? undefined : { x: { ticks: { color: tick }, grid: { color: grid } }, y: { ticks: { color: tick }, grid: { color: grid } } },
        ...options,
      },
    });
  });

  onCleanup(() => instance?.destroy());

  // Chart.js `responsive` mode sizes the canvas from its parent, then resizes the parent if the
  // canvas itself carries the height — an infinite growth loop. The fixed height must live on a
  // relative wrapper; the canvas just fills it.
  return (
    <div class={cn("relative", props.class)} style={props.height ? { height: `${props.height}px` } : undefined}>
      <canvas ref={canvas} class="absolute inset-0 h-full w-full" />
    </div>
  );
};
