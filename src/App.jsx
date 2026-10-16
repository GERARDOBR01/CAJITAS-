import AppShell from "./components/AppShell.jsx";
import GoalDialogs from "./components/GoalDialogs.jsx";
import Home from "./screens/Home.jsx";
import More from "./screens/More.jsx";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import PetRoom from "./components/PetRoom.jsx";
import Activity from "./components/Activity.jsx";
import Install from "./components/Install.jsx";
import Simulator from "./components/Simulator.jsx";
import Connections from "./components/Connections.jsx";
import Backup from "./components/Backup.jsx";
import {
  haptic,
  isNative,
  persistSavings,
  syncReminders,
  listenToReminders,
  consumeConnectionResult,
} from "./platform.js";
import { answerCheckIn, dueCheckIn, easeReminders } from "./pet/reminders.js";
import { EXCITED_MS, WITHDRAWAL_NOTE } from "./pet/state.js";
import {
  STORAGE_KEY,
  balance,
  initialData,
  validateBackup,
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
          Guardadito está lista para usarse sin conexión.
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
    [excited, setExcited] = useState(false),
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
    excitedTimer = useRef();
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
      clearTimeout(excitedTimer.current);
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
    if (
      !setData(
        value > 0 && next.preferences.reminder.enabled
          ? answerCheckIn(next, new Date())
          : next,
      )
    )
      return;
    setModal(null);
    if (value < 0) notify(WITHDRAWAL_NOTE);
    else if (balance(g) < g.targetCents && balance(g) + value >= g.targetCents)
      celebrate();
    else {
      haptic();
      setExcited(true);
      clearTimeout(excitedTimer.current);
      excitedTimer.current = setTimeout(() => setExcited(false), EXCITED_MS);
      notify("Ahorro registrado. ¡Un pasito más!");
    }
  }
  // Two unanswered reminders in a row: write less often instead of insisting.
  useEffect(() => {
    if (loadError) return;
    const eased = easeReminders(latestData.current);
    if (eased.notice && setData(eased.data)) notify(eased.notice);
  }, []);
  // Keep the next dated notifications in sync with the cajitas.
  useEffect(() => {
    syncReminders(data).catch(() => {});
  }, [data.savedAt]);
  useEffect(() => {
    listenToReminders(({ action, goalId }) => {
      const current = latestData.current;
      if (action === "later") {
        if (setData(answerCheckIn(current)))
          notify("¡Va! Aquí sigo cuando quieras 💛");
        return;
      }
      const goal =
        current.goals.find((g) => g.id === goalId && !g.archived) ??
        dueCheckIn(current)?.goal;
      changeTab("goals");
      if (goal) setModal({ type: "movement", goal, withdraw: false });
    }).catch(() => {});
  }, []);
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
    window.addEventListener("guardadito:connection", connected);
    const pending = consumeConnectionResult();
    if (pending) connected({ detail: pending });
    window.addEventListener("guardadito:back", back);
    return () => {
      window.removeEventListener("guardadito:connection", connected);
      window.removeEventListener("guardadito:back", back);
    };
  }, []);
  const pet = data.preferences;
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
      <AppShell
        tab={tab}
        onNavigate={changeTab}
        goalCount={data.goals.length}
        pet={pet}
      >
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
          <Home
            data={data}
            filter={goalFilter}
            onFilter={setGoalFilter}
            now={now}
            cheering={excited}
            celebrating={confetti}
            checkIn={dueCheckIn(data, new Date(now))}
            onCheckIn={(goal) =>
              setModal({ type: "movement", goal, withdraw: false })
            }
            onLater={() => {
              if (setData(answerCheckIn(data)))
                notify("¡Va! Aquí sigo cuando quieras 💛");
            }}
            onCreate={() => setModal({ type: "new" })}
            onMove={(goal, withdraw) =>
              setModal({ type: "movement", goal, withdraw })
            }
            onEdit={(goal) => setModal({ type: "edit", goal })}
            onRecord={(goal, initialCents) =>
              setModal({
                type: "movement",
                goal,
                withdraw: false,
                initialCents,
              })
            }
            onFrequency={(id, frequency) =>
              setData({
                ...data,
                goals: data.goals.map((goal) =>
                  goal.id === id ? { ...goal, frequency } : goal,
                ),
              })
            }
            onPet={() => haptic()}
          />
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
          <Suspense fallback={<p role="status">Cookie prepara tu paseíto…</p>}>
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
          <More
            data={data}
            onSave={setData}
            notify={notify}
            onNavigate={changeTab}
          />
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
                await syncReminders({
                  ...next,
                  preferences: {
                    ...next.preferences,
                    reminder: { ...next.preferences.reminder, enabled: false },
                  },
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
      </AppShell>
      <GoalDialogs
        modal={modal}
        data={data}
        setData={setData}
        setModal={setModal}
        movement={movement}
        pet={pet}
        notify={notify}
        celebrate={celebrate}
        setGoalFilter={setGoalFilter}
      />
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
