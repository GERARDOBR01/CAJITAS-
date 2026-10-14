import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import Mascot from "./components/Mascot.jsx";
import PetRoom from "./components/PetRoom.jsx";
import Activity from "./components/Activity.jsx";
import Install from "./components/Install.jsx";
import Illustration from "./components/Illustration.jsx";
import CorrectEntry from "./components/CorrectEntry.jsx";
import { GoalForm, MovementForm, GoalCard } from "./components/Goals.jsx";
import Simulator from "./components/Simulator.jsx";
import Connections from "./components/Connections.jsx";
import Backup from "./components/Backup.jsx";
import NextStep from "./components/NextStep.jsx";
import Modal from "./components/Modal.jsx";
import LocalMailImport from "./components/LocalMailImport.jsx";
import { ANDROID_DOWNLOAD_URL } from "./downloads.js";
import {
  haptic,
  isNative,
  persistSavings,
  configureReminder,
  consumeConnectionResult,
} from "./platform.js";
import {
  STORAGE_KEY,
  money,
  today,
  balance,
  streak,
  initialData,
  validateBackup,
  unlockTime,
  PETS,
  activeGoals,
  companionship,
  checkIn,
  correctManualEntry,
  removeManualEntry,
} from "./domain.js";

const Tutorial = lazy(() => import("./components/Tutorial.jsx"));

