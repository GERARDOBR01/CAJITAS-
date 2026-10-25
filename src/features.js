// Tools only the owner has set up on the server: Gmail, Bitso, the Banxico
// rates and the test APK. They stay on while developing and are off in the
// published web (mode "pages") and in the store app (mode "native").
// VITE_OWNER_TOOLS=1 or =0 decides it for any build.
export function ownerToolsFor(env) {
  if (env.VITE_OWNER_TOOLS) return env.VITE_OWNER_TOOLS === "1";
  return !["pages", "native"].includes(env.MODE);
}

export const ownerTools = ownerToolsFor(import.meta.env);
