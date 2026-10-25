import { LEGACY_STORAGE_KEY, STORAGE_KEY } from "../domain.js";
import { isNative } from "../platform.js";

// Everything Guardadito keeps on this phone about the person: their cajitas,
// which account they belong to, the code they shared and the error log.
const PERSONAL_KEYS = [
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  "guardadito:cloud-uid",
  "guardadito:invite",
  "guardadito:errors",
  "guardadito:account-nudge",
  "guardadito:previous",
];

/** Leaves this phone as if Guardadito had just been installed. */
export async function forgetThisPhone(area = globalThis.localStorage) {
  for (const key of PERSONAL_KEYS) {
    try {
      area.removeItem(key);
    } catch {
      /* Nothing stored, or no access: nothing to forget. */
    }
  }
  if (isNative) {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.remove({ key: STORAGE_KEY }).catch(() => {});
  }
}
