import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";

// Register the controllers *and* elements the app actually uses (line, bar, doughnut) - not
// `chart.js/auto`. The controllers (LineController/BarController/DoughnutController) were
// missing before, which threw "not a registered controller" the moment any chart rendered.
Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Filler,
  LineController,
  BarController,
  DoughnutController,
);

export { Chart };
