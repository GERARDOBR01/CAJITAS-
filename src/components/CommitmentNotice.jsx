import { moneyPlace } from "../domain.js";

export default function CommitmentNotice({ provider, keeper }) {
  const app = moneyPlace(provider);
  return (
    <p className="commitment-note">
      <strong>El candado es de compromiso, no bancario.</strong>
      <span>
        {keeper
          ? `${keeper} guarda lo que le mandaste; lo que apartes tú sigue en ${app}.`
          : `Tu dinero sigue disponible en ${app}.`}
      </span>
    </p>
  );
}
