import { useState } from "react";
import {
  correctManualEntry,
  localDate,
  recordEntry,
  removeManualEntry,
} from "../domain.js";

/**
 * What a person can do with their cajitas from any screen: create one,
 * record a movement, edit or archive it, correct a manual entry, import an
 * email, or move money through the guardian. It owns which dialog is open
 * and the change each dialog saves. `save(next)` keeps a change and
 * `record(before, next, detail)` keeps one that answers like a saving.
 */
export function useGoalActions({
  data,
  partner,
  save,
  record,
  notify,
  onRestored,
}) {
  const [dialog, setDialog] = useState(null);
  const close = () => setDialog(null);
  // Every dialog reads its cajita from the journal as it is now.
  const goalOf = (id) => data.goals.find((g) => g.id === id);
  const guardianName = partner.partnerName || "tu guardián";
  const pendingOut = (goalId) => partner.pending[goalId]?.out ?? 0;

  return {
    dialog,
    close,
    goalOf,
    /** `idea` ({ name, icon }) starts the form, e.g. from the welcome. A
     * click event passed by an `onClick` is not an idea. */
    create: (idea) =>
      setDialog({
        type: "new",
        idea: typeof idea?.name === "string" ? idea : null,
      }),
    move: (goal, { withdraw = false, initialCents } = {}) =>
      setDialog({ type: "movement", goalId: goal.id, withdraw, initialCents }),
    edit: (goal) => setDialog({ type: "edit", goalId: goal.id }),
    correct: (entry) =>
      setDialog({ type: "correct", goalId: entry.goalId, entryId: entry.id }),
    importMail: (goal) => setDialog({ type: "mail", goalId: goal.id }),
    /** What a goal shows about the guardian, or null without one. */
    guardianFor: (goalId) =>
      partner.guardian && {
        name: guardianName,
        pending: partner.pending[goalId],
        onDeposit: (goal, withdraw) =>
          setDialog({ type: "deposit", goalId: goal.id, withdraw }),
      },

    saveNew(goal) {
      if (save({ ...data, goals: [...data.goals, goal] })) {
        close();
        notify("Tu nueva cajita está lista.");
      }
    },
    saveMovement({ cents, at, goalId }) {
      let next;
      try {
        next = recordEntry(data, goalId ?? dialog.goalId, { cents, at }).data;
      } catch (error) {
        notify(error.message || "No pudimos guardar el cambio.");
        return;
      }
      if (record(data, next)) close();
    },
    saveEdit(goal) {
      const next = {
        ...data,
        goals: data.goals.map((g) => (g.id === goal.id ? goal : g)),
      };
      if (record(data, next, "Tu plan se ajustó. Seguimos a tu ritmo."))
        close();
    },
    /** A date that already passed, moved three months ahead in one tap. */
    giveMoreTime(goal) {
      const date = new Date();
      date.setMonth(date.getMonth() + 3);
      const next = {
        ...data,
        goals: data.goals.map((g) =>
          g.id === goal.id ? { ...g, unlockDate: localDate(date) } : g,
        ),
      };
      if (save(next))
        notify(`Listo: 3 meses más para ${goal.name}. Sin prisa ♡`);
    },
    toggleArchive(goal) {
      const next = {
        ...data,
        goals: data.goals.map((g) =>
          g.id === goal.id ? { ...g, archived: !g.archived } : g,
        ),
      };
      if (!save(next)) return;
      close();
      if (goal.archived) onRestored();
      notify(
        goal.archived
          ? "Tu cajita está de vuelta."
          : "Cajita archivada. Su historia está a salvo.",
      );
    },
    saveCorrection(value) {
      const { goalId, entryId } = dialog;
      if (save(correctManualEntry(data, goalId, entryId, value))) {
        close();
        notify("Registro corregido. Tu historial ya está actualizado.");
      }
    },
    removeCorrected() {
      const { goalId, entryId } = dialog;
      if (save(removeManualEntry(data, goalId, entryId))) {
        close();
        notify(
          "Registro eliminado. Si fue un error, lo recuperas en Ajustes → Historial → Papelera.",
        );
      }
    },

    deposit: partner.guardian && {
      guardian: partner.guardian,
      name: guardianName,
      pendingOut,
      send: (goal, cents, method) =>
        partner.deposit(goal, cents, method, pendingOut(goal.id)),
    },
  };
}
