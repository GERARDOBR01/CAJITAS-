/** The toast and the confetti `useFeedback` asks for. */
export default function Feedback({ toast, confetti, onDismiss }) {
  return (
    <>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="Cerrar aviso" onClick={onDismiss}>
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
    </>
  );
}
