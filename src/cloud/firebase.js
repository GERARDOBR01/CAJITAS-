// Firebase is loaded only when someone uses an account, so the local app
// keeps its size and works the same without it.
import {
  cloudConfigured,
  emulatorConfig,
  firebaseConfig,
  useEmulator,
} from "./config.js";
import { toCloud } from "./sync.js";

let ready;

export function cloud() {
  if (!cloudConfigured)
    return Promise.reject(new Error("Las cuentas no están activadas."));
  ready ??= (async () => {
    const [{ initializeApp }, authLib, storeLib] = await Promise.all([
      import("firebase/app"),
      import("firebase/auth"),
      import("firebase/firestore"),
    ]);
    const app = initializeApp(useEmulator ? emulatorConfig : firebaseConfig);
    // Explicit persistence: the default resolver needs popups, which an
    // installed iPhone web app and the Android WebView do not handle well.
    const auth = authLib.initializeAuth(app, {
      persistence: [
        authLib.indexedDBLocalPersistence,
        authLib.browserLocalPersistence,
      ],
    });
    auth.languageCode = "es";
    const db = storeLib.initializeFirestore(app, {
      localCache: storeLib.persistentLocalCache({
        tabManager: storeLib.persistentMultipleTabManager(),
      }),
    });
    if (useEmulator) {
      authLib.connectAuthEmulator(auth, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
      storeLib.connectFirestoreEmulator(db, "127.0.0.1", 8080);
    }
    return { auth, db, authLib, storeLib };
  })();
  return ready;
}

const stateRef = ({ db, storeLib }, uid) =>
  storeLib.doc(db, "users", uid, "state", "main");

export async function watchUser(callback) {
  const { auth, authLib } = await cloud();
  return authLib.onAuthStateChanged(auth, callback);
}

export async function signUp({ name, email, password }) {
  const { auth, authLib } = await cloud();
  const { user } = await authLib.createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );
  if (name) await authLib.updateProfile(user, { displayName: name });
  // Without a confirmed address a typo would make the password unrecoverable.
  // The account works anyway; the link only proves the address is theirs.
  await authLib.sendEmailVerification(user).catch(() => {});
  return user;
}

export async function resendVerification() {
  const { auth, authLib } = await cloud();
  if (auth.currentUser) await authLib.sendEmailVerification(auth.currentUser);
}

/** Whether the address was confirmed since the app last asked. */
export async function refreshVerified() {
  const { auth } = await cloud();
  await auth.currentUser?.reload();
  return Boolean(auth.currentUser?.emailVerified);
}

export async function signIn({ email, password }) {
  const { auth, authLib } = await cloud();
  return (await authLib.signInWithEmailAndPassword(auth, email, password)).user;
}

/**
 * With `clearCache`, the offline copy Firestore keeps (the partner's notes,
 * photos and CLABE) is erased too, so the next person on this phone finds
 * nothing. Firebase has to start again afterwards: reload the app.
 */
export async function signOutUser({ clearCache = false } = {}) {
  const { auth, authLib, db, storeLib } = await cloud();
  await authLib.signOut(auth);
  if (!clearCache) return;
  ready = null;
  await storeLib.terminate(db);
  // Fails if Guardadito is open in another tab; that copy stays until then.
  await storeLib.clearIndexedDbPersistence(db).catch(() => {});
}

export async function resetPassword(email) {
  const { auth, authLib } = await cloud();
  await authLib.sendPasswordResetEmail(auth, email);
}

/** Deletes the journal in the account and then the account itself. */
export async function deleteAccount(password) {
  const c = await cloud();
  const user = c.auth.currentUser;
  if (!user) throw new Error("No hay una sesión abierta.");
  await c.authLib.reauthenticateWithCredential(
    user,
    c.authLib.EmailAuthProvider.credential(user.email, password),
  );
  const { leaveAllPairs } = await import("./partner.js");
  await leaveAllPairs(user.uid);
  await c.storeLib.deleteDoc(stateRef(c, user.uid));
  await c.authLib.deleteUser(user);
}

/** The account's copy, or null if it has none yet. */
export async function loadState(uid) {
  const c = await cloud();
  const snap = await c.storeLib.getDoc(stateRef(c, uid));
  return snap.exists() ? snap.data() : null;
}

/** Writes are queued by Firestore while offline and sent when back. */
export async function saveState(uid, data) {
  const c = await cloud();
  await c.storeLib.setDoc(stateRef(c, uid), {
    ...toCloud(data),
    updatedAt: c.storeLib.serverTimestamp(),
  });
}

/** Changes made on another device. Our own pending writes are skipped. */
export async function watchState(uid, callback) {
  const c = await cloud();
  return c.storeLib.onSnapshot(stateRef(c, uid), (snap) => {
    if (snap.exists() && !snap.metadata.hasPendingWrites) callback(snap.data());
  });
}
