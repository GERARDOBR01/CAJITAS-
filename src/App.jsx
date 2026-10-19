import AppShell from "./components/AppShell.jsx";
import GoalDialogs from "./components/GoalDialogs.jsx";
import Home from "./screens/Home.jsx";
import GoalDetail from "./screens/GoalDetail.jsx";
import More from "./screens/More.jsx";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import PetRoom from "./components/PetRoom.jsx";
import Activity from "./components/Activity.jsx";
import Install from "./components/Install.jsx";
import Simulator from "./components/Simulator.jsx";
import Connections from "./components/Connections.jsx";
import Backup from "./components/Backup.jsx";
import Account, { SyncPrompt } from "./components/Account.jsx";
import { useCloud } from "./cloud/useCloud.js";
import { cloudConfigured } from "./cloud/config.js";
import { usePartner } from "./cloud/usePartner.js";
import Partner from "./components/Partner.jsx";
import SurpriseReveal from "./components/SurpriseReveal.jsx";
import SharedGoals from "./components/SharedGoals.jsx";
import { DepositDialog, DepositInbox } from "./components/Guardian.jsx";
import { journal } from "./journal/index.js";
import { useJournal } from "./journal/useJournal.js";
import { useNavigation } from "./navigation/useNavigation.js";
import { haptic, isNative } from "./platform.js";
import { consumeConnectionResult } from "./gmail/connection.js";
import { syncReminders, listenToReminders } from "./reminders/device.js";
import {
  answerCheckIn,
  dueCheckIn,
  easeReminders,
  restoreWithoutReminders,
} from "./pet/reminders.js";
import { EXCITED_MS, WITHDRAWAL_NOTE } from "./pet/state.js";
import { recordEntry, restoreEntry } from "./domain.js";

const Tutorial = lazy(() => import("./components/Tutorial.jsx"));

