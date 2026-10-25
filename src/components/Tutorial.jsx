import { useEffect, useRef, useState } from "react";
import Mascot from "./Mascot.jsx";
import Illustration from "./Illustration.jsx";
import Modal from "./Modal.jsx";
import {
  balance,
  cents,
  countdown,
  estimate,
  localDate,
  money,
  plan,
  today,
} from "../domain.js";
import { PETS, availablePets } from "../pet/catalog.js";
import { ANDROID_DOWNLOAD_URL } from "../downloads.js";
import { RHYTHM_LABEL, rhythmLabel } from "../calendar.js";
import { isNative } from "../platform.js";
import { ownerTools } from "../features.js";
import "../tutorial.css";

const lessons = [
  [
    "Tu espacio",
    "Un sueño, una cajita",
    "Guardadito es tu diario de ahorro. Tu dinero se queda en la app donde lo guardas; aquí organizas metas y registras tus pasitos.",
  ],
  [
    "Tu meta",
    "Dale una casita a tu sueño",
    "Elige nombre, monto, fecha de compromiso y dónde guardas el dinero. El plan te orienta sobre cuánto apartar a tu ritmo.",
  ],
  [
    "Ahorrar",
    "Primero aparta. Después registra",
    "En tu app externa apartas el dinero. En Guardadito tocas Registrar ahorro y capturas lo que ya apartaste, con su fecha real.",
  ],
  [
    "El candado",
    "Un compromiso contigo",
    "La cuenta regresiva te recuerda tu fecha. El candado es de compromiso, no bancario: tu dinero sigue disponible fuera de Guardadito.",
  ],
  [
    "Tu mascota",
    "Una compañía a tu ritmo",
    "Elige a tu compañero (cerdito, vaquita, conejito, shiba, nutria o cajita), ponle nombre y un accesorio. Tu compañía cuenta aunque hoy no apartes dinero.",
  ],
  [
    "Herramientas",
    "Todo en su lugar",
    ownerTools
      ? "En Más encuentras rendimiento, conexiones y respaldo. Actividad reúne tus registros; estas herramientas te ayudan a cuidarlos."
      : "Actividad reúne tus registros y en Más encuentras tu cuenta y el respaldo. Así cuidas tus pasitos.",
  ],
  [
    "Tu app",
    "Llévanos contigo",
    "Instala Guardadito y úsala aunque no tengas internet. Con tu cuenta, tus cajitas te siguen a cualquier teléfono.",
  ],
  [
    "A tu ritmo",
    "Ya sabes cuidar tus sueños",
    "Repasa tres ideas importantes. Después puedes abrir tu primera cajita real o volver a las que ya tienes.",
  ],
];
const questions = [
  {
    title: "¿Dónde está tu dinero?",
    options: ["En mi app externa", "Dentro de Guardadito"],
    correct: 0,
  },
  {
    title: "¿Una visita a mi mascota suma dinero?",
    options: ["Sí, es un depósito", "No, cuenta como compañía"],
    correct: 1,
  },
  {
    title: "Cambié de teléfono. ¿Cómo recupero mis cajitas?",
    options: [
      "Entro con mi cuenta o importo mi respaldo",
      "Aparecen solas sin hacer nada",
    ],
    correct: 0,
  },
];
function futureDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return localDate(date);
}
function demoGoal() {
  return {
    name: "Mi escapadita",
    targetCents: 100000,
    unlockDate: futureDate(),
    provider: "Nu",
    frequency: 7,
    entries: [],
  };
}

function PracticeCard({ goal }) {
  const saved = balance(goal),
    percent = Math.min(100, Math.round((saved / goal.targetCents) * 100));
  return (
    <div className="tutorial-goal" role="group" aria-label="Cajita de práctica">
      <div>
        <span>✦ CAJITA DE PRÁCTICA</span>
        <span>{goal.provider}</span>
      </div>
      <h3>{goal.name}</h3>
      <p>
        <strong>{money(saved)}</strong> de {money(goal.targetCents)}
      </p>
      <div
        className="progress"
        role="progressbar"
        aria-label="Progreso de la cajita de práctica"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <small>
        {percent === 100
          ? "¡Meta de ejemplo alcanzada!"
          : `Te faltan ${money(Math.max(0, goal.targetCents - saved))}`}{" "}
        · dinero de ejemplo
      </small>
    </div>
  );
}

