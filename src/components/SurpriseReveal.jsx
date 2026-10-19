import Illustration from "./Illustration.jsx";
import Mascot from "./Mascot.jsx";
import Modal from "./Modal.jsx";

/** A surprise from the partner, opened once: Cookie, a note or a reward. */
export default function SurpriseReveal({ gift, onClose, onMeetPet }) {
  const from = gift.fromName || "Tu pareja";
  if (gift.kind === "pet")
    return (
      <Modal title={`¡${from} te mandó a Cookie!`} onClose={onClose}>
        <div className="surprise surprise-pet">
          <Mascot pet="cat" name="Cookie" interactive={false} small />
          <p>
            Un gatito café que te acompaña y te dice cosas que {from} escribió
            para ti.
          </p>
        </div>
        <button
          className="primary full"
          onClick={() => {
            onMeetPet();
            onClose();
          }}
        >
          Conocer a Cookie 🐱
        </button>
        <button className="secondary full" onClick={onClose}>
          Después
        </button>
      </Modal>
    );
  if (gift.kind === "reward")
    return (
      <Modal title={`🎁 ${gift.title}`} onClose={onClose}>
        <div className="surprise">
          <p className="eyebrow">
            Llegaste al {gift.threshold} % de «{gift.goalName}»
          </p>
          {gift.image && (
            <img className="reward-image" src={gift.image} alt="" />
          )}
          <p className="surprise-text">{gift.text}</p>
          <p className="muted">— {from}</p>
        </div>
        <button className="primary full" onClick={onClose}>
          Guardar en mi corazón ♡
        </button>
      </Modal>
    );
  return (
    <Modal title={`${from} te dejó una notita 💌`} onClose={onClose}>
      <div className="surprise">
        <Illustration kind="mail" className="surprise-illustration" />
        <p className="surprise-text">{gift.text}</p>
        <p className="muted">— {from}</p>
      </div>
      <button className="primary full" onClick={onClose}>
        ♡ Gracias
      </button>
    </Modal>
  );
}
