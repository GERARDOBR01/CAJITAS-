import { useState } from "react";
import Mascot from "./Mascot.jsx";
import { PETS, availablePets } from "../pet/catalog.js";
import GoalIcon from "../goals/GoalIcon.jsx";

export const WELCOMED_KEY = "guardadito:welcomed";

/**
 * Whether to greet this person with the welcome: the first time, on a phone
 * with no cajitas yet. Browsers driven by tests skip it unless the address
 * asks for it with `?bienvenida=1`.
 */
export function needsWelcome(data, { storage, search = "", automated } = {}) {
  if (new URLSearchParams(search).get("bienvenida") === "1") return true;
  if (automated ?? globalThis.navigator?.webdriver) return false;
  if (data.goals.length || data.checkins.length) return false;
  try {
    return (storage ?? globalThis.localStorage).getItem(WELCOMED_KEY) !== "1";
  } catch {
    return false;
  }
}

export function markWelcomed(storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(WELCOMED_KEY, "1");
  } catch {
    /* It may greet once more; nothing else depends on it. */
  }
}

// Each idea names the cajita and gives it its icon.
const IDEAS = [
  { name: "Un viaje", icon: "plane" },
  { name: "Mi colchoncito", icon: "shield" },
  { name: "Algo para mí", icon: "star" },
  { name: "Un regalo", icon: "gift" },
];

/**
 * Two steps for someone who just arrived: who keeps them company, and what
 * they want to save for. Everything can be changed later.
 */
export default function Welcome({
  preferences,
  cloudConfigured,
  onChoosePet,
  onCreate,
  onAccount,
  onDone,
}) {
  const pets = availablePets(preferences).filter((key) => !PETS[key].special);
  const [step, setStep] = useState(1),
    [pet, setPet] = useState(
      pets.includes(preferences.pet) ? preferences.pet : pets[0],
    ),
    [name, setName] = useState(preferences.petName || PETS[pet].name),
    [error, setError] = useState("");
  const shown = name.trim() || PETS[pet].name;

  function choose(key) {
    // A name typed by the person stays; the default follows the pet.
    if (!name.trim() || name === PETS[pet].name) setName(PETS[key].name);
    setPet(key);
  }
  function next(e) {
    e.preventDefault();
    if (shown.length > 32) {
      setError("Usa un nombre de hasta 32 letras.");
      return;
    }
    if (onChoosePet({ pet, petName: shown })) setStep(2);
  }

  return (
    <main className="welcome" aria-labelledby="welcome-title">
      <header className="welcome-top">
        <strong>guardadito</strong>
        <span>Paso {step} de 2</span>
      </header>
      {step === 1 ? (
        <form className="welcome-step" onSubmit={next}>
          <div className="welcome-pet">
            <Mascot pet={pet} name={shown} accessory={preferences.accessory} />
          </div>
          <h1 id="welcome-title">Tu guardadito, pasito a pasito</h1>
          <p className="welcome-lead">
            Anota lo que apartas. Guardadito no mueve tu dinero: te echa porras.
          </p>
          <fieldset className="welcome-pets">
            <legend>Elige a tu compañero de ahorro</legend>
            {pets.map((key) => (
              <button
                type="button"
                key={key}
                aria-pressed={pet === key}
                onClick={() => choose(key)}
              >
                <Mascot pet={key} small />
                <span>{PETS[key].label}</span>
              </button>
            ))}
          </fieldset>
          <label>
            ¿Cómo se va a llamar?
            <input
              value={name}
              maxLength={32}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder={PETS[pet].name}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <p className="welcome-note">Puedes cambiarlo cuando quieras.</p>
          <button className="primary full">Empezar con {shown}</button>
          {cloudConfigured && (
            <button
              type="button"
              className="text-button full"
              onClick={onAccount}
            >
              Ya tengo cuenta
            </button>
          )}
        </form>
      ) : (
        <section className="welcome-step">
          <div className="welcome-pet">
            <Mascot
              pet={pet}
              name={shown}
              accessory={preferences.accessory}
              mood="happy"
            />
          </div>
          <h1 id="welcome-title">¿Para qué quieres ahorrar?</h1>
          <p className="welcome-lead">
            Cada sueño vive en una cajita. {shown} te dice cuánto apartar.
          </p>
          <div className="welcome-ideas" role="group" aria-label="Ideas">
            {IDEAS.map((idea) => (
              <button
                type="button"
                key={idea.name}
                className="secondary"
                onClick={() => onCreate(idea)}
              >
                <GoalIcon icon={idea.icon} size="sm" />
                {idea.name}
              </button>
            ))}
          </div>
          <button className="primary full" onClick={() => onCreate()}>
            Crear mi primera cajita
          </button>
          <button className="text-button full" onClick={onDone}>
            Lo hago después
          </button>
        </section>
      )}
    </main>
  );
}