export default function Tutorial({ preferences, onNavigate, onCreate }) {
  const [step, setStep] = useState(0),
    [goal, setGoal] = useState(demoGoal),
    [name, setName] = useState("Mi escapadita"),
    [target, setTarget] = useState("1000"),
    [date, setDate] = useState(futureDate),
    [provider, setProvider] = useState("Nu"),
    [frequency, setFrequency] = useState("7"),
    [amount, setAmount] = useState("100"),
    [movementDate, setMovementDate] = useState(today),
    [feedback, setFeedback] = useState(""),
    [pet, setPet] = useState(preferences.pet),
    [accessory, setAccessory] = useState(preferences.accessory),
    [visited, setVisited] = useState(false),
    [tool, setTool] = useState("activity"),
    [receiptLinked, setReceiptLinked] = useState(false),
    [backupOpen, setBackupOpen] = useState(false),
    [rate, setRate] = useState(""),
    [phone, setPhone] = useState("android"),
    [answers, setAnswers] = useState({}),
    [reviewed, setReviewed] = useState(false),
    [paused, setPaused] = useState(!preferences.animations),
    [withdrawOpen, setWithdrawOpen] = useState(false),
    [celebrating, setCelebrating] = useState(false),
    [now, setNow] = useState(Date.now());
  const heading = useRef(),
    section = useRef(),
    celebrationTimer = useRef(),
    previousStep = useRef(0);
  const saved = balance(goal),
    withdrawCents = Math.min(2000, saved),
    complete = saved >= goal.targetCents;
  const correctCount = questions.filter(
    (q, i) => answers[i] === q.correct,
  ).length;
  useEffect(() => {
    if (step !== previousStep.current) {
      const target =
        step === 0
          ? section.current
          : heading.current?.closest(".tutorial-lesson");
      target?.scrollIntoView({ behavior: "instant", block: "start" });
      heading.current?.focus({ preventScroll: true });
      previousStep.current = step;
    }
  }, [step]);
  useEffect(() => {
    if (step !== 3) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step]);
  useEffect(() => () => clearTimeout(celebrationTimer.current), []);
  function go(index) {
    setStep(index);
    setFeedback("");
    setWithdrawOpen(false);
  }
  function deposit(value, at = new Date().toISOString()) {
    if (!Number.isSafeInteger(saved + value))
      throw new Error("Reinicia la práctica para seguir probando.");
    setGoal({
      ...goal,
      entries: [
        ...goal.entries,
        { id: crypto.randomUUID(), cents: value, at, source: "manual" },
      ],
    });
    setReceiptLinked(false);
  }
  function create(e) {
    e.preventDefault();
    try {
      if (!name.trim() || !date || date < today())
        throw new Error("Elige un nombre y una fecha de hoy en adelante.");
      setGoal({
        ...goal,
        name: name.trim(),
        targetCents: cents(target),
        unlockDate: date,
        provider,
        frequency: Number(frequency),
      });
      setFeedback(
        "¡Tu cajita de práctica está lista! En la app harías lo mismo con Crear cajita.",
      );
    } catch (e) {
      setFeedback(e.message);
    }
  }
  function record(e) {
    e.preventDefault();
    try {
      if (!movementDate || movementDate > today())
        throw new Error("Elige una fecha de hoy o anterior.");
      const value = cents(amount);
      deposit(
        value,
        movementDate === today()
          ? new Date().toISOString()
          : new Date(`${movementDate}T12:00:00`).toISOString(),
      );
      setFeedback(
        `${money(value)} registrados en la práctica. En tu cajita real, registra solo lo que ya apartaste.`,
      );
    } catch (e) {
      setFeedback(e.message);
    }
  }
  function celebrate() {
    if (!complete) deposit(goal.targetCents - saved);
    setCelebrating(true);
    clearTimeout(celebrationTimer.current);
    celebrationTimer.current = setTimeout(() => setCelebrating(false), 5000);
    setFeedback(
      "¡Meta de ejemplo alcanzada! En tus cajitas celebramos al llegar al 100% de ahorro registrado.",
    );
  }
  let preview = null;
  try {
    if (date >= today())
      preview = plan(
        { ...goal, targetCents: cents(target), unlockDate: date },
        Number(frequency),
      );
  } catch {
    /* Wait for a valid amount. */
  }
  function reset() {
    clearTimeout(celebrationTimer.current);
    setGoal(demoGoal());
    setName("Mi escapadita");
    setTarget("1000");
    setDate(futureDate());
    setProvider("Nu");
    setFrequency("7");
    setAmount("100");
    setMovementDate(today());
    setPet(preferences.pet);
    setAccessory(preferences.accessory);
    setVisited(false);
    setTool("activity");
    setReceiptLinked(false);
    setBackupOpen(false);
    setRate("");
    setAnswers({});
    setReviewed(false);
    setCelebrating(false);
    setPhone("android");
    go(0);
  }
  return (
    <section
      ref={section}
      className={`tutorial ${paused ? "tutorial-paused" : ""}`}
      aria-label="Tutorial interactivo de Guardadito"
    >
      <div
        className={`section-heading tutorial-heading ${step === 0 ? "tutorial-with-art" : ""}`}
      >
        <div>
          <p className="eyebrow">APRENDE JUGANDO, A TU RITMO</p>
          <h1>Un paseíto por Guardadito</h1>
          <p className="muted">
            Toca, prueba y descubre. Puedes volver cuando quieras.
          </p>
          {step === 0 && (
            <button className="primary tutorial-start" onClick={() => go(1)}>
              Empezar a practicar
            </button>
          )}
        </div>
        {step === 0 && (
          <Illustration kind="welcome" className="tutorial-header-art" />
        )}
      </div>
      <div className="tutorial-toolbar">
        <span className="tutorial-demo-badge">
          ✿ Modo práctica · datos de ejemplo
        </span>
        <button
          className="text-button"
          aria-pressed={paused}
          onClick={() => setPaused(!paused)}
        >
          {paused ? "Activar animaciones" : "Pausar animaciones"}
        </button>
      </div>
      <p className="tutorial-boundary">
        Tus cajitas y tu dinero no cambian durante esta práctica. Al salir o
        recargar, la demostración empieza de nuevo.
      </p>
      <nav className="tutorial-steps" aria-label="Pasos del tutorial">
        <ol>
          {lessons.map(([label], i) => (
            <li key={label}>
              <button
                aria-label={`Paso ${i + 1}: ${label}`}
                aria-current={step === i ? "step" : undefined}
                onClick={() => go(i)}
              >
                <span>{i + 1}</span>
                <small>{label}</small>
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <div className="tutorial-progress">
        <span>
          Paso {step + 1} de {lessons.length}
        </span>
        <div
          className="progress"
          role="progressbar"
          aria-label="Recorrido del tutorial"
          aria-valuenow={step + 1}
          aria-valuemin={0}
          aria-valuemax={lessons.length}
        >
          <span style={{ width: `${((step + 1) / lessons.length) * 100}%` }} />
        </div>
      </div>
      <article className="panel tutorial-lesson" key={step}>
        <div className="tutorial-lesson-heading">
          <span className="tutorial-number" aria-hidden="true">
            {step + 1}
          </span>
          <div>
            <p className="eyebrow">{lessons[step][0]}</p>
            <h2 ref={heading} tabIndex={-1}>
              {lessons[step][1]}
            </h2>
          </div>
        </div>
        <p className="tutorial-explanation">{lessons[step][2]}</p>
        {step === 0 && (
          <>
            <div className="tutorial-welcome">
              <div className="tutorial-speech">
                Un poquito hoy.
                <br />
                <strong>Un sueño mañana.</strong>
              </div>
            </div>
            <ol className="tutorial-flow">
              <li>
                <span aria-hidden="true">♡</span>
                <strong>Tu app externa</strong>
                <small>Aquí se guarda el dinero</small>
              </li>
              <li>
                <span aria-hidden="true">✎</span>
                <strong>Tus cajitas</strong>
                <small>Aquí llevas el registro</small>
              </li>
              <li>
                <span aria-hidden="true">✿</span>
                <strong>Tu compañero</strong>
                <small>Crece contigo</small>
              </li>
            </ol>
            <p className="notice">
              No custodiamos dinero ni hacemos transferencias. Tus metas se
              guardan en este teléfono, y en tu cuenta si creas una.
            </p>
          </>
        )}
        {step === 1 && (
          <div className="tutorial-practice-layout">
            <form onSubmit={create}>
              <label>
                Nombre de la meta de práctica
                <input
                  value={name}
                  maxLength={80}
                  required
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Meta de práctica (MXN)
                <input
                  type="number"
                  min="0.01"
                  max="1000000000"
                  step="0.01"
                  value={target}
                  required
                  onChange={(e) => setTarget(e.target.value)}
                />
              </label>
              <div className="form-row">
                <label>
                  Fecha de compromiso de práctica
                  <input
                    type="date"
                    min={today()}
                    value={date}
                    required
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
                <label>
                  App externa de práctica
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                  >
                    <option>Nu</option>
                    <option>Mercado Pago</option>
                    <option>Otra</option>
                  </select>
                </label>
              </div>
              <label>
                Ritmo de práctica
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                >
                  <option value="7">{RHYTHM_LABEL.weekly}</option>
                  <option value="15">{RHYTHM_LABEL.biweekly}</option>
                  <option value="30">{RHYTHM_LABEL.monthly}</option>
                </select>
              </label>
              {preview !== null && (
                <div className="plan-preview">
                  <span aria-hidden="true">🌱</span>
                  <div>
                    <strong>
                      {money(preview)} {rhythmLabel(Number(frequency))}
                    </strong>
                    <p>
                      Una guía para la meta de ejemplo. Puedes ajustar fecha y
                      monto; no es un cargo automático.
                    </p>
                  </div>
                </div>
              )}
              <button className="primary full">Crear cajita de práctica</button>
            </form>
            <PracticeCard goal={goal} />
          </div>
        )}
        {step === 2 && (
          <>
            <div className="tutorial-instruction">
              <span aria-hidden="true">1</span>
              <p>
                En tu app externa, aparta lo que puedas. Volver aquí no realiza
                una transferencia.
              </p>
            </div>
            <div className="tutorial-instruction">
              <span aria-hidden="true">2</span>
              <p>
                Toca <strong>Registrar ahorro</strong>, captura monto y fecha, y
                confirma. Los montos rápidos solo rellenan el campo.
              </p>
            </div>
            <form onSubmit={record}>
              <label>
                Ahorro de práctica (MXN)
                <input
                  type="number"
                  min="0.01"
                  max="1000000000"
                  step="0.01"
                  value={amount}
                  required
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <div className="quick-amounts">
                {[50, 100, 200].map((n) => (
                  <button
                    type="button"
                    key={n}
                    onClick={() => setAmount(String(n))}
                  >
                    {money(n * 100)}
                  </button>
                ))}
              </div>
              <label>
                Fecha del depósito de práctica
                <input
                  type="date"
                  max={today()}
                  value={movementDate}
                  required
                  onChange={(e) => setMovementDate(e.target.value)}
                />
              </label>
              <button className="primary full">
                Registrar depósito de práctica
              </button>
            </form>
            <PracticeCard goal={goal} />
            <p className="tutorial-tip">
              En la app, Ir a apartar abre el sitio oficial del proveedor. Si ya
              lo capturaste, no lo registres otra vez.
            </p>
          </>
        )}
        {step === 3 && (
          <>
            <div className="tutorial-lock-scene">
              <Mascot
                pet={pet}
                accessory={accessory}
                progress={saved / goal.targetCents}
                celebrating={celebrating}
                small
              />
              <div>
                <span aria-hidden="true">
                  {goal.unlockDate > today() ? "♧" : "✓"}
                </span>
                <strong>{countdown(goal.unlockDate, now)}</strong>
                <small>
                  Fecha de compromiso:{" "}
                  {new Date(`${goal.unlockDate}T12:00:00`).toLocaleDateString(
                    "es-MX",
                  )}
                </small>
              </div>
            </div>
            <PracticeCard goal={goal} />
            {!saved && (
              <button
                className="secondary full"
                onClick={() => {
                  deposit(10000);
                  setFeedback(
                    "Agregamos $100 de ejemplo para probar el candado.",
                  );
                }}
              >
                Preparar $100 de ejemplo
              </button>
            )}
            {goal.unlockDate <= today() && (
              <button
                className="secondary full"
                onClick={() => {
                  setGoal({ ...goal, unlockDate: futureDate() });
                  setDate(futureDate());
                  setFeedback(
                    "Usamos una fecha de compromiso dentro de 30 días para esta prueba.",
                  );
                }}
              >
                Usar un compromiso de 30 días
              </button>
            )}
            <div className="tutorial-action-grid">
              <button
                className="secondary"
                disabled={!saved}
                onClick={() => setWithdrawOpen(true)}
              >
                Probar retiro de {money(withdrawCents)}
              </button>
              <button className="primary" onClick={celebrate}>
                {complete
                  ? "Repetir celebración"
                  : "Completar meta de práctica"}
              </button>
            </div>
            {celebrating && (
              <div className="tutorial-confetti" aria-hidden="true">
                {Array.from({ length: 12 }, (_, i) => (
                  <span key={i} style={{ "--piece": i }}>
                    {i % 2 ? "✿" : "✦"}
                  </span>
                ))}
              </div>
            )}
            <p className="tutorial-tip">
              Puedes registrar un retiro cuando lo necesites, antes o después de
              la fecha: usar tu ahorro para una emergencia también es cumplir su
              propósito. Tu compañero sigue tranquilo contigo. Llegar al monto
              celebra tu progreso; no mueve dinero.
            </p>
          </>
        )}
        {step === 4 && (
          <>
            <div className="tutorial-pet-stage">
              <Mascot
                pet={pet}
                accessory={accessory}
                progress={visited ? 0.5 : 0}
                interactive
                onPet={() =>
                  setFeedback(
                    "¡Un abrazo de tu compañero! Tocar la mascota no registra dinero.",
                  )
                }
              />
              <p className="tutorial-speech">
                {visited ? "Qué bonito verte hoy ♡" : PETS[pet].motto}
              </p>
            </div>
            <div
              className="tutorial-pets"
              role="group"
              aria-label="Mascotas de práctica"
            >
              {availablePets(preferences)
                .map((key) => [key, PETS[key]])
                .map(([key, spec]) => (
                  <button
                    aria-pressed={pet === key}
                    key={key}
                    onClick={() => setPet(key)}
                  >
                    <Mascot pet={key} small />
                    <span>{spec.label}</span>
                  </button>
                ))}
            </div>
            <div className="tutorial-accessories">
              {[
                ["leaf", "Brote"],
                ["bow", "Moñito"],
                ["scarf", "Bufanda"],
                ["star", "Estrella"],
              ].map(([key, label]) => (
                <button
                  aria-pressed={accessory === key}
                  key={key}
                  onClick={() => setAccessory(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              className="primary full"
              disabled={visited}
              onClick={() => {
                setVisited(true);
                setFeedback(
                  `Visita de práctica guardada. Tu ahorro de ejemplo sigue en ${money(saved)}.`,
                );
              }}
            >
              {visited
                ? "♡ Ya nos acompañamos en la práctica"
                : "Visitar a mi mascota de práctica"}
            </button>
            <p className="tutorial-tip">
              En Mi mascota guardas el nombre, accesorio y recordatorio. Un día
              de visita o depósito cuenta una sola vez para la compañía; los
              pesos no miden tu amistad.
            </p>
          </>
        )}
        {step === 5 && (
          <>
            <div
              className="tutorial-tools"
              role="group"
              aria-label="Explorar herramientas"
            >
              {[
                ["activity", "Actividad"],
                ownerTools && ["rates", "Rendimiento"],
                ownerTools && ["connections", "Conexiones"],
                ["backup", "Respaldo"],
              ]
                .filter(Boolean)
                .map(([key, label]) => (
                <button
                  key={key}
                  aria-pressed={tool === key}
                  onClick={() => {
                    setTool(key);
                    setFeedback("");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="tutorial-tool-content">
              {tool === "activity" && (
                <>
                  <Illustration kind="activity" />
                  <h3>Tu historia, en un solo lugar</h3>
                  <p>
                    Filtra por cajita y mes. Exportar CSV descarga los
                    movimientos del filtro. Usa Corregir para arreglar un
                    registro manual; para un retiro real, usa Registrar retiro.
                  </p>
                  <details>
                    <summary>
                      Ver movimientos de la práctica ({goal.entries.length})
                    </summary>
                    <ul className="tutorial-ledger">
                      {goal.entries.length ? (
                        [...goal.entries].reverse().map((entry) => (
                          <li key={entry.id}>
                            <span>
                              {new Date(entry.at).toLocaleDateString("es-MX")}
                            </span>
                            <strong>
                              {entry.cents > 0 ? "+" : ""}
                              {money(entry.cents)}
                            </strong>
                          </li>
                        ))
                      ) : (
                        <li>
                          Registra un depósito en el paso Ahorrar para verlo
                          aquí.
                        </li>
                      )}
                    </ul>
                  </details>
                  <p className="tutorial-tip">
                    Archivar una cajita conserva sus registros. Puedes
                    recuperarla; no se borra ni se retira dinero.
                  </p>
                </>
              )}
              {tool === "rates" && (
                <>
                  <h3>Compara sin adivinar tasas</h3>
                  <p>
                    Rendimiento compara tu tasa capturada con TIIE y CETES 28 de
                    Banxico cuando la consulta está configurada. Si no hay
                    datos, se muestran como no disponibles.
                  </p>
                  <label>
                    Tasa anual para la práctica (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={rate}
                      placeholder="Captura una tasa"
                      onChange={(e) => setRate(e.target.value)}
                    />
                  </label>
                  <div className="tutorial-rate-preview">
                    {rate !== "" &&
                    Number.isFinite(Number(rate)) &&
                    Number(rate) >= 0 &&
                    Number(rate) <= 100 ? (
                      <p>
                        Con {money(100000)} y tu tasa de {rate}%, el interés
                        simple de ejemplo a 30 días sería{" "}
                        <strong>
                          {money(estimate(100000, Number(rate), 30))}
                        </strong>
                        .
                      </p>
                    ) : (
                      <p>
                        Captura una tasa para ver el cálculo. Esta práctica no
                        consulta ni inventa una tasa de referencia.
                      </p>
                    )}
                  </div>
                  <p className="tutorial-tip">
                    Estimación a tasa constante, base 365, antes de impuestos y
                    comisiones, sin reinversión. No es rendimiento garantizado.
                    TIIE es una referencia, no un producto de ahorro.
                  </p>
                </>
              )}
              {tool === "connections" && (
                <>
                  <h3>Un comprobante, un solo registro</h3>
                  <p>
                    En Conexiones puedes abrir un correo .eml descargado o pegar
                    su texto. Revisa cajita, monto y fecha antes de importar.
                    Funciona en este dispositivo, sin conectar el buzón; un
                    archivo no autentica al remitente.
                  </p>
                  <p>
                    Gmail se conecta con permiso de lectura para buscar
                    comprobantes de los remitentes configurados. Revisa la
                    detección y elige la cajita. Los patrones reales de Nu y
                    Mercado Pago aún están pendientes de validar.
                  </p>
                  <div className="tutorial-receipt">
                    <span>✉ EJEMPLO DE REVISIÓN</span>
                    <p>
                      Imagina que ya registraste $100 y llega un comprobante por
                      esos mismos $100. Vincularlos deja un solo registro, no
                      $200.
                    </p>
                    <button
                      className="secondary full"
                      disabled={receiptLinked}
                      onClick={() => {
                        setReceiptLinked(true);
                        setFeedback(
                          `Correo de ejemplo vinculado. El ahorro de práctica se mantiene en ${money(saved)}.`,
                        );
                      }}
                    >
                      {receiptLinked
                        ? "✓ Vinculado sin volver a sumar"
                        : "Simular vincular al registro existente"}
                    </button>
                  </div>
                  <p className="tutorial-tip">
                    Mismo monto, app y día es una sugerencia: tú confirmas si es
                    el mismo depósito. Bitso es opcional, solo consulta balances
                    y muestra cada moneda por separado; no se suma a tus metas
                    ni hace transferencias.
                  </p>
                </>
              )}
              {tool === "backup" && (
                <>
                  <Illustration kind="backup" />
                  <h3>Cuida tu guardadito digital</h3>
                  <p>
                    En Respaldo, Descargar respaldo guarda un archivo JSON con
                    tus metas, mascota y registros. Guárdalo en privado antes de
                    cambiar de teléfono o borrar datos.
                  </p>
                  <button
                    className="secondary full"
                    aria-expanded={backupOpen}
                    onClick={() => setBackupOpen(!backupOpen)}
                  >
                    Ver qué contiene un respaldo
                  </button>
                  {backupOpen && (
                    <ul className="tutorial-backup-list">
                      <li>✓ Metas, fechas y app donde guardas el dinero</li>
                      <li>✓ Movimientos y correos ya revisados</li>
                      <li>✓ Mascota, accesorios y visitas</li>
                      <li>✓ Frecuencia y cajitas archivadas</li>
                      <li>Sin contraseñas, llaves ni conexiones</li>
                    </ul>
                  )}
                  <p className="notice">
                    Importar reemplaza los datos de esa instalación después de
                    revisar y confirmar. Descarga primero su respaldo. Al
                    restaurar, activa de nuevo el recordatorio.
                  </p>
                </>
              )}
            </div>
          </>
        )}
        {step === 6 && (
          <>
            <div
              className="tutorial-platforms"
              role="group"
              aria-label="Elegir dispositivo"
            >
              <button
                aria-pressed={phone === "android"}
                onClick={() => setPhone("android")}
              >
                Android
              </button>
              <button
                aria-pressed={phone === "ios"}
                onClick={() => setPhone("ios")}
              >
                iPhone
              </button>
            </div>
            <div className="tutorial-phone" aria-hidden="true">
              <div className="tutorial-phone-speaker" />
              <span>guardadito ✦</span>
              <Mascot pet={pet} small />
              <div className="tutorial-phone-icons">
                <span>♡</span>
                <span>▦</span>
                <span>✿</span>
              </div>
              <span className="tutorial-tap">☝</span>
            </div>
            {phone === "android" ? (
              <>
                <h3>Android: app o instalación web</h3>
                <ol className="tutorial-instructions">
                  <li>
                    Busca Guardadito en Google Play, o abre el menú de tu
                    navegador y elige “Instalar app”.
                  </li>
                  <li>Abre Guardadito desde su ícono.</li>
                  <li>
                    Entra con tu cuenta en Más → Mi cuenta para traer tus
                    cajitas.
                  </li>
                </ol>
                {!isNative && ownerTools && (
                  <a
                    className="secondary button-link full"
                    href={ANDROID_DOWNLOAD_URL}
                  >
                    Descargar APK Android de prueba ↗
                  </a>
                )}
              </>
            ) : (
              <>
                <h3>iPhone: desde Safari</h3>
                <ol className="tutorial-instructions">
                  <li>Abre la web publicada de Guardadito en Safari.</li>
                  <li>Toca Compartir → Agregar a pantalla de inicio.</li>
                  <li>Confirma Agregar. Abre Guardadito desde su icono.</li>
                </ol>
                <p className="tutorial-tip">
                  Crea tu cuenta antes de instalar: Safari y la app de tu
                  pantalla de inicio guardan por separado.
                </p>
              </>
            )}
            <p className="notice">
              Sin cuenta, cada teléfono y cada navegador guarda sus propias
              cajitas. Con tu cuenta (Más → Mi cuenta) aparecen en todos; sin
              ella, usa un respaldo para llevarlas.
            </p>
          </>
        )}
        {step === 7 && (
          <>
            <Illustration kind="complete" className="tutorial-finish-art" />
            <form
              className="tutorial-quiz"
              onSubmit={(e) => {
                e.preventDefault();
                setReviewed(true);
                setFeedback(
                  correctCount === questions.length
                    ? "¡Tres de tres! Ya puedes empezar a tu ritmo ♡"
                    : `${correctCount} de 3. Revisa las respuestas marcadas y vuelve a probar.`,
                );
              }}
            >
              {questions.map((q, i) => (
                <fieldset key={q.title}>
                  <legend>{q.title}</legend>
                  {q.options.map((option, j) => (
                    <label key={option} className="tutorial-answer">
                      <input
                        type="radio"
                        name={`tutorial-question-${i}`}
                        checked={answers[i] === j}
                        onChange={() => {
                          setAnswers({ ...answers, [i]: j });
                          setReviewed(false);
                        }}
                        required
                      />
                      {option}
                    </label>
                  ))}
                  {reviewed && (
                    <p
                      className={
                        answers[i] === q.correct
                          ? "tutorial-right"
                          : "tutorial-wrong"
                      }
                    >
                      {answers[i] === q.correct
                        ? "✓ Así es."
                        : `La respuesta es: ${q.options[q.correct]}.`}
                    </p>
                  )}
                </fieldset>
              ))}
              <button className="secondary full">Revisar mis respuestas</button>
            </form>
            <div className="tutorial-finish-actions">
              <button className="primary full" onClick={onCreate}>
                Crear una cajita real
              </button>
              <button
                className="text-button full"
                onClick={() => onNavigate("goals")}
              >
                Volver a mis cajitas
              </button>
            </div>
          </>
        )}
        <p
          className="tutorial-feedback"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {feedback}
        </p>
      </article>
      <div className="tutorial-navigation">
        <button
          className="secondary"
          disabled={step === 0}
          onClick={() => go(step - 1)}
        >
          ← Anterior
        </button>
        <span>
          {step + 1} / {lessons.length}
        </span>
        {step < lessons.length - 1 ? (
          <button className="primary" onClick={() => go(step + 1)}>
            Siguiente →
          </button>
        ) : (
          <button className="secondary" onClick={reset}>
            Repetir tutorial
          </button>
        )}
      </div>
      <div className="tutorial-exit">
        <button className="text-button" onClick={() => onNavigate("goals")}>
          Salir de la práctica
        </button>
        <p>
          Puedes repetirlo desde Más → Tutorial interactivo. Se respeta reducir
          movimiento del dispositivo.
        </p>
      </div>
      {withdrawOpen && (
        <Modal
          title="Registrar un retiro de práctica"
          onClose={() => setWithdrawOpen(false)}
        >
          <Mascot pet={pet} accessory={accessory} small />
          <p>
            Estás probando un retiro de <strong>{money(withdrawCents)}</strong>.
            Es dinero de ejemplo. Usar tu ahorro cuando lo necesitas también es
            cumplir su propósito.
          </p>
          <p className="notice">
            En la app real, el dinero sigue disponible en {goal.provider}.
            Guardadito solo registra el retiro.
          </p>
          <button
            className="primary full"
            onClick={() => {
              deposit(-withdrawCents);
              setWithdrawOpen(false);
              setFeedback(
                "Retiro de práctica registrado. Tu ahorro cumplió su propósito.",
              );
            }}
          >
            Confirmar retiro de práctica
          </button>
          <button
            className="secondary full"
            onClick={() => {
              setWithdrawOpen(false);
              setFeedback(
                "Seguimos a tu ritmo. El ahorro de ejemplo no cambió.",
              );
            }}
          >
            Seguir ahorrando en la práctica
          </button>
        </Modal>
      )}
    </section>
  );
}