function ServiceWorkerNotices() {
  const {
    offlineReady: [ready],
    needRefresh: [refresh],
    updateServiceWorker,
  } = useRegisterSW();
  return (
    <>
      {ready && (
        <p className="offline" role="status">
          Cajitas está lista para usarse sin conexión.
        </p>
      )}
      {refresh && (
        <p className="offline">
          Hay una nueva versión.{" "}
          <button
            className="text-button"
            onClick={() => updateServiceWorker(true)}
          >
            Actualizar app
          </button>
        </p>
      )}
    </>
  );
}
export default function App() {
  const [loadError, setLoadError] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) validateBackup(JSON.parse(raw));
      return "";
    } catch {
      return "No se pudieron leer los datos guardados. Exporta o recupera un respaldo antes de registrar cambios.";
    }
  });
  const [data, setDataState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? validateBackup(JSON.parse(raw)) : initialData();
    } catch {
      return initialData();
    }
  });
  const [tab, setTab] = useState(() =>
      new URLSearchParams(location.search).get("tutorial") === "1"
        ? "tutorial"
        : "goals",
    ),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [now, setNow] = useState(Date.now()),
    [confetti, setConfetti] = useState(false),
    [sad, setSad] = useState(false),
    [offline, setOffline] = useState(!navigator.onLine);
  const [goalFilter, setGoalFilter] = useState("active");
  const [connectionVersion, setConnectionVersion] = useState(0);
  const [startingRaw] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const lastStoredRaw = useRef(startingRaw);
  const latestData = useRef(data);
  latestData.current = data;
  const toastTimer = useRef(),
    celebrationTimer = useRef(),
    sadTimer = useRef();
  function notify(message) {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 7000);
  }
  function setData(next, restoring = false) {
    if (loadError && !restoring) {
      notify(
        "Los datos guardados necesitan recuperación. Descarga los datos originales o importa un respaldo antes de continuar.",
      );
      return false;
    }
    try {
      if (
        !restoring &&
        ((next.savedAt ?? 0) !== (latestData.current.savedAt ?? 0) ||
          localStorage.getItem(STORAGE_KEY) !== lastStoredRaw.current)
      ) {
        notify(
          "Tus cajitas cambiaron mientras revisabas. Abre de nuevo esta pantalla antes de guardar.",
        );
        return false;
      }
      const saved = {
        ...validateBackup(next),
        savedAt: Math.max(Date.now(), (latestData.current.savedAt ?? 0) + 1),
      };
      const raw = JSON.stringify(saved);
      localStorage.setItem(STORAGE_KEY, raw);
      lastStoredRaw.current = raw;
      latestData.current = saved;
      setDataState(saved);
      persistSavings(raw).catch(() =>
        notify(
          "El cambio está guardado en la app, pero no se pudo actualizar la copia adicional del dispositivo. Descarga un respaldo.",
        ),
      );
      if (restoring) setLoadError("");
      return true;
    } catch (error) {
      notify(
        error.name === "QuotaExceededError" || error.name === "SecurityError"
          ? "No pudimos guardar el cambio. Revisa el espacio o los permisos del navegador y descarga un respaldo."
          : error.message || "No pudimos guardar el cambio.",
      );
      return false;
    }
  }
  function celebrate() {
    setSad(false);
    clearTimeout(sadTimer.current);
    clearTimeout(celebrationTimer.current);
    setConfetti(true);
    haptic(true);
    notify("¡Meta alcanzada! Poquito a poquito, lo lograste ✦");
    celebrationTimer.current = setTimeout(() => setConfetti(false), 5000);
  }
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const on = () => setOffline(!navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      clearTimeout(toastTimer.current);
      clearTimeout(celebrationTimer.current);
      clearTimeout(sadTimer.current);
    };
  }, []);
  useEffect(() => {
    function changed(event) {
      if (
        event.storageArea !== localStorage ||
        (event.key !== STORAGE_KEY && event.key !== null)
      )
        return;
      const raw = localStorage.getItem(STORAGE_KEY);
      try {
        const next = raw ? validateBackup(JSON.parse(raw)) : initialData();
        lastStoredRaw.current = raw;
        latestData.current = next;
        setDataState(next);
        setModal(null);
        setLoadError("");
        notify(
          "Tus cajitas se actualizaron desde otra pestaña. Revisa el cambio antes de continuar.",
        );
      } catch {
        setLoadError(
          "Los datos cambiaron en otra pestaña y necesitan recuperación. Descarga los datos originales o importa un respaldo.",
        );
        setModal(null);
      }
    }
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  useEffect(() => {
    const gmail = new URLSearchParams(location.search).get("gmail");
    if (gmail) {
      setTab("connections");
      notify(
        gmail === "connected"
          ? "Gmail conectado. Ya puedes buscar comprobantes."
          : "Conexión cancelada.",
      );
      history.replaceState({}, "", location.pathname);
    }
  }, []);
  const total = data.goals.reduce((sum, g) => sum + balance(g), 0),
    target = data.goals.reduce((sum, g) => sum + g.targetCents, 0),
    completed = data.goals.filter((g) => balance(g) >= g.targetCents).length,
    racha = streak(data.goals);
  function movement({ cents: value, at }) {
    const g = data.goals.find((g) => g.id === modal.goal.id);
    const next = {
      ...data,
      goals: data.goals.map((goal) =>
        goal.id === g.id
          ? {
              ...goal,
              entries: [
                ...goal.entries,
                {
                  id: crypto.randomUUID(),
                  cents: value,
                  at,
                  source: "manual",
                },
              ],
            }
          : goal,
      ),
    };
    if (!setData(next)) return;
    setModal(null);
    if (value < 0) {
      const earlyWithdrawal = Date.parse(at) < unlockTime(g.unlockDate);
      setSad(earlyWithdrawal);
      clearTimeout(sadTimer.current);
      if (earlyWithdrawal)
        sadTimer.current = setTimeout(() => setSad(false), 8000);
      notify("Retiro registrado. Los planes cambian; puedes seguir después.");
    } else if (
      balance(g) < g.targetCents &&
      balance(g) + value >= g.targetCents
    )
      celebrate();
    else {
      haptic();
      notify("Ahorro registrado. ¡Un pasito más!");
    }
  }
  useEffect(() => {
    const connected = (e) => {
      consumeConnectionResult();
      if (e.detail?.error) notify(e.detail.error);
      else {
        setConnectionVersion((v) => v + 1);
        setTab("connections");
        notify("Gmail conectado. Ya puedes buscar comprobantes.");
      }
    };
    const back = () => changeTab("goals");
    window.addEventListener("cajitas:connection", connected);
    const pending = consumeConnectionResult();
    if (pending) connected({ detail: pending });
    window.addEventListener("cajitas:back", back);
    return () => {
      window.removeEventListener("cajitas:connection", connected);
      window.removeEventListener("cajitas:back", back);
    };
  }, []);
  const friend = companionship(data),
    active = activeGoals(data),
    pet = data.preferences;
  const nextGoal = active
    .filter((g) => balance(g) < g.targetCents)
    .sort((a, b) => a.unlockDate.localeCompare(b.unlockDate))[0];
  const visibleGoals = data.goals.filter((g) =>
    goalFilter === "archived"
      ? g.archived
      : !g.archived &&
        (goalFilter === "completed" ? balance(g) >= g.targetCents : true),
  );
  const nav = [
    ["goals", "▦", "Mis cajitas"],
    ["pet", "♡", "Mi mascota"],
    ["activity", "↗", "Actividad"],
    ["simulator", "✦", "Rendimiento"],
    ["connections", "⌁", "Conexiones"],
    ["backup", "☁", "Respaldo"],
    ["install", "↓", "Instalar app"],
    ["tutorial", "▷", "Tutorial interactivo"],
  ];
  const mobileNav = [
    ["goals", "▦", "Mis cajitas"],
    ["pet", "♡", "Mi mascota"],
    ["activity", "↗", "Actividad"],
    ["more", "⋯", "Más"],
  ];
  const changeTab = (key) => {
    setTab(key);
    const url = new URL(location.href);
    if (key === "tutorial") url.searchParams.set("tutorial", "1");
    else url.searchParams.delete("tutorial");
    history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  return (
    <div
      className={`app ${!pet.animations ? "reduced-motion" : ""} ${isNative ? "native-app" : ""}`}
    >
      <aside className="sidebar">
        <a
          className="brand"
          href={import.meta.env.BASE_URL}
          aria-label="Cajitas inicio"
        >
          <span className="brand-icon">▣</span>cajitas
          <span className="brand-dot">✦</span>
        </a>
        <p className="brand-caption">Poquito a poquito.</p>
        <nav className="desktop-nav" aria-label="Navegación principal">
          {nav.map(([key, icon, label]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              aria-current={tab === key ? "page" : undefined}
              onClick={() => changeTab(key)}
            >
              <span aria-hidden="true">{icon}</span>
              <span>{label}</span>
              {key === "goals" && <small>{data.goals.length}</small>}
            </button>
          ))}
        </nav>
        <nav className="mobile-nav" aria-label="Navegación de la app">
          {mobileNav.map(([key, icon, label]) => (
            <button
              key={key}
              aria-current={
                tab === key ||
                (key === "more" &&
                  [
                    "simulator",
                    "connections",
                    "backup",
                    "install",
                    "tutorial",
                  ].includes(tab))
                  ? "page"
                  : undefined
              }
              className={
                tab === key ||
                (key === "more" &&
                  [
                    "simulator",
                    "connections",
                    "backup",
                    "install",
                    "tutorial",
                  ].includes(tab))
                  ? "active"
                  : ""
              }
              onClick={() => changeTab(key)}
            >
              <span aria-hidden="true">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span>✿</span>
          <p>
            Los grandes sueños
            <br />
            empiezan con un
            <br />
            <strong>pequeño guardadito.</strong>
          </p>
        </div>
        <div className="local-badge">
          <span />
          Guardado en tu dispositivo
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>UN SUEÑO A LA VEZ</span>
          <div className="topbar-right">
            <span className="private-badge">♧ Tu espacio personal</span>
            <button
              className="avatar avatar-pet"
              aria-label="Personalizar mi mascota"
              onClick={() => changeTab("pet")}
            >
              <span>
                {PETS[pet.pet].label === "Cerdito"
                  ? "🐷"
                  : pet.pet === "cow"
                    ? "🐮"
                    : pet.pet === "bunny"
                      ? "🐰"
                      : "🌱"}
              </span>
            </button>
          </div>
        </header>
        <main>
          {!isNative && tab === "goals" && (
            <aside className="download-banner" aria-label="Descargar Cajitas">
              <span className="download-mascot" aria-hidden="true">
                🐷
              </span>
              <div>
                <strong>Lleva tus cajitas contigo</strong>
                <p>Android 7+ · APK de prueba · versión 0.5</p>
              </div>
              <a className="primary" href={ANDROID_DOWNLOAD_URL}>
                ↓ Descargar para Android
              </a>
            </aside>
          )}
          {offline && (
            <p className="offline" role="status">
              Estás sin conexión. Tus cajitas, mascotas y respaldos siguen
              contigo; las consultas necesitan internet.
            </p>
          )}
          {!isNative && <ServiceWorkerNotices />}
          {loadError && (
            <div className="error" role="alert">
              {loadError}
              <br />
              <button
                className="text-button"
                onClick={() => {
                  const raw = localStorage.getItem(STORAGE_KEY);
                  const url = URL.createObjectURL(
                    new Blob([raw ?? ""], { type: "application/json" }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "cajitas-datos-originales.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Descargar datos originales
              </button>
            </div>
          )}
          {tab === "goals" && (
            <>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">TU FUTURO EMPIEZA AQUÍ</p>
                  <h1>
                    Un poquito hoy.
                    <br className="mobile-break" /> Un sueño mañana
                    <span className="heading-star"> ✦</span>
                  </h1>
                  <p className="muted">
                    Cada pasito cuenta. Dale una cajita a eso que tanto quieres.
                  </p>
                  <button
                    className="text-button tutorial-launch"
                    onClick={() => changeTab("tutorial")}
                  >
                    ▷ Ver tutorial interactivo
                  </button>
                </div>
                <button
                  className="primary new-goal"
                  onClick={() => setModal({ type: "new" })}
                >
                  + Nueva cajita
                </button>
              </div>
              <NextStep
                goal={nextGoal}
                onRecord={(goal, initialCents) =>
                  setModal({
                    type: "movement",
                    goal,
                    withdraw: false,
                    initialCents,
                  })
                }
                onEdit={(goal) => setModal({ type: "edit", goal })}
              />
              <section className="hero">
                <div className="hero-copy">
                  <span className="hero-pill">
                    ✦{" "}
                    {data.goals.length
                      ? "VAS MUY BIEN"
                      : `HOLA, SOY ${pet.petName.toLocaleUpperCase("es-MX")}`}
                  </span>
                  <h2>
                    {sad
                      ? "Los planes cambian."
                      : data.goals.length
                        ? "Mira todo lo que llevas."
                        : "Los sueños también\nnecesitan una casita."}
                  </h2>
                  <p>
                    {sad
                      ? "Aquí seguimos. Puedes ajustar tu meta y empezar de nuevo."
                      : data.goals.length
                        ? "Tu constancia está haciendo crecer algo bonito. Sigue a tu ritmo."
                        : "Yo crezco contigo y con cada poquito que decides guardar."}
                  </p>
                  <div className="hero-total">
                    <span>Ahorro registrado</span>
                    <strong>
                      {money(total)} <small>MXN</small>
                    </strong>
                  </div>
                </div>
                <div className="hero-mascot">
                  <Mascot
                    pet={pet.pet}
                    name={pet.petName}
                    accessory={pet.accessory}
                    progress={target ? total / target : 0}
                    sad={sad}
                    interactive
                    onPet={() => {
                      haptic();
                      notify("Un abrazo de tu compañero. A tu ritmo ♡");
                    }}
                    celebrating={confetti}
                  />
                  <button
                    className="mascot-caption text-button"
                    onClick={() => changeTab("pet")}
                  >
                    {pet.petName} · elige tu compañero ♡
                  </button>
                </div>
              </section>
              <section className="daily-ritual">
                <span className="ritual-icon">♡</span>
                <div>
                  <strong>Un ratito para ti y tus sueños</strong>
                  <p>
                    {data.checkins.includes(today())
                      ? "Qué bonito verte hoy. Tu compañía ya cuenta."
                      : `Visita a ${pet.petName}. Hoy puedes venir sin apartar dinero.`}
                  </p>
                </div>
                <button
                  className="secondary"
                  disabled={data.checkins.includes(today())}
                  onClick={() => {
                    if (setData(checkIn(data))) {
                      haptic();
                      notify(
                        "Visita guardada. Tu ahorro registrado no cambió.",
                      );
                    }
                  }}
                >
                  {data.checkins.includes(today())
                    ? "✓ Hoy nos vimos"
                    : "Estoy aquí"}
                </button>
              </section>
              <div className="stats">
                <div>
                  <span className="stat-icon peach" aria-hidden="true">
                    ♡
                  </span>
                  <p>
                    <strong>
                      {friend.days} {friend.days === 1 ? "día" : "días"}
                    </strong>
                    <span>De compañía</span>
                  </p>
                </div>
                <div>
                  <span className="stat-icon lavender">▦</span>
                  <p>
                    <strong>
                      {active.length}{" "}
                      {active.length === 1 ? "cajita" : "cajitas"}
                    </strong>
                    <span>Sueños en camino</span>
                  </p>
                </div>
                <div>
                  <span className="stat-icon yellow">✦</span>
                  <p>
                    <strong>
                      {completed} {completed === 1 ? "meta" : "metas"}
                    </strong>
                    <span>Sueños cumplidos</span>
                  </p>
                </div>
              </div>
              <div className="goals-title">
                <h2>
                  Mis cajitas <span>{data.goals.length}</span>
                </h2>
                <span>Hechas con ilusión ♡</span>
              </div>
              {data.goals.length > 0 && (
                <div className="goal-filters" aria-label="Filtrar cajitas">
                  {[
                    ["active", "Activas"],
                    ["completed", "Cumplidas"],
                    ["archived", "Archivadas"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      className={goalFilter === key ? "active" : ""}
                      aria-pressed={goalFilter === key}
                      onClick={() => setGoalFilter(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {visibleGoals.length ? (
                <div className="goals-grid">
                  {visibleGoals.map((g) => (
                    <GoalCard
                      key={g.id}
                      goal={g}
                      now={now}
                      onFrequency={(id, frequency) =>
                        setData({
                          ...data,
                          goals: data.goals.map((g) =>
                            g.id === id ? { ...g, frequency } : g,
                          ),
                        })
                      }
                      onMove={(goal, withdraw) =>
                        setModal({ type: "movement", goal, withdraw })
                      }
                      onEdit={(goal) => setModal({ type: "edit", goal })}
                    />
                  ))}
                  <button
                    className="add-card"
                    onClick={() => setModal({ type: "new" })}
                  >
                    <span>+</span>
                    <strong>Aquí cabe otro sueño</strong>
                    <small>Crear una nueva cajita</small>
                  </button>
                </div>
              ) : (
                <div className="empty-state">
                  <Illustration
                    kind={goalFilter === "completed" ? "complete" : "empty"}
                  />
                  <h3>
                    {goalFilter === "archived"
                      ? "Tus sueños tienen su lugar"
                      : goalFilter === "completed"
                        ? "Cada meta llega a su tiempo"
                        : "¿Qué te hace ilusión?"}
                  </h3>
                  <p>
                    {goalFilter === "archived"
                      ? "Tus cajitas archivadas aparecerán aquí con todo su historial."
                      : goalFilter === "completed"
                        ? "Cuando alcances una meta, aquí celebraremos tu esfuerzo."
                        : "Un viaje, ese curso, tu fondo de tranquilidad. Dale una casita a tu siguiente sueño."}
                  </p>
                  <button
                    className="secondary"
                    onClick={() => setModal({ type: "new" })}
                  >
                    {data.goals.length
                      ? "Crear otra cajita ↗"
                      : "Crear mi primera cajita ↗"}
                  </button>
                  <div className="dream-tags">
                    <span>☁ Una escapadita</span>
                    <span>✦ Mi guardadito</span>
                    <span>✿ Algo para mí</span>
                  </div>
                  {!data.goals.length && (
                    <details className="getting-started">
                      <summary>¿Cómo funciona Cajitas?</summary>
                      <ol>
                        <li>Elige tu sueño, monto y fecha.</li>
                        <li>Aparta el dinero en tu app de confianza.</li>
                        <li>
                          Registra aquí lo que apartaste y ve crecer a tu
                          compañero.
                        </li>
                      </ol>
                      <p>
                        Tú conservas el control de tu dinero. Tu registro se
                        guarda en este dispositivo.
                      </p>
                    </details>
                  )}
                </div>
              )}
              <p className="commitment">
                <span>♧</span> El candado es de compromiso, no bancario. Tu
                dinero sigue disponible en la app externa.
              </p>
              <p className="streak-note">
                Racha de ahorro: {racha} {racha === 1 ? "día" : "días"}{" "}
                consecutivos con depósitos registrados. Puedes continuar aunque
                un día no ahorres.
              </p>
            </>
          )}
          {tab === "pet" && (
            <PetRoom data={data} onSave={setData} notify={notify} />
          )}
          {tab === "activity" && (
            <Activity
              data={data}
              notify={notify}
              onCorrect={(entry) =>
                setModal({
                  type: "correct",
                  goalId: entry.goalId,
                  entryId: entry.id,
                })
              }
            />
          )}
          {tab === "tutorial" && (
            <Suspense fallback={<p role="status">Caji prepara tu paseíto…</p>}>
              <Tutorial
                preferences={pet}
                onNavigate={changeTab}
                onCreate={() => {
                  changeTab("goals");
                  setModal({ type: "new" });
                }}
              />
            </Suspense>
          )}
          {tab === "install" && <Install notify={notify} />}
          {tab === "more" && (
            <section>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">TU ESPACIO, A TU ESTILO</p>
                  <h1>Un poquito más de Cajitas</h1>
                  <p className="muted">
                    Todo lo que necesitas para cuidar tus sueños.
                  </p>
                </div>
              </div>
              <div className="more-grid">
                {[
                  [
                    "tutorial",
                    "▷",
                    "Tutorial interactivo",
                    "Aprende jugando con cajitas de ejemplo.",
                  ],
                  [
                    "simulator",
                    "✦",
                    "Rendimiento",
                    "Compara tasas reales y haz tus cuentas.",
                  ],
                  [
                    "connections",
                    "⌁",
                    "Conexiones",
                    "Comprobantes y saldo, cuando tú quieras.",
                  ],
                  [
                    "backup",
                    "☁",
                    "Respaldo",
                    "Lleva tus cajitas a otro dispositivo.",
                  ],
                  [
                    "install",
                    "↓",
                    "Instalar app",
                    "Tu propia app, siempre cerquita.",
                  ],
                ].map(([key, icon, title, description]) => (
                  <button
                    className="panel more-card"
                    key={key}
                    aria-label={title}
                    onClick={() => changeTab(key)}
                  >
                    <span>{icon}</span>
                    <h2>{title}</h2>
                    <p>{description}</p>
                    <strong>→</strong>
                  </button>
                ))}
              </div>
            </section>
          )}
          {tab === "simulator" && <Simulator />}
          {tab === "connections" && (
            <Connections
              key={connectionVersion}
              data={data}
              setData={setData}
              notify={notify}
              celebrate={celebrate}
              onCreate={() => setModal({ type: "new" })}
            />
          )}
          {tab === "backup" && (
            <Backup
              data={data}
              onRestore={async (next) => {
                if (
                  !setData(
                    {
                      ...next,
                      preferences: {
                        ...next.preferences,
                        reminder: {
                          ...next.preferences.reminder,
                          enabled: false,
                        },
                      },
                    },
                    true,
                  )
                )
                  return false;
                try {
                  await configureReminder({
                    ...next.preferences.reminder,
                    enabled: false,
                  });
                  notify(
                    "Respaldo restaurado. Puedes activar de nuevo tu recordatorio en Mi mascota.",
                  );
                } catch (error) {
                  notify(
                    `Respaldo restaurado. Revisa el recordatorio en Mi mascota: ${error.message}`,
                  );
                }
                return true;
              }}
              notify={notify}
            />
          )}
          <footer>
            <span>
              cajitas <span>✦</span>
            </span>
            <p>Cuida tus sueños. Ahorra a tu ritmo.</p>
            <small>Hecho para tus pequeños grandes planes.</small>
          </footer>
        </main>
      </div>
      {modal?.type === "new" && (
        <GoalForm
          onClose={() => setModal(null)}
          onSave={(goal) => {
            if (setData({ ...data, goals: [...data.goals, goal] })) {
              setModal(null);
              notify("Tu nueva cajita está lista.");
            }
          }}
        />
      )}{" "}
      {modal?.type === "movement" && (
        <MovementForm
          goal={data.goals.find((g) => g.id === modal.goal.id)}
          withdraw={modal.withdraw}
          onClose={() => setModal(null)}
          onSave={movement}
          preferences={pet}
          initialCents={modal.initialCents}
          onImport={(goal) => setModal({ type: "mail", goal })}
        />
      )}
      {modal?.type === "mail" && (
        <Modal
          title="Un comprobante en tu cajita"
          onClose={() => setModal(null)}
        >
          <LocalMailImport
            data={data}
            onSave={setData}
            notify={notify}
            celebrate={celebrate}
            initialGoalId={modal.goal.id}
            compact
            onDone={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.type === "correct" && (
        <CorrectEntry
          goal={data.goals.find((g) => g.id === modal.goalId)}
          entry={data.goals
            .find((g) => g.id === modal.goalId)
            .entries.find((e) => e.id === modal.entryId)}
          onClose={() => setModal(null)}
          onSave={(value) => {
            const next = correctManualEntry(
              data,
              modal.goalId,
              modal.entryId,
              value,
            );
            if (setData(next)) {
              setModal(null);
              notify("Registro corregido. Tu historial ya está actualizado.");
            }
          }}
          onRemove={() => {
            const next = removeManualEntry(data, modal.goalId, modal.entryId);
            if (setData(next)) {
              setModal(null);
              notify("Registro equivocado eliminado.");
            }
          }}
        />
      )}
      {modal?.type === "edit" && (
        <GoalForm
          goal={data.goals.find((g) => g.id === modal.goal.id)}
          onClose={() => setModal(null)}
          onSave={(goal) => {
            const previous = data.goals.find((g) => g.id === goal.id);
            if (
              setData({
                ...data,
                goals: data.goals.map((g) => (g.id === goal.id ? goal : g)),
              })
            ) {
              setModal(null);
              if (
                balance(previous) < previous.targetCents &&
                balance(goal) >= goal.targetCents
              )
                celebrate();
              else notify("Tu plan se ajustó. Seguimos a tu ritmo.");
            }
          }}
          onArchive={(goal) => {
            if (
              setData({
                ...data,
                goals: data.goals.map((g) =>
                  g.id === goal.id ? { ...g, archived: !g.archived } : g,
                ),
              })
            ) {
              setModal(null);
              if (goal.archived) setGoalFilter("active");
              notify(
                goal.archived
                  ? "Tu cajita está de vuelta."
                  : "Cajita archivada. Su historia está a salvo.",
              );
            }
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="Cerrar aviso" onClick={() => setToast("")}>
            ×
          </button>
        </div>
      )}
      {confetti && (
        <div className="confetti" aria-label="Confeti por meta alcanzada">
          {Array.from({ length: 36 }, (_, i) => (
            <i
              key={i}
              style={{
                left: `${(i * 37) % 100}%`,
                background: ["#9fc9a7", "#e6aa93", "#c2b5dd", "#e9cf80"][i % 4],
                animationDelay: `${(i % 8) * 0.12}s`,
                transform: `rotate(${i * 17}deg)`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
