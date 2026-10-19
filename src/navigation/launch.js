// What the address the app was opened with asks for, and how the address
// follows the screen afterwards. Pure, so it can be tested without a browser.

// Asked once by a link; removed from the address after the app reads them.
const ONE_SHOT = ["pareja", "gmail", "tab"];

/**
 * `tab` is the screen to open first. `inviteCode` is a partner's code from
 * `?pareja=`; `gmail` is how the Gmail connection ended (`connected` or
 * `cancelled`), from `?gmail=`.
 */
export function readLaunch(search, { cloudConfigured }) {
  const params = new URLSearchParams(search);
  const inviteCode = params.get("pareja") ?? "",
    gmail = params.get("gmail") ?? "";
  let tab = "goals";
  if (params.get("tutorial") === "1") tab = "tutorial";
  else if (params.get("tab") === "account" && cloudConfigured) tab = "account";
  if (inviteCode) tab = "partner";
  if (gmail) tab = "connections";
  return { tab, inviteCode, gmail };
}

/** The address for a screen: the tutorial is the only one kept in it, and
 * what a link asked for once is dropped. */
export function addressFor(href, tab) {
  const url = new URL(href);
  if (tab === "tutorial") url.searchParams.set("tutorial", "1");
  else url.searchParams.delete("tutorial");
  for (const key of ONE_SHOT) url.searchParams.delete(key);
  return `${url.pathname}${url.search}${url.hash}`;
}
