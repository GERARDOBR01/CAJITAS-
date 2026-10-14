import { useEffect, useId, useRef } from "react";
export default function Modal({ title, children, onClose }) {
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
      className="modal"
      aria-labelledby={id}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id={id}>{title}</h2>
        <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
