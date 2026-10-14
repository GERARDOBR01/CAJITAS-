import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import "./upgrade.css";
import "./refinement.css";
import { setupNativeEvents, hydrateSavings } from "./platform.js";
async function start() {
  try {
    await hydrateSavings();
  } catch {
    /* The local copy remains available if native replication is unavailable. */
  }
  createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  setupNativeEvents().catch(() => {});
}
start();
