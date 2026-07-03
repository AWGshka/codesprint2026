import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";

// Register only the controllers/elements the app actually uses (line, bar, doughnut) — not `chart.js/auto`.
// Controllers (LineController/BarController/DoughnutController) are required alongside the
// scales/elements — without them Chart.js throws `"line" is not a registered controller`.
Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  LineController,
  BarController,
  DoughnutController,
  Tooltip,
  Legend,
  Filler,
);

export { Chart };
