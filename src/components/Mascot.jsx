import { useId, useState } from "react";
import { PETS } from "../domain.js";

export default function Mascot({
  pet = "box",
  name,
  accessory = "leaf",
  progress = 0,
  sad = false,
  small = false,
  interactive = false,
  celebrating = false,
  onPet,
}) {
  const id = useId().replaceAll(":", "");
  const [touched, setTouched] = useState(false);
  const spec = PETS[pet] ?? PETS.box,
    growth = 0.85 + Math.min(1, Math.max(0, progress)) * 0.15;
  const animal = pet !== "box",
    outline = "#574d55";
  const label = sad
    ? "La mascota está triste y te acompaña"
    : celebrating
      ? `${name ?? spec.name} celebra tu ahorro`
      : `${name ?? spec.name}, tu ${spec.label.toLowerCase()} de ahorro`;
  function cuddle() {
    setTouched(true);
    setTimeout(() => setTouched(false), 1800);
    onPet?.();
  }
  const picture = (
    <svg
      className={`mascot ${small ? "small" : ""} pet-${pet} ${touched ? "cuddled" : ""} ${celebrating ? "celebrating" : ""}`}
      viewBox="0 0 240 220"
      role="img"
      aria-label={label}
    >
      <defs>
        <radialGradient id={`glow-${id}`}>
          <stop stopColor="#fff5d6" />
          <stop offset="1" stopColor={spec.color} stopOpacity=".3" />
        </radialGradient>
      </defs>
      <circle
        className="pet-aura"
        cx="120"
        cy="116"
        r="92"
        fill={`url(#glow-${id})`}
      />
      <ellipse cx="120" cy="198" rx="65" ry="9" fill="#76695d" opacity=".09" />
      <g
        className="pet-body"
        transform={`translate(120 196) scale(${growth}) translate(-120 -196)`}
      >
        {animal ? (
          <>
            <path
              className="pet-arm left"
              d="M69 135Q37 122 37 143q7 16 27 9"
              fill={spec.color}
              stroke={outline}
              strokeWidth="3"
            />
            <path
              className="pet-arm right"
              d="M173 135q32-13 31 8-7 16-26 9"
              fill={spec.color}
              stroke={outline}
              strokeWidth="3"
            />
            <ellipse
              cx="91"
              cy="189"
              rx="16"
              ry="10"
              fill={pet === "cow" ? "#bfb6d8" : spec.color}
              stroke={outline}
              strokeWidth="3"
            />
            <ellipse
              cx="151"
              cy="189"
              rx="16"
              ry="10"
              fill={pet === "cow" ? "#bfb6d8" : spec.color}
              stroke={outline}
              strokeWidth="3"
            />
            <ellipse
              cx="120"
              cy="142"
              rx="63"
              ry="53"
              fill={spec.color}
              stroke={outline}
              strokeWidth="3"
            />
            <ellipse
              cx="120"
              cy="162"
              rx="33"
              ry="25"
              fill="#fff9ee"
              opacity=".7"
            />
            {pet === "pig" && (
              <>
                <path
                  className="pet-ear"
                  d="M73 76Q39 29 54 30q36-2 47 34"
                  fill="#f3b4c2"
                  stroke={outline}
                  strokeWidth="3"
                />
                <path
                  className="pet-ear"
                  d="M153 65q13-35 46-35 15 0-22 47"
                  fill="#f3b4c2"
                  stroke={outline}
                  strokeWidth="3"
                />
              </>
            )}
            {pet === "cow" && (
              <>
                <path
                  d="M92 62q-20-18-7-37l15 28M143 55l13-30q15 20-5 38"
                  fill="#eadcb9"
                  stroke={outline}
                  strokeWidth="3"
                />
                <path
                  className="pet-ear"
                  d="M73 76Q26 40 36 70q10 24 40 20M165 73q51-30 39 0-9 23-40 17"
                  fill="#d1c8e6"
                  stroke={outline}
                  strokeWidth="3"
                />
              </>
            )}
            {pet === "bunny" && (
              <>
                <ellipse
                  className="pet-ear"
                  cx="88"
                  cy="43"
                  rx="17"
                  ry="38"
                  fill="#f7e9d8"
                  stroke={outline}
                  strokeWidth="3"
                  transform="rotate(-12 88 43)"
                />
                <ellipse
                  className="pet-ear"
                  cx="152"
                  cy="43"
                  rx="17"
                  ry="38"
                  fill="#f7e9d8"
                  stroke={outline}
                  strokeWidth="3"
                  transform="rotate(12 152 43)"
                />
                <ellipse
                  cx="88"
                  cy="41"
                  rx="7"
                  ry="25"
                  fill="#edbdc1"
                  transform="rotate(-12 88 43)"
                />
                <ellipse
                  cx="152"
                  cy="41"
                  rx="7"
                  ry="25"
                  fill="#edbdc1"
                  transform="rotate(12 152 43)"
                />
              </>
            )}
            <ellipse
              cx="120"
              cy="99"
              rx="65"
              ry="53"
              fill={
                pet === "cow"
                  ? "#fffaf1"
                  : pet === "bunny"
                    ? "#f9eedf"
                    : spec.color
              }
              stroke={outline}
              strokeWidth="3"
            />
            {pet === "cow" && (
              <>
                <path
                  d="M74 58q24-16 31 6t-6 29q-18 7-29-6-9-17 4-29"
                  fill="#8c83ac"
                />
                <path
                  d="M153 64q22-11 29 10l-7 13q-24 5-22-23"
                  fill="#8c83ac"
                />
              </>
            )}
            <ellipse
              cx="77"
              cy="113"
              rx="12"
              ry="7"
              fill="#efaeb9"
              opacity=".8"
            />
            <ellipse
              cx="163"
              cy="113"
              rx="12"
              ry="7"
              fill="#efaeb9"
              opacity=".8"
            />
            <g className="pet-eyes">
              <ellipse cx="95" cy="98" rx="5" ry="7" fill={outline} />
              <ellipse cx="145" cy="98" rx="5" ry="7" fill={outline} />
              <circle cx="97" cy="96" r="1.6" fill="white" />
              <circle cx="147" cy="96" r="1.6" fill="white" />
            </g>
            {pet === "pig" || pet === "cow" ? (
              <>
                <ellipse
                  cx="120"
                  cy="120"
                  rx={pet === "pig" ? 23 : 29}
                  ry="16"
                  fill={pet === "pig" ? "#efa3b8" : "#efcfce"}
                  stroke={outline}
                  strokeWidth="2.5"
                />
                <ellipse cx="111" cy="120" rx="2.5" ry="4" fill={outline} />
                <ellipse cx="130" cy="120" rx="2.5" ry="4" fill={outline} />
              </>
            ) : (
              <path d="m115 113 5 6 5-6q-5-5-10 0" fill="#d098a0" />
            )}
            <path
              d={
                sad
                  ? "M108 143q12-12 24 0"
                  : pet === "bunny"
                    ? "M108 124q6 9 12 0 6 9 12 0"
                    : "M110 139q10 9 20 0"
              }
              fill="none"
              stroke={outline}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <path
              d="M77 159 65 188q10 10 23 0l10-22M143 164l9 24q13 8 24-2l-13-32"
              fill="#8cb398"
              stroke="#476955"
              strokeWidth="3"
            />
            <path
              className="pet-arm left"
              d="M60 121Q31 126 33 144q7 12 18-2l18-7M177 121q32-6 30 19-9 13-17-2l-20-4"
              fill="#c8e8bd"
              stroke="#476955"
              strokeWidth="3"
            />
            <rect
              x="56"
              y="68"
              width="126"
              height="108"
              rx="32"
              fill="#c8e8bd"
              stroke="#476955"
              strokeWidth="3"
            />
            <rect
              x="48"
              y="62"
              width="141"
              height="38"
              rx="13"
              fill="#e3f0cf"
              stroke="#476955"
              strokeWidth="3"
            />
            <path
              d="M101 78h39"
              stroke="#476955"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <ellipse cx="85" cy="135" rx="11" ry="6" fill="#efb9b4" />
            <ellipse cx="154" cy="135" rx="11" ry="6" fill="#efb9b4" />
            <g className="pet-eyes">
              <circle cx="97" cy="122" r="4.5" fill="#476955" />
              <circle cx="142" cy="122" r="4.5" fill="#476955" />
            </g>
            <path
              d={sad ? "M109 149q10-10 21 0" : "M109 138q10 12 21 0"}
              fill="none"
              stroke="#476955"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </>
        )}
        {accessory === "leaf" && (
          <g transform={animal ? "translate(0 -8)" : "translate(0 6)"}>
            <path
              d="M120 60V41q-24 1-26-17 24-2 26 17 5-22 26-25 2 23-26 25"
              fill="#90b68f"
              stroke="#557858"
              strokeWidth="2.5"
            />
          </g>
        )}
        {accessory === "bow" && (
          <g transform="translate(139 54)">
            <path
              d="M0 0q-25-20-22 2 2 18 22 1 23 18 23-1 0-22-23-2"
              fill="#e9a5b9"
              stroke={outline}
              strokeWidth="2"
            />
            <circle
              cx="0"
              cy="2"
              r="5"
              fill="#f7c6d3"
              stroke={outline}
              strokeWidth="2"
            />
          </g>
        )}
        {accessory === "scarf" && (
          <>
            <path
              d="M82 149q39 14 77 0l-2 13q-40 12-73 0Z"
              fill="#d4b7e9"
              stroke={outline}
              strokeWidth="2"
            />
            <path
              d="M141 156v30l-16-5 6-24"
              fill="#d4b7e9"
              stroke={outline}
              strokeWidth="2"
            />
          </>
        )}
        {accessory === "star" && (
          <path
            d="m120 150 5 9 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2Z"
            fill="#f9dc8c"
            stroke="#bba168"
            strokeWidth="2"
          />
        )}
        {sad && <path d="M151 107q-7 11 0 14 7-3 0-14" fill="#9dc8e5" />}
      </g>
      <g className="pet-sparkles" fill="#dcb76c">
        <path d="m203 43 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" />
        <path d="m30 85 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" />
      </g>
      {(touched || celebrating) && (
        <g className="pet-hearts" fill="#d796aa">
          <path d="M82 46q-12-14-17-3-4 11 17 20 20-13 16-21-5-11-16 4" />
          <path d="M177 29q-8-9-11-2-2 7 11 13 14-8 10-14-3-6-10 3" />
        </g>
      )}
    </svg>
  );
  return interactive ? (
    <button
      className="pet-cuddle"
      onClick={cuddle}
      aria-label={`Acariciar a ${name ?? spec.name}`}
    >
      {picture}
    </button>
  ) : (
    picture
  );
}
