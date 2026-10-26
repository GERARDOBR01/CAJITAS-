import AppShell from "./components/AppShell.jsx";
import GoalDialogs from "./goals/GoalDialogs.jsx";
import { useGoalActions } from "./goals/useGoalActions.js";
import Home from "./screens/Home.jsx";
import GoalDetail from "./screens/GoalDetail.jsx";
import Settings from "./screens/Settings.jsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import PetRoom from "./components/PetRoom.jsx";
import History from "./components/History.jsx";
import Reminder from "./components/Reminder.jsx";
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
import { DepositInbox } from "./components/Guardian.jsx";
import { journal } from "./journal/index.js";
import { useJournal } from "./journal/useJournal.js";
import { useNavigation } from "./navigation/useNavigation.js";
import { useFeedback } from "./feedback/useFeedback.js";
import Feedback from "./feedback/Feedback.jsx";
import { haptic, isNative } from "./platform.js";
import { consumeConnectionResult } from "./gmail/connection.js";
import { syncReminders, listenToReminders } from "./reminders/device.js";
import {
  answerCheckIn,
  dueCheckIn,
  easeReminders,
  restoreWithoutReminders,
} from "./pet/reminders.js";
import { checkIn, restoreEntry, today } from "./domain.js";
import { SLEEPY_DAYS, daysAway } from "./pet/state.js";
import Help from "./components/Help.jsx";
import AccountNudge from "./components/AccountNudge.jsx";
import Welcome, { markWelcomed, needsWelcome } from "./components/Welcome.jsx";
import { ownerTools } from "./features.js";
import { keepPrevious } from "./journal/previous.js";

// Development only: `?probar-error` makes the app fail to show the error screen.
const CRASH_TEST =
  import.meta.env.DEV &&
  new URLSearchParams(location.search).has("probar-error");

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

const UPDATE_CHECK_MS = 60 * 60 * 1000;

