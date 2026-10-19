import { Preferences } from "@capacitor/preferences";
import { STORAGE_KEY, validateBackup } from "../domain.js";
import { isNative } from "../platform.js";

// The native app keeps a second copy of the journal in the phone's own
// preferences; the browser's storage alone can be cleared by the system.
export async function hydrateSavings() {
  if (!isNative) return;
  const native = (await Preferences.get({ key: STORAGE_KEY })).value,
    local = localStorage.getItem(STORAGE_KEY);
  function parsed(raw) {
    try {
      return raw ? validateBackup(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }
  const n = parsed(native),
    l = parsed(local);
  const selected = n && (!l || n.savedAt > l.savedAt) ? native : local;
  if (selected) {
    localStorage.setItem(STORAGE_KEY, selected);
    await Preferences.set({ key: STORAGE_KEY, value: selected });
  }
}
export async function persistSavings(raw) {
  if (isNative) await Preferences.set({ key: STORAGE_KEY, value: raw });
}
