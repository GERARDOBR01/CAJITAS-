import { useState } from "react";
import {
  APP_VERSION,
  CONTACT_EMAIL,
  ISSUES_URL,
  PRIVACY_URL,
  supportMailto,
} from "../support.js";
import { clearErrors, readErrors } from "../feedback/errorLog.js";
import { isNative, openExternal, platform } from "../platform.js";

const QUESTIONS = [
  [
    "¿Guardadito guarda mi dinero?",
    "No. Tu dinero se queda donde ya lo tienes: tu banco, Nu, Mercado Pago o en efectivo. Guardadito lleva la cuenta de lo que apartas, te propone un ritmo y te acompaña.",
  ],
  [
    "¿Qué pasa si cambio o pierdo mi teléfono?",
    "Si creaste una cuenta en Más → Mi cuenta, entra con el mismo correo en el teléfono nuevo y tus cajitas regresan. Sin cuenta, todo vive solo en este teléfono: descarga un respaldo en Más → Respaldo.",
  ],
  [
    "¿Cómo ahorro con mi pareja?",
    "Los dos necesitan cuenta. En Más → Mi pareja uno crea un código y el otro lo escribe. Después pueden tener cajitas de los dos y mandarse sorpresas.",
  ],
  [
    "Olvidé mi contraseña",
    "En Más → Mi cuenta toca «Olvidé mi contraseña» y te llega un correo para cambiarla. Revisa también la carpeta de spam.",
  ],
  [
    "¿Quién ve mis datos?",
    "Sin cuenta, nadie: se quedan en tu teléfono. Con cuenta, solo tú y la pareja que vincules. No hay anuncios y no vendemos datos.",
  ],
];

export default function Help({ notify }) {
  const [errors, setErrors] = useState(readErrors);
  const mailto = supportMailto({
    errors,
    platform: isNative ? platform : "web",
  });
  return (
    <section className="help-screen">
      <div className="section-heading">
        <div>
          <p className="eyebrow">AQUÍ ESTAMOS</p>
          <h1>Ayuda y comentarios</h1>
          <p className="muted">
            Guardadito es nueva y la hacemos con lo que nos cuentas.
          </p>
        </div>
      </div>
      <div className="panel help-contact">
        <h2>¿Algo no funciona o tienes una idea?</h2>
        <p>
          Cuéntanos qué pasó y en qué pantalla. Si la app tuvo errores, se
          agregan solos al mensaje (solo el error, nunca tus cajitas).
        </p>
        {CONTACT_EMAIL ? (
          <a className="primary button-link full" href={mailto}>
            ✉ Escribir a {CONTACT_EMAIL}
          </a>
        ) : (
          <button
            className="primary full"
            onClick={() => openExternal(ISSUES_URL)}
          >
            Escribir un comentario ↗
          </button>
        )}
        {errors.length > 0 && (
          <button
            className="text-button full"
            onClick={() => {
              clearErrors();
              setErrors([]);
              notify("Listo, borramos el registro de errores.");
            }}
          >
            Borrar el registro de errores ({errors.length})
          </button>
        )}
      </div>
      <div className="panel help-faq">
        <h2>Preguntas frecuentes</h2>
        {QUESTIONS.map(([question, answer]) => (
          <details key={question}>
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
      <p className="small-text muted help-footer">
        Guardadito {APP_VERSION} ·{" "}
        <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
          Aviso de privacidad
        </a>
      </p>
    </section>
  );
}
