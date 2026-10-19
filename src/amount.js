// The amount typed with the on-screen keypad. Pure, so it can be tested
// without a DOM. The value is a plain string ("12.5") that `cents()` reads.
const MAX_INTEGER_DIGITS = 8;

/** The amount after pressing a key: "0".."9", "." or "back". */
export function nextAmount(value, key) {
  if (key === "back") return value.slice(0, -1);
  if (key === ".") {
    if (value.includes(".")) return value;
    return value === "" ? "0." : `${value}.`;
  }
  if (!/^\d$/.test(key)) return value;
  const [whole, decimals] = value.split(".");
  if (decimals !== undefined) return decimals.length >= 2 ? value : value + key;
  if (whole === "0") return key;
  return whole.length >= MAX_INTEGER_DIGITS ? value : value + key;
}

/** What may be typed in the amount field: digits and one dot, two decimals. */
export function cleanAmount(text) {
  const cleaned = text.replace(/[^\d.]/g, ""),
    [whole, ...rest] = cleaned.split("."),
    decimals = rest.join("").slice(0, 2);
  const head = whole.replace(/^0+(?=\d)/, "").slice(0, MAX_INTEGER_DIGITS);
  return rest.length ? `${head}.${decimals}` : head;
}
