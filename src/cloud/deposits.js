// Money kept by a guardian: the CLABE to send it to and how a confirmed
// deposit becomes a movement in the sender's cajita.
import { balance, money, recordEntry } from "../domain.js";

const WEIGHTS = [3, 7, 1];
export const cleanClabe = (text) => String(text ?? "").replace(/\D/g, "");
/** 18 digits whose last one is the check digit banks compute. */
export function validClabe(text) {
  const clabe = cleanClabe(text);
  if (clabe.length !== 18) return false;
  const sum = [...clabe.slice(0, 17)].reduce(
    (total, digit, i) => total + ((Number(digit) * WEIGHTS[i % 3]) % 10),
    0,
  );
  return (10 - (sum % 10)) % 10 === Number(clabe[17]);
}
/** As banks print it: bank, branch, account, check digit. */
export const formatClabe = (clabe) =>
  clabe.replace(/^(\d{3})(\d{3})(\d{11})(\d)$/, "$1 $2 $3 $4");
export const concept = (goalName) =>
  `Guardadito ${goalName}`
    // Without accents or symbols: some banks reject them in the concept.
    .normalize("NFD")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);

export const guardianEntryId = (depositId) => `guardian-${depositId}`;

/** What is still on its way for each of my cajitas. */
export function pendingByGoal(deposits, uid) {
  const result = {};
  for (const d of deposits)
    if (d.from === uid && d.status === "pending") {
      const goal = (result[d.goalId] ??= { in: 0, out: 0, items: [] });
      if (d.cents > 0) goal.in += d.cents;
      else goal.out -= d.cents;
      goal.items.push(d);
    }
  return result;
}

/** Cents to send (positive) or ask back (negative), checked against the cajita. */
export function checkDeposit(goal, cents, pendingOut = 0) {
  if (!Number.isSafeInteger(cents) || cents === 0)
    throw new Error("Revisa el monto.");
  if (cents < 0 && -cents > balance(goal) - pendingOut)
    throw new Error("Pides más de lo que tienes en esta cajita.");
  return cents;
}

/**
 * Records my deposits the guardian confirmed and I have not recorded yet.
 * Returns the new journal and the deposits to mark as applied; `added` are
 * the ones that changed the journal (the rest were already there).
 */
export function applyConfirmed(data, deposits, uid, now = Date.now()) {
  let next = data;
  const marks = [],
    added = [];
  for (const d of deposits) {
    if (d.from !== uid || d.status !== "confirmed" || d.appliedAt) continue;
    const id = guardianEntryId(d.id);
    const goal = next.goals.find((g) => g.id === d.goalId);
    if (!goal) continue;
    if (goal.entries.some((e) => e.id === id)) {
      marks.push(d);
      continue;
    }
    let candidate;
    try {
      candidate = recordEntry(next, goal.id, {
        id,
        cents: d.cents,
        // The guardian's clock may run a little ahead of mine.
        at: new Date(Math.min(d.decidedAt ?? now, now)).toISOString(),
        source: "guardian",
      }).data;
    } catch {
      continue;
    }
    next = candidate;
    marks.push(d);
    added.push(d);
  }
  return { data: next, marks, added };
}

/** Everything the guardian screens show, from the couple's deposit list. */
export function guardianView(deposits, uid) {
  return {
    pending: pendingByGoal(deposits, uid),
    /** What I keep for my partner: everything I confirmed, in and out. */
    held: deposits
      .filter((d) => d.to === uid && d.status === "confirmed")
      .reduce((sum, d) => sum + d.cents, 0),
    toConfirm: deposits
      .filter((d) => d.to === uid && d.status === "pending")
      .sort((a, b) => a.createdAt - b.createdAt),
    myDeposits: deposits
      .filter((d) => d.from === uid && d.status !== "confirmed")
      .sort((a, b) => b.createdAt - a.createdAt),
  };
}

/** The status of each deposit, to tell later what changed. */
export const depositStatuses = (deposits) =>
  new Map(deposits.map((d) => [d.id, d.status]));

/**
 * Money news since `before` (the statuses already seen): my partner says
 * they sent me something or asks for some back, or my guardian has not seen
 * mine yet. `who` is how my partner is called.
 */
export function depositNews(before, deposits, uid, who) {
  const news = [];
  for (const d of deposits) {
    if (before.get(d.id) === d.status) continue;
    const amount = money(Math.abs(d.cents));
    if (d.to === uid && d.status === "pending")
      news.push(
        d.cents > 0
          ? `${who} dice que te mandó ${amount} para ${d.goalName}. ¿Te llegó?`
          : `${who} te pide ${amount} de ${d.goalName}.`,
      );
    else if (d.from === uid && d.status === "rejected")
      news.push(
        d.cents > 0
          ? `${who} todavía no ve tus ${amount}. Revisa la transferencia.`
          : `${who} no pudo darte ${amount} por ahora.`,
      );
  }
  return news;
}

/** What I hear when my guardian confirmed `added` (from `applyConfirmed`). */
export function confirmationNote(added, who) {
  const total = added.reduce((sum, d) => sum + d.cents, 0);
  return total > 0
    ? `${who} confirmó tu depósito: +${money(total)} 💞`
    : `${who} confirmó tu retiro de ${money(-total)}.`;
}
