export default function CommitmentNotice({ provider, keeper }) {
  const app = provider || "tu app externa";
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
