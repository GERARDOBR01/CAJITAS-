import { useEffect, useId, useRef } from "react";
export default function Modal({
  title,
  subtitle,
  sheet = false,
  children,
  onClose,
}) {
  const ref = useRef(),
    id = useId();
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${sheet ? "sheet" : ""}`}
      aria-labelledby={id}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {sheet && <span className="sheet-handle" aria-hidden="true" />}
      <div className="modal-head">
        <div>
          <h2 id={id}>{title}</h2>
          {subtitle && <p className="muted modal-sub">{subtitle}</p>}
        </div>
        <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
