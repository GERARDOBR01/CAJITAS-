import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import "./simple.css";
import { setupNativeEvents } from "./nativeEvents.js";
import { hydrateSavings } from "./journal/nativeReplica.js";
import { migrateStorageKey } from "./domain.js";
import ErrorBoundary from "./feedback/ErrorBoundary.jsx";
import { listenForErrors } from "./feedback/errorLog.js";
async function start() {
  listenForErrors();
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
  // Ask the browser to keep the cajitas even when space runs low (Safari
  // otherwise may clear a site it has not seen in a while).
  navigator.storage?.persist?.().catch(() => {});
  createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
  setupNativeEvents().catch(() => {});
}
start();
