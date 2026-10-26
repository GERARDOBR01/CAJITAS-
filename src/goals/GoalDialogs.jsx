import { GoalForm, MovementForm } from "../components/Goals.jsx";
import CorrectEntry from "../components/CorrectEntry.jsx";
import Modal from "../components/Modal.jsx";
import LocalMailImport from "../components/LocalMailImport.jsx";
import { DepositDialog } from "../components/Guardian.jsx";
import { ownerTools } from "../features.js";

/** The dialog `useGoalActions` has open, if any. */
export default function GoalDialogs({ actions, data, pet, notify, record }) {
  const { dialog, close } = actions;
  const goal = dialog?.goalId && actions.goalOf(dialog.goalId);
  if (!dialog || (dialog.goalId && !goal)) return null;
  const weekday = data.preferences.reminder.day;
  switch (dialog.type) {
    case "new":
      return (
        <GoalForm
          weekday={weekday}
          onClose={close}
          onSave={actions.saveNew}
          idea={dialog.idea}
        />
      );
    case "movement":
      return (
        <MovementForm
          weekday={weekday}
          goal={goal}
          goals={data.goals.filter((g) => !g.archived)}
          withdraw={dialog.withdraw}
          onClose={close}
          onSave={actions.saveMovement}
          preferences={pet}
          initialCents={dialog.initialCents}
          onImport={ownerTools ? actions.importMail : undefined}
        />
      );
    case "mail":
      return (
        <Modal title="Un comprobante en tu cajita" onClose={close}>
          <LocalMailImport
            data={data}
            record={record}
            notify={notify}
            initialGoalId={goal.id}
            compact
            onDone={close}
          />
        </Modal>
      );
    case "correct":
      return (
        <CorrectEntry
          goal={goal}
          entry={goal.entries.find((e) => e.id === dialog.entryId)}
          onClose={close}
          onSave={actions.saveCorrection}
          onRemove={actions.removeCorrected}
        />
      );
    case "edit":
      return (
        <GoalForm
          weekday={weekday}
          goal={goal}
          onClose={close}
          onSave={actions.saveEdit}
          onArchive={actions.toggleArchive}
        />
      );
    case "deposit":
      return (
        actions.deposit && (
          <DepositDialog
            goal={goal}
            withdraw={dialog.withdraw}
            guardian={actions.deposit.guardian}
            name={actions.deposit.name}
            pendingOut={actions.deposit.pendingOut(goal.id)}
            onSend={(cents, method) =>
              actions.deposit.send(goal, cents, method)
            }
            onClose={close}
            notify={notify}
          />
        )
      );
    default:
      return null;
  }
}
