import { useEffect, useState } from "react";
import {
  isNative,
  platform,
  getInstallPrompt,
  clearInstallPrompt,
} from "../platform.js";
import Illustration from "./Illustration.jsx";
import { ANDROID_DOWNLOAD_URL } from "../downloads.js";
import { ownerTools } from "../features.js";
import { PLAY_URL } from "../support.js";
export default function Install({ notify, signedIn }) {
  const [prompt, setPrompt] = useState(getInstallPrompt),
    [installed, setInstalled] = useState(
      isNative ||
        matchMedia("(display-mode: standalone)").matches ||
        navigator.standalone === true,
    );
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/.test(navigator.userAgent);
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
  // The test APK is only for the owner; the public gets Google Play.
  const apk = ownerTools ? ANDROID_DOWNLOAD_URL : "";
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
        <p>Tus metas, mascota e historial funcionan aunque no tengas internet.</p>
        {prompt && !installed && (
          <button className="primary" onClick={install}>
            Instalar Guardadito
          </button>
        )}
        {isNative ? (
          <p className="notice">
            Estás usando la app para {platform === "ios" ? "iPhone" : "Android"}
            . Para tener tus cajitas en otro teléfono, entra con tu cuenta en Más
            → Mi cuenta.
          </p>
        ) : (
          !installed && (
            <>
              {ios && !signedIn && (
                <p className="notice install-warning">
                  <strong>Antes de instalar, crea tu cuenta.</strong> En el
                  iPhone, Safari y la app de tu pantalla de inicio guardan por
                  separado: con tu cuenta, tus cajitas aparecen en las dos.
                </p>
              )}
              {android && PLAY_URL && (
                <a
                  className="primary button-link full"
                  href={PLAY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Descargar en Google Play ↗
                </a>
              )}
              <div className="install-instructions">
                <h3>{ios ? "En tu iPhone o iPad" : "En tu navegador"}</h3>
                <ol>
                  {ios ? (
                    <>
                      <li>Abre Guardadito en Safari.</li>
                      <li>
                        Toca Compartir (el cuadrito con la flecha) y elige
                        “Agregar a pantalla de inicio”.
                      </li>
                      <li>
                        Confirma “Agregar” y abre Guardadito desde su ícono.
                      </li>
                      {!signedIn && (
                        <li>
                          Entra con tu cuenta en Más → Mi cuenta para traer tus
                          cajitas.
                        </li>
                      )}
                    </>
                  ) : (
                    <>
                      <li>Abre el menú del navegador.</li>
                      <li>
                        Elige “Instalar app” o “Agregar a pantalla de inicio”.
                      </li>
                      <li>
                        Confirma la instalación. Si la opción aún no aparece,
                        vuelve a abrir Guardadito con internet.
                      </li>
                    </>
                  )}
                </ol>
              </div>
            </>
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
          <span>☁ Funciona sin internet</span>
          <span>♧ No mueve tu dinero</span>
        </div>
        <p className="small-text muted">
          {signedIn
            ? "Tus cajitas se guardan en tu cuenta: entra con el mismo correo en cualquier teléfono."
            : "Sin cuenta, tus cajitas viven solo en este navegador. Crea una en Más → Mi cuenta o descarga un respaldo para no perderlas."}
        </p>
      </div>
    </section>
  );
}
