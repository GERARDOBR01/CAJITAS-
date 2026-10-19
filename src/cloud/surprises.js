import { balance, localDate } from "../domain.js";

/** What a partner sees of my cajitas: names and progress, no movements. */
export function goalSummary(data) {
  return data.goals
    .filter((g) => !g.archived)
    .map((g) => ({
      id: g.id,
      name: g.name,
      targetCents: g.targetCents,
      savedCents: balance(g),
      unlockDate: g.unlockDate || "",
    }));
}

/** The words a partner sent with Cookie, as stored in my preferences. */
export function specialFromGift(gift, current) {
  const pets = new Set([...(current?.pets ?? []), "cat"]);
  return {
    from: gift.fromName || "",
    lines: (gift.lines ?? []).slice(0, 8),
    loveText: gift.loveText || "",
    motto: gift.motto || "",
    pets: [...pets],
  };
}
export function sameSpecial(a, b) {
  const pick = (s) =>
    JSON.stringify([s?.from, s?.lines, s?.loveText, s?.motto]);
  return pick(a) === pick(b);
}

const percent = (goal) =>
  goal && goal.targetCents ? (balance(goal) / goal.targetCents) * 100 : 0;

function received(gifts, uid) {
  return gifts.filter((g) => g.to === uid && !g.openedAt);
}

/**
 * Surprises to open right now, oldest first. A note waits for its moment
 * (opening the app, the next saving, or its date); a reward waits until its
 * cajita reaches the percentage.
 */
export function dueSurprises({ gifts, uid, data, now = new Date(), saved }) {
  const today = localDate(now);
  return received(gifts, uid)
    .filter((g) => {
      if (g.kind === "pet") return true;
      if (g.kind === "note")
        return g.showOn === "save"
          ? Boolean(saved)
          : g.showOn === "date"
            ? Boolean(g.date) && g.date <= today
            : true;
      if (g.kind === "reward")
        return (
          percent(data.goals.find((goal) => goal.id === g.goalId)) >=
          g.threshold
        );
      return false;
    })
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

/** Rewards still waiting: a hint without spoiling what they are. */
export function waitingRewards({ gifts, uid, data }) {
  return received(gifts, uid)
    .filter((g) => g.kind === "reward")
    .map((g) => ({
      ...g,
      goal: data.goals.find((goal) => goal.id === g.goalId),
    }))
    .filter((g) => g.goal && !g.goal.archived && percent(g.goal) < g.threshold);
}
