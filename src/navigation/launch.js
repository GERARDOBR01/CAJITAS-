// What the address the app was opened with asks for, and how the address
// follows the screen afterwards. Pure, so it can be tested without a browser.

// Asked once by a link; removed from the address after the app reads them.
// `tutorial` is from versions that had a practice tour.
const ONE_SHOT = ["pareja", "gmail", "tab", "tutorial"];

/** Where "back" leads from each screen. Home is the only top level. */
export const PARENT = {
  goal: "goals",
  settings: "goals",
  pet: "settings",
  reminder: "settings",
  history: "settings",
  partner: "settings",
  account: "settings",
  backup: "settings",
  install: "settings",
  help: "settings",
  simulator: "settings",
  connections: "settings",
};

/**
 * `tab` is the screen to open first. `inviteCode` is a partner's code from
 * `?pareja=`; `gmail` is how the Gmail connection ended (`connected` or
 * `cancelled`), from `?gmail=`, and only matters with the owner's tools.
 */
export function readLaunch(search, { cloudConfigured, ownerTools = false }) {
  const params = new URLSearchParams(search);
  const inviteCode = params.get("pareja") ?? "",
    gmail = ownerTools ? (params.get("gmail") ?? "") : "";
  let tab = "goals";
  if (params.get("tab") === "account" && cloudConfigured) tab = "account";
  if (inviteCode) tab = "partner";
  if (gmail) tab = "connections";
  return { tab, inviteCode, gmail };
}

/** The address for a screen: what a link asked for once is dropped. */
export function addressFor(href) {
  const url = new URL(href);
  for (const key of ONE_SHOT) url.searchParams.delete(key);
  return `${url.pathname}${url.search}${url.hash}`;
}
