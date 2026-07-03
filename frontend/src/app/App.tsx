import { routes } from "./routes";

import { Router } from "@solidjs/router";

import type { Component } from "solid-js";

import { ToastViewport } from "~/shared/ui";
import { AuthProvider } from "~/shared/auth";

const App: Component = () => (
  <AuthProvider>
    <Router>{routes}</Router>
    <ToastViewport />
  </AuthProvider>
);

export default App;
