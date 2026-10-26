import { useState } from "react";
import { money } from "../domain.js";
import { compressImage } from "../cloud/image.js";
import { normalizeCode } from "../cloud/partner.js";
import Modal from "./Modal.jsx";
import { DepositInbox, MyDeposits, PayoutForm } from "./Guardian.jsx";
import Notices from "./Notices.jsx";
import { pushConfigured } from "../cloud/config.js";

const WHEN = {
  open: "Al abrir la app",
  save: "La próxima vez que ahorre",
  date: "En una fecha",
};
const BASE_URL = `${location.origin}${import.meta.env.BASE_URL}`;

function percent(goal) {
  return goal.targetCents
    ? Math.min(100, Math.round((goal.savedCents / goal.targetCents) * 100))
    : 0;
}

function Invite({ partner, notify, initialCode }) {
  const code = partner.invite,
    [typed, setTyped] = useState(initialCode ?? ""),
    [busy, setBusy] = useState(false);
  const link = code ? `${BASE_URL}?pareja=${code}` : "";
  async function share() {
    const text = `Únete a mi Guardadito 💞 Mi código es ${code}: ${link}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        notify("Copiado. Pégalo en WhatsApp.");
      }
    } catch {
      /* Share sheet closed. */
    }
  }
  return (
    <>
      <div className="panel partner-panel">
        <h2>Invita a tu pareja</h2>
        <p className="muted">
          Crea un código y compártelo. Dura 2 días y solo sirve para vincular
          sus dos cuentas.
        </p>
        {code ? (
          <>
            <p className="partner-code" aria-label={`Tu código es ${code}`}>
              {code}
            </p>
            <div className="button-row">
              <button className="primary" onClick={share}>
                Compartir código
              </button>
              <button
                className="text-button"
                onClick={() => partner.cancelInvite().catch(() => {})}
              >
                Cancelar código
              </button>
            </div>
          </>
        ) : (
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await partner.createInvite();
              } catch {
                /* notified */
              } finally {
                setBusy(false);
              }
            }}
          >
            Crear mi código
          </button>
        )}
      </div>
      <form
        className="panel partner-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await partner.accept(typed);
          } catch {
            /* notified */
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>¿Te mandaron un código?</h2>
        <label>
          Código de tu pareja
          <input
            name="code"
            value={typed}
            onChange={(e) => setTyped(normalizeCode(e.target.value))}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="ABC234"
            required
          />
        </label>
        <button className="primary full" disabled={busy || typed.length < 6}>
          Vincular
        </button>
      </form>
      <p className="small-text muted partner-privacy">
        Al vincularse, cada quien ve el nombre y el avance de las cajitas del
        otro, no sus movimientos.
      </p>
    </>
  );
}

function PetGift({ partner, name }) {
  const current = partner.sent.find((g) => g.kind === "pet");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="panel partner-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const lines = String(form.get("lines"))
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, 8);
        setBusy(true);
        try {
          await partner.send(
            {
              kind: "pet",
              lines,
              loveText: String(form.get("loveText")).trim(),
              motto: String(form.get("motto")).trim(),
            },
            `pet-${partner.partnerUid}`,
            current
              ? "Cookie ya habla con tus nuevas palabras."
              : `Le mandaste a Cookie a ${name} 🐱`,
          );
        } catch {
          /* notified */
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>🐱 Cookie, con tus palabras</h2>
      <p className="muted">
        Cookie solo aparece para quien la recibe. Dice tus frases cada ratito y,
        al tocarla, tu mensaje con lluvia de corazones.
      </p>
      <label>
        Lo que dice cada ratito (una frase por línea)
        <textarea
          name="lines"
          rows={3}
          maxLength={8 * 41}
          defaultValue={(current?.lines ?? []).join("\n")}
          placeholder={"¡Muack!\nMuack muack"}
          required
        />
      </label>
      <label>
        Lo que dice al tocarla
        <input
          name="loveText"
          maxLength={60}
          defaultValue={current?.loveText ?? ""}
          placeholder={`¡Te quiero, ${name}!`}
          required
        />
      </label>
      <label>
        Su frase (opcional)
        <input
          name="motto"
          maxLength={80}
          defaultValue={current?.motto ?? ""}
          placeholder="Aquí estoy para cuidar tus sueños."
        />
      </label>
      <button className="primary full" disabled={busy}>
        {current ? "Actualizar a Cookie" : `Mandarle a Cookie`}
      </button>
      {current && (
        <p className="small-text muted">
          {current.openedAt
            ? `✓ ${name} ya conoció a Cookie.`
            : "💌 Aún no la abre."}
        </p>
      )}
    </form>
  );
}

function Notes({ partner, name }) {
  const [when, setWhen] = useState("open"),
    [busy, setBusy] = useState(false);
  const notes = partner.sent
    .filter((g) => g.kind === "note")
    .sort((a, b) => b.createdAt - a.createdAt);
  return (
    <form
      className="panel partner-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        setBusy(true);
        try {
          await partner.send(
            {
              kind: "note",
              text: String(data.get("text")).trim(),
              showOn: when,
              ...(when === "date" && { date: String(data.get("date")) }),
            },
            undefined,
            "Notita enviada 💌",
          );
          form.reset();
          setWhen("open");
        } catch {
          /* notified */
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>💌 Notitas</h2>
      <label>
        Tu notita para {name}
        <textarea name="text" rows={3} maxLength={600} required />
      </label>
      <label>
        ¿Cuándo la ve?
        <select value={when} onChange={(e) => setWhen(e.target.value)}>
          {Object.entries(WHEN).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {when === "date" && (
        <label>
          Fecha
          <input name="date" type="date" required />
        </label>
      )}
      <button className="primary full" disabled={busy}>
        Mandar notita
      </button>
      {notes.length > 0 && (
        <ul className="partner-list" aria-label="Notitas enviadas">
          {notes.map((n) => (
            <li key={n.id}>
              <span>
                <strong>{n.text}</strong>
                <small>
                  {n.openedAt
                    ? "✓ La leyó"
                    : `💌 ${n.showOn === "date" ? `El ${n.date}` : WHEN[n.showOn]}`}
                </small>
              </span>
              <button
                type="button"
                className="text-button"
                aria-label="Borrar notita"
                onClick={() => partner.remove(n.id).catch(() => {})}
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

function Rewards({ partner, name, notify }) {
  const [image, setImage] = useState(""),
    [busy, setBusy] = useState(false);
  const goals = partner.summary;
  const rewards = partner.sent.filter((g) => g.kind === "reward");
  if (!goals.length)
    return (
      <div className="panel partner-panel">
        <h2>🎁 Premios por meta</h2>
        <p className="muted">
          Cuando {name} tenga una cajita podrás dejarle un premio que se abre al
          llegar al 25, 50 o 100 %.
        </p>
      </div>
    );
  return (
    <form
      className="panel partner-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        const goal = goals.find((g) => g.id === data.get("goal"));
        setBusy(true);
        try {
          await partner.send(
            {
              kind: "reward",
              goalId: goal.id,
              goalName: goal.name,
              threshold: Number(data.get("threshold")),
              title: String(data.get("title")).trim(),
              text: String(data.get("text")).trim(),
              ...(image && { image }),
            },
            undefined,
            "Premio guardado. Se abre cuando llegue a su meta 🎁",
          );
          form.reset();
          setImage("");
        } catch {
          /* notified */
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>🎁 Premios por meta</h2>
      <p className="muted">
        {name} solo ve que hay una sorpresa esperando; se abre al llegar al
        porcentaje.
      </p>
      <label>
        Cajita
        <select name="goal" required>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} · {percent(g)} %
            </option>
          ))}
        </select>
      </label>
      <label>
        Se abre al llegar al
        <select name="threshold" defaultValue="50">
          <option value="25">25 %</option>
          <option value="50">50 %</option>
          <option value="100">100 %</option>
        </select>
      </label>
      <label>
        Título
        <input
          name="title"
          maxLength={60}
          placeholder="Cupón para una cita"
          required
        />
      </label>
      <label>
        Mensaje
        <textarea name="text" rows={3} maxLength={600} required />
      </label>
      <label>
        Foto (opcional)
        <input
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files[0];
            if (!file) return setImage("");
            try {
              setImage(await compressImage(file));
            } catch (error) {
              e.target.value = "";
              notify(error.message);
            }
          }}
        />
      </label>
      {image && <img className="reward-preview" src={image} alt="" />}
      <button className="primary full" disabled={busy}>
        Guardar premio
      </button>
      {rewards.length > 0 && (
        <ul className="partner-list" aria-label="Premios guardados">
          {rewards.map((r) => (
            <li key={r.id}>
              <span>
                <strong>{r.title}</strong>
                <small>
                  {r.openedAt
                    ? "✓ Ya lo abrió"
                    : `🎁 Al ${r.threshold} % de ${r.goalName}`}
                </small>
              </span>
              <button
                type="button"
                className="text-button"
                aria-label="Borrar premio"
                onClick={() => partner.remove(r.id).catch(() => {})}
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

export default function Partner({
  cloud,
  partner,
  notify,
  onNavigate,
  initialCode,
}) {
  const [leaving, setLeaving] = useState(false);
  const name = partner.partnerName || "tu pareja";
  if (!cloud.user)
    return (
      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">EN PAREJA</p>
            <h1>Ahorren juntos 💞</h1>
            <p className="muted">
              Primero entra a tu cuenta; luego vinculas la de tu pareja.
            </p>
          </div>
        </div>
        <button className="primary" onClick={() => onNavigate("account")}>
          Ir a Mi cuenta
        </button>
      </section>
    );
  if (!partner.pair)
    return (
      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">EN PAREJA</p>
            <h1>Ahorren juntos 💞</h1>
            <p className="muted">
              Vincula tu cuenta con la de tu pareja para tener cajitas de los
              dos y ver cómo va cada quien.
            </p>
          </div>
        </div>
        <Invite partner={partner} notify={notify} initialCode={initialCode} />
      </section>
    );
  const opened = partner.received
    .filter((g) => g.kind === "note" && g.openedAt)
    .sort((a, b) => b.openedAt - a.openedAt);
  return (
    <section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">EN PAREJA</p>
          <h1>Tú y {name} 💞</h1>
        </div>
      </div>
      <div className="panel partner-panel">
        <h2>Cómo va {name}</h2>
        {partner.summary.length ? (
          <ul className="partner-list" aria-label={`Cajitas de ${name}`}>
            {partner.summary.map((g) => (
              <li key={g.id}>
                <span>
                  <strong>{g.name}</strong>
                  <small>
                    {money(g.savedCents)} de {money(g.targetCents)}
                  </small>
                </span>
                <span className="partner-percent">{percent(g)} %</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Aún no tiene cajitas.</p>
        )}
      </div>
      {partner.waiting.length > 0 && (
        <div className="panel partner-panel">
          <h2>🎁 Te esperan sorpresas</h2>
          <ul className="partner-list">
            {partner.waiting.map((g) => (
              <li key={g.id}>
                Al {g.threshold} % de «{g.goal.name}»
              </li>
            ))}
          </ul>
        </div>
      )}
      {partner.extras && (
        <>
          <DepositInbox partner={partner} name={name} />
          <MyDeposits partner={partner} name={name} />
        </>
      )}
      {pushConfigured && (
        <Notices
          pairId={partner.pair.id}
          uid={cloud.user.uid}
          name={name}
          notify={notify}
        />
      )}
      {!partner.extras && (
        <p className="muted partner-hint">
          Creen cajitas de los dos desde el inicio: cada quien aparta su parte
          en su propio banco.
        </p>
      )}
      {partner.extras && (
        <>
          <h2 className="partner-subtitle">Para {name}</h2>
          <PetGift partner={partner} name={name} />
          <Notes partner={partner} name={name} />
          <Rewards partner={partner} name={name} notify={notify} />
          <PayoutForm partner={partner} name={name} />
        </>
      )}
      {opened.length > 0 && (
        <div className="panel partner-panel">
          <h2>Notitas de {name} para ti</h2>
          <ul className="partner-list">
            {opened.map((n) => (
              <li key={n.id}>{n.text}</li>
            ))}
          </ul>
        </div>
      )}
      <button className="text-button" onClick={() => setLeaving(true)}>
        Deshacer el vínculo
      </button>
      {leaving && (
        <Modal title="Deshacer el vínculo" onClose={() => setLeaving(false)}>
          <p className="notice">
            Dejarán de verse las cajitas y se borran las sorpresas que tú
            mandaste. Tus cajitas no cambian.
          </p>
          <button
            className="danger full"
            onClick={async () => {
              await partner.unpair().catch(() => {});
              setLeaving(false);
            }}
          >
            Sí, deshacer
          </button>
          <button className="secondary full" onClick={() => setLeaving(false)}>
            Cancelar
          </button>
        </Modal>
      )}
    </section>
  );
}
