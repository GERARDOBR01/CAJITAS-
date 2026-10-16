import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import { setupNativeEvents, hydrateSavings } from "./platform.js";
import { migrateStorageKey } from "./domain.js";
async function start() {
  try {
    migrateStorageKey(localStorage);
  } catch {
    /* Without storage access there is nothing to carry over. */
  }
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
