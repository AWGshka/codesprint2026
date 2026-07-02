import { chartTheme } from "./theme";
import { Chart as ChartJS } from "./register";

import type { Component } from "solid-js";
import { createEffect, onCleanup } from "solid-js";
import type { ChartData, ChartOptions, ChartType } from "chart.js";

export interface ChartProps {
  type: ChartType;
  data: ChartData;
  options?: ChartOptions;
  class?: string;
  height?: number;
}

/**
 * Thin canvas wrapper around Chart.js - destroys/rebuilds on data change, respects reduced
 * motion, and re-renders on theme/contrast changes so gridlines/ticks/legend/tooltip stay
 * legible against the active palette (colours are read live from CSS custom properties, not
 * baked into the bundle at import time).
 */
export const Chart: Component<ChartProps> = (props) => {
  let canvas: HTMLCanvasElement | undefined;
  let instance: ChartJS | undefined;

  const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  createEffect(() => {
    // Read reactively so a new `data`/`type`/`options` reference (or a theme/contrast flip)
    // triggers a full destroy + rebuild - Chart.js doesn't re-theme an existing instance in place.
    const data = props.data;
    const type = props.type;
    const options = props.options;
    const theme = chartTheme();
    if (!canvas) return;

    // Chart.js reads these defaults at construction time for every scale/legend/tooltip that
    // doesn't set its own colour, so updating them before each rebuild re-themes the whole chart.
    ChartJS.defaults.color = theme.fgMuted;
    ChartJS.defaults.borderColor = theme.border;

    instance?.destroy();
    instance = new ChartJS(canvas, {
      type,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: reducedMotion ? false : undefined,
        scales:
          type === "doughnut"
            ? undefined
            : { x: { grid: { color: theme.border }, ticks: { color: theme.fgMuted } }, y: { grid: { color: theme.border }, ticks: { color: theme.fgMuted } } },
        ...options,
      },
    });
  });

  onCleanup(() => instance?.destroy());

  return <canvas ref={canvas} class={props.class} height={props.height ?? 160} />;
};
