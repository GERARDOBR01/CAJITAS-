import { ClockCircle, MenuDots, SmileCircle, Wallet } from "./icons.jsx";

const navigation = [
  ["goals", <Wallet />, "Mis cajitas"],
  ["pet", <SmileCircle />, "Mi mascota"],
  ["activity", <ClockCircle />, "Actividad"],
  ["more", <MenuDots />, "Más"],
];
const tools = [
  "simulator",
  "connections",
  "backup",
  "install",
  "tutorial",
  "account",
  "partner",
];
export default function AppShell({
  tab,
  onNavigate,
  goalCount,
  pet,
  children,
}) {
  function nav(className, label) {
    return (
      <nav className={className} aria-label={label}>
        {navigation.map(([key, icon, title]) => {
          const selected =
            tab === key || (key === "more" && tools.includes(tab));
          return (
            <button
              key={key}
              aria-current={selected ? "page" : undefined}
              className={selected ? "active" : ""}
              onClick={() => onNavigate(key)}
            >
              <span aria-hidden="true">{icon}</span>
              <span>{title}</span>
              {key === "goals" && goalCount > 0 && (
                <small aria-hidden="true">{goalCount}</small>
              )}
            </button>
          );
        })}
      </nav>
    );
  }
  return (
    <>
      <aside className="sidebar">
        <a
          className="brand"
          href={import.meta.env.BASE_URL}
          aria-label="Guardadito inicio"
        >
          <span className="brand-icon" aria-hidden="true">
            ▣
          </span>
          guardadito
          <span className="brand-dot" aria-hidden="true">
            ✦
          </span>
        </a>
        <p className="brand-caption">Tu equipo de ahorro.</p>
        {nav("desktop-nav", "Navegación principal")}
        {nav("mobile-nav", "Navegación de la app")}
        <p className="local-badge">✦ Guardado en tu dispositivo</p>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>Tu ahorro, a tu ritmo.</span>
          <button
            className="avatar avatar-pet"
            aria-label="Personalizar mi mascota"
            onClick={() => onNavigate("pet")}
          >
            <span aria-hidden="true">
              {pet.pet === "cat"
                ? "🐱"
                : pet.pet === "pig"
                  ? "🐷"
                  : pet.pet === "cow"
                    ? "🐮"
                    : pet.pet === "bunny"
                      ? "🐰"
                      : pet.pet === "dog"
                        ? "🐶"
                        : pet.pet === "otter"
                          ? "🦦"
                          : "🌱"}
            </span>
          </button>
        </header>
        <main>
          {children}
          <footer>
            <span>guardadito ✦</span>
            <p>Cuida tus sueños. Ahorra a tu ritmo.</p>
          </footer>
        </main>
      </div>
    </>
  );
}
