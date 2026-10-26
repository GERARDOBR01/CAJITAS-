import { Component } from "react";
import { STORAGE_KEY, today } from "../domain.js";
import { logError } from "./errorLog.js";
import { saveFile } from "../platform.js";

/**
 * If a screen fails while drawing, the person sees what happened and can
 * keep their cajitas safe, instead of a blank page.
 */
export default class ErrorBoundary extends Component {
  state = { failed: false, saved: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    logError(error, "pantalla");
  }
  async download() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* Without storage there is nothing to download. */
    }
    try {
      await saveFile(raw ?? "", `cajitas-${today()}.json`);
      this.setState({ saved: true });
    } catch {
      /* The reload button still works. */
    }
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="crash-screen" role="alert">
        <h1>Algo se atoró</h1>
        <p>
          Tus cajitas siguen guardadas en este teléfono. Recarga la app para
          seguir; si vuelve a pasar, descarga tu respaldo y escríbenos desde
          Ajustes → Ayuda.
        </p>
        <button className="primary full" onClick={() => location.reload()}>
          Recargar Guardadito
        </button>
        <button className="secondary full" onClick={() => this.download()}>
          {this.state.saved ? "✓ Respaldo descargado" : "↓ Descargar respaldo"}
        </button>
      </main>
    );
  }
}
