// The APK is served from GitHub Pages next to the web app (kept by
// scripts/deploy-pages.mjs between deploys).
export const ANDROID_VERSION = "0.7.0";
export const ANDROID_DOWNLOAD_URL =
  import.meta.env.VITE_ANDROID_DOWNLOAD_URL ||
  `https://gerardobr01.github.io/CAJITAS-/descargas/Cajitas-${ANDROID_VERSION}-android.apk`;