function ServiceWorkerNotices() {
  const {
    offlineReady: [ready, setReady],
    needRefresh: [refresh],
    updateServiceWorker,
  } = useRegisterSW({
    // An app on the home screen is resumed, not reopened: look for a new
    // version every time it comes back, and every hour while open.
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (document.visibilityState === "visible" && navigator.onLine)
          registration.update().catch(() => {});
      };
      setInterval(check, UPDATE_CHECK_MS);
      document.addEventListener("visibilitychange", check);
    },
  });
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => setReady(false), 6000);
    return () => clearTimeout(timer);
  }, [ready]);
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
  if (CRASH_TEST) throw new Error("Prueba de la pantalla de error");
  const store = journal();
  const { data, recovery } = useJournal(store);
  const loadError = RECOVERY_MESSAGES[recovery] ?? "";
  const { tab, go, back, launch } = useNavigation({
    cloudConfigured,
    ownerTools,
  });
  const [now, setNow] = useState(Date.now()),
    [offline, setOffline] = useState(!navigator.onLine);
  const [goalFilter, setGoalFilter] = useState("active");
  // The first time on a phone with nothing yet: a short welcome instead of
  // an empty home. A link that asked for a screen (an invite) goes
  // straight there.
  const [welcome, setWelcome] = useState(
    () =>
      !recovery &&
      launch.tab === "goals" &&
      needsWelcome(store.get(), { search: location.search }),
  );
  // Someone back after a week or more: the pet is glad to see them.
  const [returning] = useState(
    () => !recovery && daysAway(store.get()) >= SLEEPY_DAYS,
  );
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
  const feedback = useFeedback({
    save: (next) => setData(next),
    onSaved: () => partner.onSaved(),
  });
  const { notify } = feedback;
  // A copy that came from the account (first sign-in or another device).
  function applyRemote(next, message) {
    // If the account's copy turns out to be the wrong one, Respaldo can
    // bring back what this phone had.
    keepPrevious(store.get(), next);
    store.replace(next, { remote: true });
    if (message) notify(message);
  }
  const cloud = useCloud({ latest: latestData, applyRemote, notify });
  cloudRef.current = cloud;
  const partner = usePartner({
    user: cloud.user,
    data,
    update: (change) => setData(change(latestData.current)),
    record: (change, detail) => {
      const before = latestData.current;
      return feedback.record(before, change(before), detail);
    },
    notify,
  });
  const actions = useGoalActions({
    data,
    partner,
    save: (next) => setData(next),
    record: feedback.record,
    notify,
    onRestored: () => setGoalFilter("active"),
  });
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
  useEffect(() => {
    // Dates move on by the minute, and not while the app is in the background.
    const timer = setInterval(() => {
      if (document.visibilityState !== "hidden") setNow(Date.now());
    }, 60 * 1000);
    const on = () => setOffline(!navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  useEffect(
    () =>
      store.subscribe((event) => {
        if (event.type === "saved") cloudRef.current.save(event.data);
        else if (event.type === "external") {
          actions.close();
          notify(
            "Tus cajitas se actualizaron desde otra pestaña. Revisa el cambio antes de continuar.",
          );
        } else if (event.type === "external-invalid") actions.close();
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
      if (goal) actions.move(goal);
    }).catch(() => {});
  }, []);
  // Coming back is enough: each day the app is opened counts as company.
  useEffect(() => {
    if (welcome || loadError) return;
    const current = latestData.current;
    if (!current.checkins.includes(today())) setData(checkIn(current));
  }, [welcome]);
  useEffect(() => {
    if (!ownerTools) return;
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
  function finishWelcome(next = "goals") {
    markWelcomed();
    setWelcome(false);
    go(next);
  }
  const pet = data.preferences;
  return (
    <div
      className={`app ${!pet.animations ? "reduced-motion" : ""} ${isNative ? "native-app" : ""} ${tab === "goal" ? "detail-open" : ""}`}
    >
      {welcome ? (
        <Welcome
          preferences={pet}
          cloudConfigured={cloud.configured}
          onChoosePet={(choice) =>
            setData({
              ...latestData.current,
              preferences: { ...latestData.current.preferences, ...choice },
            })
          }
          onCreate={(idea) => {
            finishWelcome();
            actions.create(idea);
          }}
          onAccount={() => {
            // Not marked as seen: if no sign-in happens, it greets again.
            setWelcome(false);
            go("account");
          }}
          onDone={() => finishWelcome()}
        />
      ) : (
        <AppShell tab={tab} back={back} onNavigate={go} pet={pet}>
          {offline && (
            <p className="offline" role="status">
              {cloud.user
                ? "Estás sin conexión. Tus cajitas siguen contigo y se guardan en tu cuenta cuando vuelva el internet."
                : "Estás sin conexión. Tus cajitas siguen contigo en este teléfono."}
            </p>
          )}
          {tab === "goals" && (
            <AccountNudge
              show={cloud.configured && cloud.status === "signed-out"}
              goals={data.goals.length}
              onAccount={() => go("account")}
            />
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
          {tab === "goals" && partner.pair && partner.extras && (
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
              cheering={feedback.excited}
              celebrating={feedback.confetti}
              checkIn={dueCheckIn(data, new Date(now))}
              onCheckIn={(goal) => actions.move(goal)}
              onLater={() => {
                if (setData(answerCheckIn(data)))
                  notify("¡Va! Aquí sigo cuando quieras 💛");
              }}
              actions={actions}
              onOpen={openGoal}
              onPet={() => haptic()}
              returning={returning}
            />
          )}
          {tab === "goals" && partner.pair && (
            <SharedGoals
              partner={partner}
              uid={cloud.user?.uid}
              now={now}
              onCelebrate={feedback.celebrate}
            />
          )}
          {detailGoal && (
            <GoalDetail
              goal={detailGoal}
              now={now}
              weekday={data.preferences.reminder.day}
              actions={actions}
              onBack={() => go("goals")}
              onFrequency={setFrequency}
              onActivity={() => go("history")}
            />
          )}
          {tab === "pet" && <PetRoom data={data} onSave={setData} />}
          {tab === "reminder" && (
            <Reminder data={data} onSave={setData} notify={notify} />
          )}
          {tab === "history" && (
            <History
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
              onCorrect={actions.correct}
            />
          )}
          {tab === "install" && (
            <Install notify={notify} signedIn={Boolean(cloud.user)} />
          )}
          {tab === "help" && <Help notify={notify} />}
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
          {tab === "settings" && (
            <Settings cloud={cloud} data={data} onNavigate={go} />
          )}
          {tab === "simulator" && ownerTools && <Simulator />}
          {tab === "connections" && ownerTools && (
            <Connections
              key={connectionVersion}
              data={data}
              setData={setData}
              notify={notify}
              record={feedback.record}
              onCreate={actions.create}
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
                    "Respaldo restaurado. Puedes activar de nuevo tu recordatorio en Ajustes.",
                  );
                } catch (error) {
                  notify(
                    `Respaldo restaurado. Revisa el recordatorio en Ajustes: ${error.message}`,
                  );
                }
                return true;
              }}
              notify={notify}
            />
          )}
        </AppShell>
      )}
      <GoalDialogs
        actions={actions}
        data={data}
        pet={pet}
        notify={notify}
        record={feedback.record}
      />
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
      <Feedback
        toast={feedback.toast}
        confetti={feedback.confetti}
        onDismiss={feedback.dismiss}
      />
    </div>
  );
}
