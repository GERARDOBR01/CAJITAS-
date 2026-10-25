import { useState } from "react";
import { authMessage } from "../cloud/sync.js";
import { balance, money, today } from "../domain.js";
import { isNative, openExternal, saveFile } from "../platform.js";
import Modal from "./Modal.jsx";
import { forgetThisPhone } from "../journal/forget.js";

const lib = () => import("../cloud/firebase.js");

const STATUS = {
  loading: "Revisando tu cuenta…",
  syncing: "Guardando en tu cuenta…",
  synced: "✓ Tus cajitas están guardadas en tu cuenta.",
  waiting: "Elige qué cajitas usar para continuar.",
  offline: "Sin conexión: tus cambios se suben cuando vuelva el internet.",
  error:
    "No pudimos llegar a tu cuenta. Tus cajitas siguen en este teléfono; lo intentamos de nuevo solitos en un ratito.",
  full: "Tu historial ya no cabe en tu cuenta: tus cambios se quedan en este teléfono. Descarga un respaldo y escríbenos desde Ayuda y comentarios.",
};

const PRIVACY_URL = "https://gerardobr01.github.io/CAJITAS-/privacidad.html";
function PrivacyLink() {
  return (
    <a
      className="small-text privacy-link"
      href={PRIVACY_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={
        isNative
          ? (e) => {
              e.preventDefault();
              openExternal(PRIVACY_URL);
            }
          : undefined
      }
    >
      Aviso de privacidad
    </a>
  );
}

export default function Account({ cloud, notify }) {
  const [mode, setMode] = useState("signin"),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false),
    [leaving, setLeaving] = useState(false),
    [verified, setVerified] = useState(false);
  const user = cloud.user;

  async function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim(),
      password = String(form.get("password") ?? ""),
      name = String(form.get("name") ?? "").trim();
    if (mode === "signup" && password.length < 8) {
      notify("Usa una contraseña de al menos 8 caracteres.");
      return;
    }
    setBusy(true);
    try {
      const { signIn, signUp, resetPassword } = await lib();
      if (mode === "reset") {
        await resetPassword(email);
        notify("Te mandamos un correo para crear una contraseña nueva.");
        setMode("signin");
      } else if (mode === "signup") {
        await signUp({ name, email, password });
        notify(
          `¡Listo${name ? `, ${name}` : ""}! Te mandamos un correo para confirmar tu cuenta.`,
        );
      } else await signIn({ email, password });
    } catch (error) {
      notify(authMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (!user)
    return (
      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">TU CUENTA</p>
            <h1>
              {mode === "signup"
                ? "Crea tu cuenta"
                : mode === "reset"
                  ? "Recupera tu contraseña"
                  : "Entra a tu cuenta"}
            </h1>
            <p className="muted">
              Con tu cuenta, tus cajitas se guardan en la nube y te siguen a
              cualquier teléfono.
            </p>
          </div>
        </div>
        <div className="panel account-panel">
          <form onSubmit={submit} key={mode}>
            {mode === "signup" && (
              <label>
                ¿Cómo te llamas?
                <input
                  name="name"
                  autoComplete="given-name"
                  maxLength={40}
                  placeholder="Tu nombre"
                />
              </label>
            )}
            <label>
              Correo
              <input
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                autoFocus
              />
            </label>
            {mode !== "reset" && (
              <label>
                Contraseña
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  minLength={mode === "signup" ? 8 : undefined}
                  required
                />
              </label>
            )}
            <button className="primary full" disabled={busy}>
              {busy
                ? "Un momento…"
                : mode === "signup"
                  ? "Crear mi cuenta"
                  : mode === "reset"
                    ? "Mandar correo"
                    : "Entrar"}
            </button>
          </form>
          <div className="account-links">
            {mode !== "signup" && (
              <button className="text-button" onClick={() => setMode("signup")}>
                ¿No tienes cuenta? Créala
              </button>
            )}
            {mode !== "signin" && (
              <button className="text-button" onClick={() => setMode("signin")}>
                Ya tengo cuenta
              </button>
            )}
            {mode === "signin" && (
              <button className="text-button" onClick={() => setMode("reset")}>
                Olvidé mi contraseña
              </button>
            )}
          </div>
          <p className="small-text muted">
            Sin cuenta, Guardadito funciona igual que siempre y tus cajitas se
            quedan solo en este teléfono.
          </p>
          <PrivacyLink />
        </div>
      </section>
    );

  return (
    <section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">TU CUENTA</p>
          <h1>Hola{user.displayName ? `, ${user.displayName}` : ""} ♡</h1>
          <p className="muted">{user.email}</p>
        </div>
      </div>
      <div className="panel account-panel">
        <p role="status" className={`sync-status sync-${cloud.status}`}>
          {STATUS[cloud.status] ?? ""}
        </p>
        <p className="small-text muted">
          Guardadito lleva la cuenta de tu ahorro; tu dinero sigue en tu banco o
          con quien lo guarda.
        </p>
        {!user.emailVerified && !verified && (
          <div className="notice verify-notice">
            <p>
              <strong>Confirma tu correo.</strong> Te mandamos un enlace a{" "}
              {user.email}. Así podrás recuperar tu contraseña si la olvidas.
            </p>
            <div className="button-row">
              <button
                className="text-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const { refreshVerified } = await lib();
                    if (await refreshVerified()) {
                      setVerified(true);
                      notify("¡Correo confirmado! ✓");
                    } else notify("Todavía no vemos la confirmación.");
                  } catch (error) {
                    notify(authMessage(error));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Ya lo confirmé
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const { resendVerification } = await lib();
                    await resendVerification();
                    notify("Te lo mandamos otra vez. Revisa también spam.");
                  } catch (error) {
                    notify(authMessage(error));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Reenviar el correo
              </button>
            </div>
          </div>
        )}
        <div className="button-row">
          <button className="secondary" onClick={() => setLeaving(true)}>
            Cerrar sesión
          </button>
          <button className="text-button" onClick={() => setDeleting(true)}>
            Borrar mi cuenta
          </button>
        </div>
      </div>
      {leaving && (
        <Modal title="Cerrar sesión" onClose={() => !busy && setLeaving(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const wipe = new FormData(e.currentTarget).get("wipe") === "on";
              setBusy(true);
              try {
                if (wipe && !navigator.onLine) {
                  notify(
                    "Conéctate a internet para borrar las cajitas de este teléfono: así no se pierde ningún cambio.",
                  );
                  setBusy(false);
                  return;
                }
                const { unsaved } = await cloud.signOut();
                // Never erase the only copy of a change the account did not get.
                if (wipe && !unsaved) await forgetThisPhone();
                // Firebase starts fresh, without the previous person's copy.
                location.replace(`${location.pathname}?tab=account`);
              } catch (error) {
                notify(authMessage(error));
                setBusy(false);
              }
            }}
          >
            <p>
              Tus cajitas siguen guardadas en tu cuenta. Para verlas otra vez,
              entra con tu correo.
            </p>
            <label className="checkbox">
              <input type="checkbox" name="wipe" />
              Borrar también las cajitas de este teléfono (por ejemplo, si no es
              tuyo)
            </label>
            <button className="primary full" disabled={busy}>
              {busy ? "Cerrando…" : "Cerrar sesión"}
            </button>
            <button
              type="button"
              className="secondary full"
              disabled={busy}
              onClick={() => setLeaving(false)}
            >
              Cancelar
            </button>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Borrar tu cuenta"
          onClose={() => !busy && setDeleting(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await cloud.removeAccount(
                  String(new FormData(e.currentTarget).get("password") ?? ""),
                );
                setDeleting(false);
                notify(
                  "Cuenta borrada. Tus cajitas siguen solo en este teléfono.",
                );
              } catch (error) {
                notify(authMessage(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="notice">
              Se borran tu cuenta, la copia de tus cajitas en la nube y lo que
              tú registraste o mandaste en tu pareja (movimientos, sorpresas,
              CLABE y avisos). Las cajitas de este teléfono se quedan aquí. No
              se puede deshacer.
            </p>
            <label>
              Escribe tu contraseña para confirmar
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                autoFocus
              />
            </label>
            <button className="danger full" disabled={busy}>
              {busy ? "Borrando…" : "Sí, borrar mi cuenta"}
            </button>
            <button
              type="button"
              className="secondary full"
              disabled={busy}
              onClick={() => setDeleting(false)}
            >
              Cancelar
            </button>
          </form>
        </Modal>
      )}
      <PrivacyLink />
    </section>
  );
}

const summary = (data) =>
  `${data.goals.length} ${data.goals.length === 1 ? "cajita" : "cajitas"} · ${money(
    data.goals.reduce((sum, goal) => sum + balance(goal), 0),
  )}`;

/** First meeting of an account and a device that both have cajitas. */
export function SyncPrompt({ prompt, onChoose, notify }) {
  async function keepCopy() {
    try {
      await saveFile(
        JSON.stringify(prompt.local, null, 2),
        `cajitas-este-telefono-${today()}.json`,
      );
    } catch (error) {
      notify(error.message);
    }
  }
  if (prompt.kind === "ask-upload")
    return (
      <Modal title="¿Subimos tus cajitas?" onClose={() => onChoose("cancel")}>
        <p>
          En este teléfono tienes <strong>{summary(prompt.local)}</strong>.
          Súbelas a tu cuenta para que te sigan a cualquier teléfono.
        </p>
        <button className="primary full" onClick={() => onChoose("device")}>
          Subir mis cajitas
        </button>
        <button className="secondary full" onClick={() => onChoose("cancel")}>
          Ahora no (cerrar sesión)
        </button>
      </Modal>
    );
  return (
    <Modal title="¿Qué cajitas usamos?" onClose={() => onChoose("cancel")}>
      <p>
        Tu cuenta tiene <strong>{summary(prompt.remote)}</strong> y este
        teléfono tiene <strong>{summary(prompt.local)}</strong>.
      </p>
      <p className="notice">
        Las que no elijas se reemplazan. Si quieres conservar las de este
        teléfono, descarga primero un respaldo.
      </p>
      <button className="text-button" onClick={keepCopy}>
        ↓ Descargar respaldo de este teléfono
      </button>
      <button className="primary full" onClick={() => onChoose("account")}>
        Usar las de mi cuenta
      </button>
      <button className="secondary full" onClick={() => onChoose("device")}>
        Usar las de este teléfono
      </button>
    </Modal>
  );
}
