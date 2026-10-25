// Pairing two accounts and the surprises they send each other.
import { cloud } from "./firebase.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
// Rules allow 48 h; a little less leaves room for a phone's clock.
const INVITE_MS = 47 * 3600 * 1000;

export function makeCode(random = crypto.getRandomValues.bind(crypto)) {
  return Array.from(random(new Uint32Array(6)), (n) => ALPHABET[n % 32]).join(
    "",
  );
}
export function normalizeCode(text) {
  return String(text ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}
export const pairIdOf = (a, b) => [a, b].sort().join("_");
export const displayName = (user) =>
  (user.displayName || user.email?.split("@")[0] || "Tu pareja").slice(0, 40);

export async function createInvite(user) {
  const { db, storeLib: s } = await cloud();
  const code = makeCode();
  await s.setDoc(s.doc(db, "invites", code), {
    from: user.uid,
    fromName: displayName(user),
    expiresAt: Date.now() + INVITE_MS,
  });
  return code;
}

export async function cancelInvite(code) {
  const { db, storeLib: s } = await cloud();
  await s.deleteDoc(s.doc(db, "invites", code)).catch(() => {});
}

export async function acceptInvite(user, text) {
  const { db, storeLib: s } = await cloud();
  const code = normalizeCode(text);
  if (code.length !== 6) throw new Error("El código tiene 6 letras y números.");
  const invite = await s.getDoc(s.doc(db, "invites", code));
  if (!invite.exists() || invite.data().expiresAt < Date.now())
    throw new Error("Ese código no existe o ya venció. Pide uno nuevo.");
  const { from, fromName } = invite.data();
  if (from === user.uid)
    throw new Error("Ese código es tuyo: compártelo con tu pareja.");
  const members = [from, user.uid].sort(),
    pairId = members.join("_");
  // All at once: the couple, who belongs to it, and the code used up, so
  // nobody else can join with the same code.
  const batch = s.writeBatch(db);
  batch.set(s.doc(db, "pairs", pairId), {
    members,
    names: { [from]: fromName, [user.uid]: displayName(user) },
    invite: code,
  });
  for (const uid of members)
    batch.set(s.doc(db, "pairOf", uid), { pair: pairId });
  batch.delete(s.doc(db, "invites", code));
  try {
    await batch.commit();
  } catch (error) {
    if (error?.code === "permission-denied")
      throw new Error(
        "No se pudo usar ese código: ya se usó, o alguno de los dos ya tiene pareja en Guardadito.",
      );
    throw error;
  }
  return fromName;
}

/**
 * Keeps the «one couple per person» mark in step with reality: couples made
 * before it existed get it, and a mark left by a couple that is gone is
 * removed so the person can pair again.
 */
export async function syncPairMark(uid, pair) {
  const { db, storeLib: s } = await cloud();
  const ref = s.doc(db, "pairOf", uid);
  if (!pair) {
    await s.deleteDoc(ref).catch(() => {});
    return;
  }
  const mark = await s.getDoc(ref).catch(() => null);
  if (mark && !mark.exists()) await s.setDoc(ref, { pair: pair.id });
}

let markSynced = null;
/** The couple this account belongs to (one at most), or null. */
export async function watchPair(uid, callback) {
  const { db, storeLib: s } = await cloud();
  return s.onSnapshot(
    s.query(
      s.collection(db, "pairs"),
      s.where("members", "array-contains", uid),
    ),
    // Also told when a pending write reaches the server.
    { includeMetadataChanges: true },
    (snap) => {
      // Wait until the server has the couple: its rules depend on it.
      if (snap.metadata.hasPendingWrites) return;
      const first = snap.docs[0];
      const pair = first ? { id: first.id, ...first.data() } : null;
      callback(pair);
      // What the server says, not the offline copy, decides the mark.
      const state = `${uid}:${pair?.id ?? ""}`;
      if (!snap.metadata.fromCache && markSynced !== state) {
        markSynced = state;
        syncPairMark(uid, pair).catch(() => (markSynced = null));
      }
    },
    () => callback(null),
  );
}

/** Leaves the couple: my surprises, summary and CLABE go away with it. */
export async function unpair(pairId, uid) {
  const { db, storeLib: s } = await cloud();
  for (const name of ["gifts", "deposits"]) {
    const mine = await s.getDocs(
      s.query(
        s.collection(db, "pairs", pairId, name),
        s.where("from", "==", uid),
      ),
    );
    // A deposit confirmed but not yet recorded stays; the rest goes.
    await Promise.all(mine.docs.map((d) => s.deleteDoc(d.ref).catch(() => {})));
  }
  await s
    .deleteDoc(s.doc(db, "pairs", pairId, "summaries", uid))
    .catch(() => {});
  await s.deleteDoc(s.doc(db, "pairs", pairId, "payout", uid)).catch(() => {});
  // This person's phones stop getting notices from the couple.
  const phones = await s
    .getDocs(
      s.query(
        s.collection(db, "pairs", pairId, "devices"),
        s.where("uid", "==", uid),
      ),
    )
    .catch(() => ({ docs: [] }));
  await Promise.all(phones.docs.map((d) => s.deleteDoc(d.ref).catch(() => {})));
  // Both are free to pair again; this has to go before the couple does.
  await Promise.all(
    pairId
      .split("_")
      .map((member) =>
        s.deleteDoc(s.doc(db, "pairOf", member)).catch(() => {}),
      ),
  );
  await s.deleteDoc(s.doc(db, "pairs", pairId));
}

/** Before deleting an account: my entries go, then I leave every couple. */
export async function leaveAllPairs(uid) {
  const { db, storeLib: s } = await cloud();
  const pairs = await s.getDocs(
    s.query(
      s.collection(db, "pairs"),
      s.where("members", "array-contains", uid),
    ),
  );
  for (const pair of pairs.docs) {
    const mine = await s.getDocs(
      s.query(
        s.collection(db, "pairs", pair.id, "entries"),
        s.where("by", "==", uid),
      ),
    );
    await Promise.all(mine.docs.map((d) => s.deleteDoc(d.ref)));
    await unpair(pair.id, uid);
  }
  // Codes I shared and nobody used, and my mark if it outlived its couple.
  const invites = await s
    .getDocs(s.query(s.collection(db, "invites"), s.where("from", "==", uid)))
    .catch(() => ({ docs: [] }));
  await Promise.all(
    invites.docs.map((d) => s.deleteDoc(d.ref).catch(() => {})),
  );
  await s.deleteDoc(s.doc(db, "pairOf", uid)).catch(() => {});
}

export async function watchGifts(pairId, callback, onError) {
  const { db, storeLib: s } = await cloud();
  return s.onSnapshot(
    s.collection(db, "pairs", pairId, "gifts"),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  );
}

export async function sendGift(pairId, gift, id) {
  const { db, storeLib: s } = await cloud();
  const data = { ...gift, createdAt: Date.now() };
  const col = s.collection(db, "pairs", pairId, "gifts");
  if (id) await s.setDoc(s.doc(col, id), data);
  else id = (await s.addDoc(col, data)).id;
  return id;
}

export async function deleteGift(pairId, id) {
  const { db, storeLib: s } = await cloud();
  await s.deleteDoc(s.doc(db, "pairs", pairId, "gifts", id));
}

export async function markOpened(pairId, id) {
  const { db, storeLib: s } = await cloud();
  await s.updateDoc(s.doc(db, "pairs", pairId, "gifts", id), {
    openedAt: Date.now(),
  });
}

export async function publishSummary(pairId, uid, goals) {
  const { db, storeLib: s } = await cloud();
  await s.setDoc(s.doc(db, "pairs", pairId, "summaries", uid), {
    goals,
    updatedAt: Date.now(),
  });
}

export async function watchSummary(pairId, uid, callback, onError) {
  const { db, storeLib: s } = await cloud();
  return s.onSnapshot(
    s.doc(db, "pairs", pairId, "summaries", uid),
    (snap) => callback(snap.exists() ? snap.data().goals : []),
    onError,
  );
}

/** Cajitas en pareja and their entries, live. */
export async function watchShared(pairId, onGoals, onEntries, onError) {
  const { db, storeLib: s } = await cloud();
  const list = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const a = s.onSnapshot(
    s.collection(db, "pairs", pairId, "goals"),
    (snap) => onGoals(list(snap)),
    onError,
  );
  const b = s.onSnapshot(
    s.collection(db, "pairs", pairId, "entries"),
    (snap) => onEntries(list(snap)),
    onError,
  );
  return () => {
    a();
    b();
  };
}

export async function saveSharedGoal(pairId, goal, id) {
  const { db, storeLib: s } = await cloud();
  const col = s.collection(db, "pairs", pairId, "goals");
  if (id) await s.setDoc(s.doc(col, id), goal);
  else await s.addDoc(col, goal);
}

export async function addSharedEntry(pairId, entry) {
  const { db, storeLib: s } = await cloud();
  const ref = await s.addDoc(s.collection(db, "pairs", pairId, "entries"), {
    ...entry,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function deleteSharedEntry(pairId, id) {
  const { db, storeLib: s } = await cloud();
  await s.deleteDoc(s.doc(db, "pairs", pairId, "entries", id));
}

/** The guardian's CLABE and the money on its way to (or back from) them. */
export async function watchMoney(pairId, onPayouts, onDeposits, onError) {
  const { db, storeLib: s } = await cloud();
  const a = s.onSnapshot(
    s.collection(db, "pairs", pairId, "payout"),
    (snap) =>
      onPayouts(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))),
    onError,
  );
  const b = s.onSnapshot(
    s.collection(db, "pairs", pairId, "deposits"),
    (snap) => onDeposits(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  );
  return () => {
    a();
    b();
  };
}

export async function savePayout(pairId, uid, { clabe, holder, bank }) {
  const { db, storeLib: s } = await cloud();
  await s.setDoc(s.doc(db, "pairs", pairId, "payout", uid), {
    clabe,
    holder,
    bank,
    updatedAt: Date.now(),
  });
}

export async function deletePayout(pairId, uid) {
  const { db, storeLib: s } = await cloud();
  await s.deleteDoc(s.doc(db, "pairs", pairId, "payout", uid));
}

export async function requestDeposit(pairId, deposit) {
  const { db, storeLib: s } = await cloud();
  const ref = await s.addDoc(s.collection(db, "pairs", pairId, "deposits"), {
    ...deposit,
    status: "pending",
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function decideDeposit(pairId, id, confirmed) {
  const { db, storeLib: s } = await cloud();
  await s.updateDoc(s.doc(db, "pairs", pairId, "deposits", id), {
    status: confirmed ? "confirmed" : "rejected",
    decidedAt: Date.now(),
  });
}

export async function markApplied(pairId, id) {
  const { db, storeLib: s } = await cloud();
  await s.updateDoc(s.doc(db, "pairs", pairId, "deposits", id), {
    appliedAt: Date.now(),
  });
}

export async function deleteDeposit(pairId, id) {
  const { db, storeLib: s } = await cloud();
  await s.deleteDoc(s.doc(db, "pairs", pairId, "deposits", id));
}
