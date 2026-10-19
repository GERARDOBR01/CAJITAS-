import { useEffect, useRef, useState } from "react";
import { haptic } from "../platform.js";
import { answerCheckIn } from "../pet/reminders.js";
import { EXCITED_MS } from "../pet/state.js";
import { GOAL_REACHED, savingResponse } from "./response.js";

const TOAST_MS = 7000,
  CONFETTI_MS = 5000;

/**
 * What the person sees and feels after something happens: the toast, the
 * confetti and the happy mascot. `record` saves a change to the journal and
 * answers it with the respuesta al ahorro; `save(next)` returns whether the
 * change was kept and `onSaved()` tells the couple a saving happened.
 */
export function useFeedback({ save, onSaved }) {
  const [toast, setToast] = useState(""),
    [confetti, setConfetti] = useState(false),
    [excited, setExcited] = useState(false);
  const timers = useRef({}),
    callbacks = useRef();
  callbacks.current = { save, onSaved };
  useEffect(
    () => () => Object.values(timers.current).forEach(clearTimeout),
    [],
  );
  function later(name, fn, ms) {
    clearTimeout(timers.current[name]);
    timers.current[name] = setTimeout(fn, ms);
  }
  function notify(message) {
    setToast(message);
    later("toast", () => setToast(""), TOAST_MS);
  }
  function present({ kind, message }) {
    if (kind === "celebrate") {
      setConfetti(true);
      haptic(true);
      later("confetti", () => setConfetti(false), CONFETTI_MS);
    } else if (kind === "cheer") {
      haptic();
      setExcited(true);
      later("excited", () => setExcited(false), EXCITED_MS);
    }
    if (message) notify(message);
  }
  function record(before, next, detail = "", now = new Date()) {
    const response = savingResponse(before, next, detail);
    const kept =
      response.saved && next.preferences.reminder.enabled
        ? answerCheckIn(next, now)
        : next;
    if (!callbacks.current.save(kept)) return false;
    if (response.saved) callbacks.current.onSaved();
    present(response);
    return true;
  }
  return {
    toast,
    confetti,
    excited,
    notify,
    record,
    /** For goals kept outside the journal (cajitas en pareja). */
    celebrate: () => present({ kind: "celebrate", message: GOAL_REACHED }),
    dismiss: () => setToast(""),
  };
}
