import { useState } from "react";
import Mascot from "./Mascot.jsx";
import { PETS, availablePets, petWords } from "../pet/catalog.js";
import {
  companionship,
  goalSummary,
  isComplete,
  savedWeeks,
} from "../domain.js";
import { haptic } from "../platform.js";
import {
  daysAway,
  growthStage,
  overallProgress,
  petMood,
  STAGE_NAMES,
} from "../pet/state.js";

const ACCESSORIES = [
  ["leaf", "🌱", "Brote"],
  ["bow", "🎀", "Moñito"],
  ["scarf", "🧣", "Bufanda"],
  ["star", "⭐", "Estrella"],
];

/** The companion: how the friendship goes, and how it looks. Every choice
 * is kept the moment it is made. */
export default function PetRoom({ data, onSave }) {
  const prefs = data.preferences,
    friend = companionship(data),
    weeks = savedWeeks(data.goals),
    [name, setName] = useState(prefs.petName),
    [bubble, setBubble] = useState("");
  const keep = (change) =>
    onSave({ ...data, preferences: { ...prefs, ...change } });
  function rename() {
    const clean = name.trim();
    if (!clean) setName(prefs.petName);
    else if (clean !== prefs.petName) keep({ petName: clean });
  }
  const anyDeposit = data.goals.some((g) => g.entries.some((e) => e.cents > 0));
  const badges = [
    { icon: "✦", title: "Tu primer pasito", unlocked: anyDeposit },
    {
      icon: "◐",
      title: "Una cajita a la mitad",
      unlocked: data.goals.some((g) => goalSummary(g).progress >= 0.5),
    },
    {
      icon: "✿",
      title: "Una meta cumplida",
      unlocked: data.goals.some(isComplete),
    },
    { icon: "☀", title: "4 semanas guardando", unlocked: weeks >= 4 },
  ];
  return (
    <section className="pet-room" aria-labelledby="pet-title">
      <div className="pet-stage">
        <span className="pet-level">
          Nivel {friend.level} · {friend.title}
        </span>
        <Mascot
          pet={prefs.pet}
          name={prefs.petName}
          accessory={prefs.accessory}
          progress={overallProgress(data)}
          mood={petMood({ daysAway: daysAway(data) })}
          motion={prefs.animations}
          interactive
          lines={petWords(prefs).lines}
          loveText={petWords(prefs).loveText}
          onTrick={() => setBubble("¡Ta-dá! Mi truco secreto ✦")}
          onPet={() => {
            haptic();
            setBubble("Un abrazo para ti ♡");
          }}
        />
        <h1 id="pet-title">{prefs.petName}</h1>
        <p className="pet-speech" aria-live="polite">
          {bubble || petWords(prefs).motto}
        </p>
        <div className="friendship-meter">
          <div className="progress">
            <span style={{ width: `${friend.progress * 100}%` }} />
          </div>
          <p>
            {friend.next
              ? `${friend.days} días juntos · ${friend.next - friend.days} para el nivel ${friend.level + 1}`
              : `${friend.days} días juntos`}
          </p>
        </div>
        <p className="sprout-stage">
          🌱 Su brote: {STAGE_NAMES[growthStage(overallProgress(data))]}
        </p>
      </div>

      <section className="pet-section" aria-labelledby="pet-wins">
        <h2 id="pet-wins">Tus logros</h2>
        <p className="pet-weeks">
          <strong>{weeks}</strong>{" "}
          {weeks === 1 ? "semana en que guardaste" : "semanas en que guardaste"}
        </p>
        <ul className="badge-collection">
          {badges.map((b) => (
            <li key={b.title} className={b.unlocked ? "earned" : "waiting"}>
              <span aria-hidden="true">{b.icon}</span>
              <strong>{b.title}</strong>
              <small>{b.unlocked ? "¡Logrado!" : "A tu ritmo"}</small>
            </li>
          ))}
        </ul>
      </section>

      <section className="pet-section" aria-labelledby="pet-look">
        <h2 id="pet-look">¿Quién te acompaña?</h2>
        <div className="pet-options">
          {availablePets(prefs).map((key) => (
            <button
              type="button"
              key={key}
              aria-pressed={prefs.pet === key}
              aria-label={`Elegir ${PETS[key].label}`}
              onClick={() => {
                const renamed = prefs.petName !== PETS[prefs.pet]?.name;
                const petName = renamed ? prefs.petName : PETS[key].name;
                setName(petName);
                keep({ pet: key, petName });
              }}
            >
              <Mascot pet={key} small accessory={prefs.accessory} />
              <small>{PETS[key].label}</small>
            </button>
          ))}
        </div>
        <label>
          Su nombre
          <input
            value={name}
            maxLength={32}
            onChange={(e) => setName(e.target.value)}
            onBlur={rename}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        </label>
        <fieldset className="chips">
          <legend>Su detalle favorito</legend>
          {ACCESSORIES.map(([key, icon, title]) => (
            <button
              type="button"
              aria-pressed={prefs.accessory === key}
              key={key}
              onClick={() => keep({ accessory: key })}
            >
              <span aria-hidden="true">{icon}</span> {title}
            </button>
          ))}
        </fieldset>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={prefs.animations}
            onChange={(e) => keep({ animations: e.target.checked })}
          />
          Animaciones y destellitos
        </label>
      </section>
    </section>
  );
}
