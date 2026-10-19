import { useEffect, useRef, useState } from "react";
import Mascot from "../components/Mascot.jsx";
import { GoalCard } from "../components/Goals.jsx";
import NextStep from "../components/NextStep.jsx";
import Money from "../components/Money.jsx";
import { ShieldCheck } from "../components/icons.jsx";
import { balance, nextGoal, petWords } from "../domain.js";
import {
  STAGE_NAMES,
  daysAway,
  growthStage,
  overallProgress,
  petMood,
} from "../pet/state.js";

const TAP_LINES = [
  "¡Jiji, me haces cosquillas!",
  "Aquí ando, cuidando tus sueños 🌱",
  "¿Sabías que cada pasito cuenta? ✦",
  "¡Otra vez, otra vez!",
  "Me gusta cuando vienes ♡",
];

export default function Home({
  data,
  filter,
  onFilter,
  now,
  cheering,
  celebrating,
  onCreate,
  onMove,
  guardian,
  onEdit,
  onRecord,
  onOpen,
  onPet,
  checkIn,
  onCheckIn,
  onLater,
}) {
  const [line, setLine] = useState("");
  const lineTimer = useRef(),
    taps = useRef(0),
    trickUntil = useRef(0);
  useEffect(() => () => clearTimeout(lineTimer.current), []);
  function say(text) {
    setLine(text);
    clearTimeout(lineTimer.current);
    lineTimer.current = setTimeout(() => setLine(""), 3200);
  }
  const pet = data.preferences,
    words = petWords(pet),
    total = data.goals.reduce((sum, goal) => sum + balance(goal), 0),
    target = data.goals.reduce((sum, goal) => sum + goal.targetCents, 0),
    visibleGoals = data.goals.filter((goal) =>
      filter === "archived"
        ? goal.archived
        : !goal.archived &&
          (filter === "completed" ? balance(goal) >= goal.targetCents : true),
    ),
    empty = data.goals.length === 0,
    progress = overallProgress(data),
    stage = growthStage(progress),
    away = daysAway(data, new Date(now)),
    waiting = Boolean(checkIn),
    mood = petMood({
      celebrating,
      excited: cheering,
      waiting,
      daysAway: away,
    });
  const greeting = useRef();
  useEffect(() => {
    if (cheering || celebrating)
      greeting.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [cheering, celebrating]);
  return (
    <section className="home" aria-label="Inicio">
      <header
        ref={greeting}
        className={`home-greeting mood-${mood} ${empty ? "is-empty" : ""} ${celebrating || cheering ? "is-cheering" : ""}`}
      >
        <div className="home-speech">
          <p className="eyebrow">Tu equipo de ahorro</p>
          <h1>
            {celebrating
              ? "¡Lo lograste!"
              : cheering
                ? "¡Ese ahorro se aplaude!"
                : waiting
                  ? "¡Llegó tu ratito de ahorro!"
                  : empty
                    ? `¡Hola, soy ${pet.petName}!`
                    : mood === "sleepy"
                      ? `${pet.petName} toma una siesta`
                      : "¡Vamos por ese sueño!"}
          </h1>
          <p aria-live="polite">
            {line ||
              (celebrating
                ? "Una meta cumplida. ¡Chócalas!"
                : cheering
                  ? "Tu cajita ya tiene un pasito más."
                  : waiting
                    ? checkIn.message.body
                    : empty
                      ? "Hagamos espacio para lo que quieres."
                      : mood === "sleepy"
                        ? "Tócame para despertar. Te extrañaba 💤"
                        : `${pet.petName} te echa porras.`)}
          </p>
        </div>
        <div className="home-hero">
          <div className="home-mascot">
            <span className="home-doodle doodle-star" aria-hidden="true">
              ✦
            </span>
            <span className="home-doodle doodle-heart" aria-hidden="true">
              ♡
            </span>
            <Mascot
              pet={pet.pet}
              name={pet.petName}
              accessory={pet.accessory}
              progress={progress}
              stage={stage}
              mood={mood}
              motion={pet.animations}
              interactive={!empty || pet.pet === "cat"}
              lines={words.lines}
              loveText={words.loveText}
              onPet={(kind) => {
                onPet?.();
                if (Date.now() < trickUntil.current) return;
                if (kind === "love")
                  say(`${pet.petName} te dice: ${words.loveText} 💖`);
                else if (kind === "cuddle")
                  say("Un abrazo para ti. Gracias por venir ♡");
                else say(TAP_LINES[taps.current++ % TAP_LINES.length]);
              }}
              onTrick={() => {
                trickUntil.current = Date.now() + 2500;
                say("¡Ta-dá! Mi truco secreto ✦");
              }}
            />
            {!empty && (
              <span className="sprout-stage">🌱 {STAGE_NAMES[stage]}</span>
            )}
          </div>
          {total > 0 && (
            <p className="home-total">
              <span>Llevas guardado</span>
              <strong>
                <Money cents={total} /> <small>MXN</small>
              </strong>
            </p>
          )}
        </div>
        {waiting && (
          <div className="checkin-actions">
            <button className="primary" onClick={() => onCheckIn(checkIn.goal)}>
              Registrar lo que aparté
            </button>
            <button className="secondary" onClick={onLater}>
              Ahora no
            </button>
          </div>
        )}
        <NextStep
          goal={nextGoal(data)}
          onRecord={onRecord}
          onEdit={onEdit}
          weekday={data.preferences.reminder.day}
        />
      </header>
      <section className="home-goals" aria-labelledby="home-goals-title">
        <div className="goals-title">
          <h2 id="home-goals-title">
            {empty ? "¿Qué te hace ilusión?" : "Mis cajitas"}
          </h2>
          {!empty && (
            <span>
              {data.goals.length} {data.goals.length === 1 ? "sueño" : "sueños"}
            </span>
          )}
        </div>
        {!empty && (
          <div
            className="goal-filters"
            role="group"
            aria-label="Filtrar cajitas"
          >
            {[
              ["active", "Activas"],
              ["completed", "Cumplidas"],
              ["archived", "Archivadas"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={filter === key ? "active" : ""}
                aria-pressed={filter === key}
                onClick={() => onFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {visibleGoals.length ? (
          <div className="goals-grid">
            {visibleGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                now={now}
                onOpen={onOpen}
                onMove={onMove}
                onEdit={onEdit}
                guardian={
                  guardian && {
                    ...guardian,
                    pending: guardian.pending[goal.id],
                  }
                }
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>
              {empty
                ? "Tu primer sueño empieza con una cajita."
                : filter === "archived"
                  ? "Tus cajitas archivadas aparecerán aquí con su historial."
                  : filter === "completed"
                    ? "Cada meta llega a su tiempo. Aquí celebraremos la tuya."
                    : "Aquí cabe tu siguiente sueño."}
            </p>
          </div>
        )}
        <button className="primary new-goal" onClick={onCreate}>
          + Nueva cajita
        </button>
        {!empty && (
          <p className="home-assurance">
            <ShieldCheck />
            Guardadito no mueve tu dinero, solo lo registra.
          </p>
        )}
      </section>
    </section>
  );
}
