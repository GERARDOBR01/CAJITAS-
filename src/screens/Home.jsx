import { useEffect, useRef } from "react";
import Mascot from "../components/Mascot.jsx";
import { GoalCard } from "../components/Goals.jsx";
import { balance, money } from "../domain.js";

export default function Home({
  data,
  filter,
  onFilter,
  now,
  sad,
  cheering,
  celebrating,
  onCreate,
  onMove,
  onEdit,
  onFrequency,
  onPet,
}) {
  const pet = data.preferences,
    total = data.goals.reduce((sum, goal) => sum + balance(goal), 0),
    target = data.goals.reduce((sum, goal) => sum + goal.targetCents, 0),
    visibleGoals = data.goals.filter((goal) =>
      filter === "archived"
        ? goal.archived
        : !goal.archived &&
          (filter === "completed" ? balance(goal) >= goal.targetCents : true),
    ),
    empty = data.goals.length === 0;
  const greeting = useRef();
  useEffect(() => {
    if (sad || cheering || celebrating)
      greeting.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [sad, cheering, celebrating]);
  return (
    <section className="home" aria-label="Inicio">
      <header
        ref={greeting}
        className={`home-greeting ${empty ? "is-empty" : ""} ${sad ? "is-sad" : celebrating || cheering ? "is-cheering" : ""}`}
      >
        <div className="home-speech">
          <p className="eyebrow">TU EQUIPO DE AHORRO</p>
          <h1>
            {sad
              ? "Aquí seguimos contigo."
              : celebrating
                ? "¡Lo lograste!"
                : cheering
                  ? "¡Ese ahorro se aplaude!"
                  : empty
                    ? `¡Hola, soy ${pet.petName}!`
                    : "¡Vamos por ese sueño!"}
          </h1>
          <p>
            {sad
              ? "Los planes cambian. Vamos a tu ritmo."
              : celebrating
                ? "Una meta cumplida. ¡Chócalas!"
                : cheering
                  ? "Tu cajita ya tiene un pasito más."
                  : empty
                    ? "Hagamos espacio para lo que quieres."
                    : `${pet.petName} te echa porras.`}
          </p>
        </div>
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
            progress={target ? total / target : 0}
            sad={sad}
            celebrating={celebrating || cheering}
            interactive={!empty}
            onPet={onPet}
          />
        </div>
        {total > 0 && (
          <p className="home-total">
            <span>Ahorro registrado</span>
            <strong>
              {money(total)} <small>MXN</small>
            </strong>
          </p>
        )}
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
                onFrequency={onFrequency}
                onMove={onMove}
                onEdit={onEdit}
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
      </section>
    </section>
  );
}