const RECOVERY_MESSAGES = {
  unreadable:
    "No se pudieron leer los datos guardados. Exporta o recupera un respaldo antes de registrar cambios.",
  external:
    "Los datos cambiaron en otra pestaña y necesitan recuperación. Descarga los datos originales o importa un respaldo.",
};
const SAVE_MESSAGES = {
  recovery:
    "Los datos guardados necesitan recuperación. Descarga los datos originales o importa un respaldo antes de continuar.",
  stale:
    "Tus cajitas cambiaron mientras revisabas. Abre de nuevo esta pantalla antes de guardar.",
  quota:
    "No pudimos guardar el cambio. Revisa el espacio o los permisos del navegador y descarga un respaldo.",
};

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
  const store = journal();
  const { data, recovery } = useJournal(store);
  const loadError = RECOVERY_MESSAGES[recovery] ?? "";
  const { tab, go, launch } = useNavigation({ cloudConfigured });
  const [modal, setModal] = useState(null),
    [deposit, setDeposit] = useState(null),
    [toast, setToast] = useState(""),
    [now, setNow] = useState(Date.now()),
    [confetti, setConfetti] = useState(false),
    [excited, setExcited] = useState(false),
    [offline, setOffline] = useState(!navigator.onLine);
  const [goalFilter, setGoalFilter] = useState("active");
  const [detailId, setDetailId] = useState(null);
  const [connectionVersion, setConnectionVersion] = useState(0);
  // The cloud hook reads the newest journal through `.current`.
  const latestData = useMemo(
    () => ({
      get current() {
        return store.get();
      },
    }),
    [store],
  );
  const cloudRef = useRef();
  const toastTimer = useRef(),
    celebrationTimer = useRef(),
    excitedTimer = useRef();
  // A copy that came from the account (first sign-in or another device).
  function applyRemote(next, message) {
    store.replace(next, { remote: true });
    if (message) notify(message);
  }
  const cloud = useCloud({ latest: latestData, applyRemote, notify });
  cloudRef.current = cloud;
  const partner = usePartner({
    user: cloud.user,
    data,
    update: (change) => setData(change(latestData.current)),
    notify,
  });
  function notify(message) {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 7000);
  }
  // Says why a change was not kept; true when it was.
  function report(result) {
    if (!result.ok)
      notify(
        SAVE_MESSAGES[result.reason] ||
          result.message ||
          "No pudimos guardar el cambio.",
      );
    return result.ok;
  }
  const setData = (next) => report(store.save(next));
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
  useEffect(
    () =>
      store.subscribe((event) => {
        if (event.type === "saved") cloudRef.current.save(event.data);
        else if (event.type === "external") {
          setModal(null);
          notify(
            "Tus cajitas se actualizaron desde otra pestaña. Revisa el cambio antes de continuar.",
          );
        } else if (event.type === "external-invalid") setModal(null);
        else if (event.type === "replica-failed")
          notify(
            "El cambio está guardado en la app, pero no se pudo actualizar la copia adicional del dispositivo. Descarga un respaldo.",
          );
      }),
    [],
  );
  useEffect(() => {
    if (launch.gmail)
      notify(
        launch.gmail === "connected"
          ? "Gmail conectado. Ya puedes buscar comprobantes."
          : "Conexión cancelada.",
      );
  }, []);
  function movement({ cents: value, at, goalId }) {
    let recorded;
    try {
      recorded = recordEntry(data, goalId ?? modal.goal.id, {
        cents: value,
        at,
      });
    } catch (error) {
      notify(error.message || "No pudimos guardar el cambio.");
      return;
    }
    const next = recorded.data;
    if (
      !setData(
        value > 0 && next.preferences.reminder.enabled
          ? answerCheckIn(next, new Date())
          : next,
      )
    )
      return;
    setModal(null);
    if (value > 0) partner.onSaved();
    if (value < 0) notify(WITHDRAWAL_NOTE);
    else if (recorded.reachedTarget) celebrate();
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
      go("goals");
      if (goal) setModal({ type: "movement", goal, withdraw: false });
    }).catch(() => {});
  }, []);
  useEffect(() => {
    const connected = (e) => {
      consumeConnectionResult();
      if (e.detail?.error) notify(e.detail.error);
      else {
        setConnectionVersion((v) => v + 1);
        go("connections");
        notify("Gmail conectado. Ya puedes buscar comprobantes.");
      }
    };
    window.addEventListener("guardadito:connection", connected);
    const pending = consumeConnectionResult();
    if (pending) connected({ detail: pending });
    return () => window.removeEventListener("guardadito:connection", connected);
  }, []);
  const detailGoal =
    tab === "goal" ? data.goals.find((goal) => goal.id === detailId) : null;
  useEffect(() => {
    if (tab === "goal" && !detailGoal) go("goals");
  }, [tab, detailGoal, go]);
  function openGoal(id) {
    setDetailId(id);
    go("goal");
  }
  function setFrequency(id, frequency) {
    setData({
      ...data,
      goals: data.goals.map((goal) =>
        goal.id === id ? { ...goal, frequency } : goal,
      ),
    });
  }
  const pet = data.preferences;
  return (
    <div
      className={`app ${!pet.animations ? "reduced-motion" : ""} ${isNative ? "native-app" : ""} ${tab === "goal" ? "detail-open" : ""}`}
    >
      <AppShell
        tab={tab}
        onNavigate={go}
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
                const raw = store.readRaw();
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
        {tab === "goals" && partner.pair && (
          <DepositInbox
            partner={partner}
            name={partner.partnerName || "Tu pareja"}
          />
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
            guardian={
              partner.guardian && {
                name: partner.partnerName || "tu guardián",
                pending: partner.pending,
                onDeposit: (goal, withdraw) => setDeposit({ goal, withdraw }),
              }
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
            onOpen={openGoal}
            onPet={() => haptic()}
          />
        )}
        {tab === "goals" && partner.pair && (
          <SharedGoals
            partner={partner}
            uid={cloud.user?.uid}
            now={now}
            onCelebrate={celebrate}
          />
        )}
        {detailGoal && (
          <GoalDetail
            goal={detailGoal}
            now={now}
            weekday={data.preferences.reminder.day}
            guardian={
              partner.guardian && {
                name: partner.partnerName || "tu guardián",
                pending: partner.pending[detailGoal.id],
                onDeposit: (goal, withdraw) => setDeposit({ goal, withdraw }),
              }
            }
            onBack={() => go("goals")}
            onMove={(goal, withdraw) =>
              setModal({ type: "movement", goal, withdraw })
            }
            onEdit={(goal) => setModal({ type: "edit", goal })}
            onFrequency={setFrequency}
            onActivity={() => go("activity")}
          />
        )}
        {tab === "pet" && (
          <PetRoom data={data} onSave={setData} notify={notify} />
        )}
        {tab === "activity" && (
          <Activity
            data={data}
            notify={notify}
            onRestore={(entryId) => {
              try {
                if (setData(restoreEntry(data, entryId)))
                  notify("Movimiento restaurado. ✓");
              } catch (error) {
                notify(error.message);
              }
            }}
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
          <Suspense
            fallback={<p role="status">{pet.petName} prepara tu paseíto…</p>}
          >
            <Tutorial
              preferences={pet}
              onNavigate={go}
              onCreate={() => {
                go("goals");
                setModal({ type: "new" });
              }}
            />
          </Suspense>
        )}
        {tab === "install" && <Install notify={notify} />}
        {tab === "account" && cloud.configured && (
          <Account cloud={cloud} notify={notify} />
        )}
        {tab === "partner" && cloud.configured && (
          <Partner
            cloud={cloud}
            partner={partner}
            notify={notify}
            onNavigate={go}
            initialCode={launch.inviteCode}
          />
        )}
        {tab === "more" && (
          <More
            cloud={cloud}
            data={data}
            onSave={setData}
            notify={notify}
            onNavigate={go}
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
              const restored = restoreWithoutReminders(next);
              if (!report(store.replace(restored))) return false;
              try {
                await syncReminders(restored);
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
      {deposit && partner.guardian && (
        <DepositDialog
          goal={deposit.goal}
          withdraw={deposit.withdraw}
          guardian={partner.guardian}
          name={partner.partnerName || "tu guardián"}
          pendingOut={partner.pending[deposit.goal.id]?.out ?? 0}
          onSend={(value, method) =>
            partner.deposit(
              deposit.goal,
              value,
              method,
              partner.pending[deposit.goal.id]?.out ?? 0,
            )
          }
          onClose={() => setDeposit(null)}
          notify={notify}
        />
      )}
      {partner.reveal && !cloud.prompt && (
        <SurpriseReveal
          gift={partner.reveal}
          onClose={partner.closeReveal}
          onMeetPet={() =>
            setData({
              ...latestData.current,
              preferences: {
                ...latestData.current.preferences,
                pet: "cat",
                petName: "Cookie",
              },
            })
          }
        />
      )}
      {cloud.prompt && (
        <SyncPrompt
          prompt={cloud.prompt}
          onChoose={cloud.resolve}
          notify={notify}
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
