import { moneyShort as money } from "../domain.js";

/** An amount with a small raised "$", as in the redesign: $6,200.00 */
export default function Money({ cents, className = "" }) {
  const text = money(cents),
    match = /^(-?)\$(.*)$/.exec(text);
  if (!match) return <span className={`money ${className}`}>{text}</span>;
  const [, sign, rest] = match;
  return (
    <span className={`money ${className}`}>
      {sign}
      <span className="cur">$</span>
      {rest}
    </span>
  );
}
