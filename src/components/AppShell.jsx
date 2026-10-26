import { ArrowLeft, Tune } from "./icons.jsx";
import Mascot from "./Mascot.jsx";

/**
 * One screen at a time, no tab bar: home has the brand, the pet and
 * Ajustes; every other screen has a way back.
 */
export default function AppShell({ tab, back, onNavigate, pet, children }) {
  const home = tab === "goals";
  return (
    <div className="shell">
      <header className="shell-bar">
        {home ? (
          <span className="shell-brand">guardadito</span>
        ) : (
          <button
            className="shell-back"
            onClick={() => onNavigate(back)}
            aria-label={back === "goals" ? "Volver al inicio" : "Volver"}
          >
            <ArrowLeft />
            <span>{back === "goals" ? "Inicio" : "Ajustes"}</span>
          </button>
        )}
        {home && (
          <span className="shell-actions">
            <button
              className="shell-icon shell-pet"
              aria-label={`Mi mascota, ${pet.petName}`}
              onClick={() => onNavigate("pet")}
            >
              <Mascot pet={pet.pet} small accessory={pet.accessory} />
            </button>
            <button
              className="shell-icon"
              aria-label="Ajustes"
              onClick={() => onNavigate("settings")}
            >
              <Tune />
            </button>
          </span>
        )}
      </header>
      <main className="shell-main">{children}</main>
    </div>
  );
}
