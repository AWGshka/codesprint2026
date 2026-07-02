import "./index.css";
import "solid-devtools";

import App from "./app/App";

import { render } from "solid-js/web";

const root = document.getElementById("root");
if (!(root instanceof HTMLElement)) throw new Error("#root element not found.");

render(() => <App />, root);
