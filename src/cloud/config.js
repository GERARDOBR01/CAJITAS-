// Public web config of the Firebase project. These values identify the
// project; they are not secrets (access is controlled by firestore.rules).
export const firebaseConfig = {
  apiKey: "AIzaSyDqGep6Foz9O01zMQk-R4BhlVqELcGURL0",
  authDomain: "guardadito-94c49.firebaseapp.com",
  projectId: "guardadito-94c49",
  storageBucket: "guardadito-94c49.firebasestorage.app",
  messagingSenderId: "217291829713",
  appId: "1:217291829713:web:06553e151654e6b601f0f0",
};

// Local emulators for tests: `VITE_FIREBASE_EMULATOR=1 npm run dev`.
export const useEmulator = import.meta.env.VITE_FIREBASE_EMULATOR === "1";
export const emulatorConfig = {
  apiKey: "demo-key",
  authDomain: "demo-guardadito.firebaseapp.com",
  projectId: "demo-guardadito",
  appId: "demo-app",
};

export const cloudConfigured = useEmulator || Boolean(firebaseConfig.apiKey);

// Notices to the partner's phone (Web Push). The public half of the VAPID
// key; the private half lives only on the server.
export const vapidPublicKey =
  "BPkPKnEY6C0Im8LU5jgvgNC7bnCyMAWvXraGQD3g8RsdCtwDafeFQBlB2ukO_9iLUm1Dy3rwTFworwtMUcV-9qo";
// Where /api/push lives. Same origin in development; the Vercel backend for
// the published web and the app.
export const pushOrigin = import.meta.env.VITE_PUSH_ORIGIN ?? "";
export const pushConfigured = Boolean(pushOrigin) || import.meta.env.DEV;
