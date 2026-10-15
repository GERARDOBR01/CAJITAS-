import { GoalForm, MovementForm } from "./Goals.jsx";
import CorrectEntry from "./CorrectEntry.jsx";
import Modal from "./Modal.jsx";
import LocalMailImport from "./LocalMailImport.jsx";
import { balance, correctManualEntry, removeManualEntry } from "../domain.js";

export default function GoalDialogs({
  modal,
  data,
  setData,
  setModal,
  movement,
  pet,
  notify,
  celebrate,
  setGoalFilter,
}) {
  return (
    <>
      {modal?.type === "new" && (
        <GoalForm
          onClose={() => setModal(null)}
          onSave={(goal) => {
            if (setData({ ...data, goals: [...data.goals, goal] })) {
              setModal(null);
              notify("Tu nueva cajita está lista.");
            }
          }}
        />
      )}{" "}
      {modal?.type === "movement" && (
        <MovementForm
          goal={data.goals.find((g) => g.id === modal.goal.id)}
          withdraw={modal.withdraw}
          onClose={() => setModal(null)}
          onSave={movement}
          preferences={pet}
          initialCents={modal.initialCents}
          onImport={(goal) => setModal({ type: "mail", goal })}
        />
      )}
      {modal?.type === "mail" && (
        <Modal
          title="Un comprobante en tu cajita"
          onClose={() => setModal(null)}
        >
          <LocalMailImport
            data={data}
            onSave={setData}
            notify={notify}
            celebrate={celebrate}
            initialGoalId={modal.goal.id}
            compact
            onDone={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.type === "correct" && (
        <CorrectEntry
          goal={data.goals.find((g) => g.id === modal.goalId)}
          entry={data.goals
            .find((g) => g.id === modal.goalId)
            .entries.find((e) => e.id === modal.entryId)}
          onClose={() => setModal(null)}
          onSave={(value) => {
            const next = correctManualEntry(
              data,
              modal.goalId,
              modal.entryId,
              value,
            );
            if (setData(next)) {
              setModal(null);
              notify("Registro corregido. Tu historial ya está actualizado.");
            }
          }}
          onRemove={() => {
            const next = removeManualEntry(data, modal.goalId, modal.entryId);
            if (setData(next)) {
              setModal(null);
              notify("Registro equivocado eliminado.");
            }
          }}
        />
      )}
      {modal?.type === "edit" && (
        <GoalForm
          goal={data.goals.find((g) => g.id === modal.goal.id)}
          onClose={() => setModal(null)}
          onSave={(goal) => {
            const previous = data.goals.find((g) => g.id === goal.id);
            if (
              setData({
                ...data,
                goals: data.goals.map((g) => (g.id === goal.id ? goal : g)),
              })
            ) {
              setModal(null);
              if (
                balance(previous) < previous.targetCents &&
                balance(goal) >= goal.targetCents
              )
                celebrate();
              else notify("Tu plan se ajustó. Seguimos a tu ritmo.");
            }
          }}
          onArchive={(goal) => {
            if (
              setData({
                ...data,
                goals: data.goals.map((g) =>
                  g.id === goal.id ? { ...g, archived: !g.archived } : g,
                ),
              })
            ) {
              setModal(null);
              if (goal.archived) setGoalFilter("active");
              notify(
                goal.archived
                  ? "Tu cajita está de vuelta."
                  : "Cajita archivada. Su historia está a salvo.",
              );
            }
          }}
        />
      )}
    </>
  );
}
