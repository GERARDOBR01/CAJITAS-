import { useEffect, useState } from "react";
import {
  isNative,
  platform,
  getInstallPrompt,
  clearInstallPrompt,
} from "../platform.js";
import Illustration from "./Illustration.jsx";
import { ANDROID_DOWNLOAD_URL } from "../downloads.js";
export default function Install({ notify }) {
  const [prompt, setPrompt] = useState(getInstallPrompt),
    [installed, setInstalled] = useState(
      isNative ||
        matchMedia("(display-mode: standalone)").matches ||
        navigator.standalone === true,
    );
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  useEffect(() => {
    const before = () => setPrompt(getInstallPrompt()),
      done = () => {
        setInstalled(true);
        setPrompt(null);
        clearInstallPrompt();
      };
    window.addEventListener("guardadito:install", before);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("guardadito:install", before);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    setPrompt(null);
    clearInstallPrompt();
    if (choice.outcome === "accepted")
      notify("Guardadito se está instalando. ¡Nos vemos en tu inicio!");
  }
  const apk = ANDROID_DOWNLOAD_URL;
  return (
    <section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">SIEMPRE CERQUITA</p>
          <h1>Lleva tus cajitas contigo</h1>
          <p className="muted">
            Tu propio espacio para tus pequeños grandes planes.
          </p>
        </div>
      </div>
      <div className="install-hero panel">
        <Illustration kind="welcome" className="install-illustration" />
        <span className="badge">
          {installed
            ? "Guardadito ya está en tu dispositivo"
            : "Sin costo · sin anuncios"}
        </span>
        <h2>
          {installed
            ? "Tu app, tus sueños."
            : "Una casita en tu pantalla de inicio."}
        </h2>
        <p>
          Tus metas, mascotas e historial funcionan sin conexión. Las consultas
          de tasas y comprobantes necesitan internet.
        </p>
        {prompt && !installed && (
          <button className="primary" onClick={install}>
            Instalar Guardadito
          </button>
        )}
        {isNative ? (
          <p className="notice">
            Estás usando la app para {platform === "ios" ? "iPhone" : "Android"}
            . Para recuperar tus cajitas en otro dispositivo, lleva contigo tu
            respaldo.
          </p>
        ) : (
          !installed && (
            <div className="install-instructions">
              <h3>{ios ? "En tu iPhone o iPad" : "En tu navegador"}</h3>
              <ol>
                {ios ? (
                  <>
                    <li>Abre Guardadito en Safari.</li>
                    <li>
                      Toca Compartir y elige “Agregar a pantalla de inicio”.
                    </li>
                    <li>
                      Confirma “Agregar”. Tu app aparecerá junto a las demás.
                    </li>
                  </>
                ) : (
                  <>
                    <li>Abre el menú del navegador.</li>
                    <li>
                      Elige “Instalar app” o “Agregar a pantalla de inicio”.
                    </li>
                    <li>
                      Confirma la instalación. Si la opción aún no aparece,
                      visita la versión publicada con conexión.
                    </li>
                  </>
                )}
              </ol>
            </div>
          )
        )}
        {!isNative && apk && (
          <a
            className="secondary button-link"
            href={apk}
            target="_blank"
            rel="noopener noreferrer"
          >
            ↓ Descargar APK de prueba para Android
          </a>
        )}
        <div className="install-benefits">
          <span>♡ Mascota a tu estilo</span>
          <span>☁ Ahorro offline</span>
          <span>♧ Sin custodia de dinero</span>
        </div>
        <p className="small-text muted">
          Tus registros viven en este dispositivo. La instalación web y la app
          nativa tienen almacenes independientes: exporta e importa el respaldo
          para llevar tus datos.
        </p>
      </div>
    </section>
  );
}
