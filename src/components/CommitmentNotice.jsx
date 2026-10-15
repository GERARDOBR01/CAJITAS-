export default function CommitmentNotice({ provider }) {
  return (
    <p className="commitment-note">
      <strong>El candado es de compromiso, no bancario.</strong>
      <span>Tu dinero sigue disponible en {provider || "tu app externa"}.</span>
    </p>
  );
}
