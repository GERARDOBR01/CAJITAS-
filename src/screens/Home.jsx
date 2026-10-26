import { useEffect, useRef, useState } from "react";
import Mascot from "../components/Mascot.jsx";
import { GoalCard } from "../components/Goals.jsx";
import Money from "../components/Money.jsx";
import { AddCircle } from "../components/icons.jsx";
import {
  balance,
  goalSummary,
  isComplete,
  moneyShort as money,
  nextGoal,
  plan,
} from "../domain.js";
import { rhythmLabel } from "../calendar.js";
import { petWords } from "../pet/catalog.js";
import { growthStage, overallProgress, petMood } from "../pet/state.js";

const TAP_LINES = [
  "¡Jiji, me haces cosquillas!",
  "Aquí ando, cuidando tus sueños 🌱",
  "Cada pasito cuenta ✦",
  "¡Otra vez, otra vez!",
  "Me gusta cuando vienes ♡",
];

/** What the pet says, from the moment: a celebration, a check-in, or the
 * next small step. */
function speech({
  pet,
  empty,
  celebrating,
  cheering,
  checkIn,
  returning,
  late,
  next,
}) {
  if (celebrating) return ["¡Lo lograste!", "Una meta cumplida. ¡Chócalas!"];
  if (cheering) return ["¡Eso!", "Un pasito más. Así se hace."];
  if (checkIn) return ["¡Llegó tu ratito!", checkIn.message.body];
  if (empty)
    return [`¡Hola, soy ${pet.petName}!`, "¿Para qué quieres ahorrar?"];
  // Back after a while: glad, never "te extrañé".
  if (returning)
    return ["¡Qué gusto verte!", "Cualquier monto cuenta, aunque sea poquito."];
  // A date that passed is a plan to adjust, not a failure.
  if (late)
    return [
      "¿Le damos más tiempo?",
      `La fecha de ${late.name} ya pasó. Tu sueño sigue aquí.`,
    ];
  if (next?.step)
    return [
      "¡Vamos por ese sueño!",
      `Tu pasito: ${money(next.step)} ${rhythmLabel(next.goal.frequency)} para ${next.goal.name}.`,
    ];
  return ["¡Vamos por ese sueño!", `${pet.petName} te echa porras.`];
}

export default function Home({
  data,
  filter,
  onFilter,
  now,
  cheering,
  celebrating,
  actions,
  onOpen,
  onPet,
  checkIn,
  onCheckIn,
  onLater,
  returning = false,
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
    active = data.goals.filter((g) => !g.archived && !isComplete(g)),
    completed = data.goals.filter((g) => !g.archived && isComplete(g)),
    archived = data.goals.filter((g) => g.archived),
    empty = data.goals.length === 0,
    progress = overallProgress(data),
    // Opening the app counts as company, so the pet is awake to greet.
    mood = petMood({
      celebrating,
      excited: cheering,
      waiting: Boolean(checkIn),
      happy: returning && !checkIn,
    });
  const late = active.find((g) => goalSummary(g, now).pastDue),
    goal = nextGoal(data),
    next = goal && {
      goal,
      // After its date there is no step: all that is left is not "a step".
      step: goalSummary(goal, now).pastDue
        ? null
        : plan(goal, goal.frequency, now, pet.reminder.day),
    };
  const [title, body] = speech({
    pet,
    empty,
    celebrating,
    cheering,
    checkIn,
    returning,
    late,
    next,
  });
  const list =
    filter === "completed"
      ? completed
      : filter === "archived"
        ? archived
        : active;
  const hero = useRef();
  useEffect(() => {
    if (cheering || celebrating)
      hero.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [cheering, celebrating]);
  return (
    <section className="home" aria-label="Inicio">
      <header
        ref={hero}
        className={`hero mood-${mood} ${celebrating || cheering ? "is-cheering" : ""}`}
      >
        <div className="hero-pet">
          <Mascot
            pet={pet.pet}
            name={pet.petName}
            accessory={pet.accessory}
            progress={progress}
            stage={growthStage(progress)}
            mood={mood}
            motion={pet.animations}
            // Empty home keeps one action: create the first cajita.
            interactive={!empty || pet.pet === "cat"}
            lines={words.lines}
            loveText={words.loveText}
            onPet={(kind) => {
              onPet?.();
              if (Date.now() < trickUntil.current) return;
              if (kind === "love")
                say(`${pet.petName} te dice: ${words.loveText} 💖`);
              else if (kind === "cuddle") say("Un abrazo para ti ♡");
              else say(TAP_LINES[taps.current++ % TAP_LINES.length]);
            }}
            onTrick={() => {
              trickUntil.current = Date.now() + 2500;
              say("¡Ta-dá! Mi truco secreto ✦");
            }}
          />
        </div>
        <div className="hero-speech">
          <h1>{title}</h1>
          <p aria-live="polite">{line || body}</p>
        </div>
        {total > 0 && (
          <p className="hero-total">
            <span>Llevas guardado</span>
            <strong>
              <Money cents={total} />
            </strong>
          </p>
        )}
      </header>

      {checkIn ? (
        <div className="hero-actions">
          <button
            className="primary big"
            onClick={() => onCheckIn(checkIn.goal)}
          >
            <AddCircle /> Guardar dinero
          </button>
          <button className="text-button" onClick={onLater}>
            Ahora no
          </button>
        </div>
      ) : active.length ? (
        <button
          className="primary big full"
          onClick={() =>
            actions.move(goal ?? active[0], {
              initialCents: next?.step || undefined,
            })
          }
        >
          <AddCircle /> Guardar dinero
        </button>
      ) : (
        <button className="primary big full" onClick={() => actions.create()}>
          <AddCircle />{" "}
          {empty ? "Crear mi primera cajita" : "Crear una cajita nueva"}
        </button>
      )}
      {late && !checkIn && !celebrating && !cheering && (
        <button
          className="secondary full more-time"
          onClick={() => actions.giveMoreTime(late)}
        >
          Darle 3 meses más a {late.name}
        </button>
      )}

      {!empty && (
        <section className="home-goals" aria-labelledby="home-goals-title">
          <div className="home-goals-head">
            <h2 id="home-goals-title">
              {filter === "completed"
                ? "Cumplidas"
                : filter === "archived"
                  ? "Archivadas"
                  : "Mis cajitas"}
            </h2>
            {filter !== "active" && (
              <button
                className="text-button"
                onClick={() => onFilter("active")}
              >
                Ver mis cajitas
              </button>
            )}
          </div>
          {list.length ? (
            <div className="cajitas">
              {list.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  now={now}
                  onOpen={onOpen}
                  actions={actions}
                />
              ))}
            </div>
          ) : (
            <p className="muted home-empty">
              {filter === "active"
                ? "Todas tus cajitas están cumplidas o archivadas. ¿Un sueño nuevo?"
                : "Aquí no hay nada todavía."}
            </p>
          )}
          {filter === "active" && active.length > 0 && (
            <button className="secondary full" onClick={() => actions.create()}>
              + Nueva cajita
            </button>
          )}
          {filter === "active" && (completed.length || archived.length) > 0 && (
            <p className="home-more">
              {completed.length > 0 && (
                <button
                  className="text-button"
                  onClick={() => onFilter("completed")}
                >
                  Cumplidas ({completed.length})
                </button>
              )}
              {archived.length > 0 && (
                <button
                  className="text-button"
                  onClick={() => onFilter("archived")}
                >
                  Archivadas ({archived.length})
                </button>
              )}
            </p>
          )}
        </section>
      )}
    </section>
  );
}
