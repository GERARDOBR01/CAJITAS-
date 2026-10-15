import { useEffect, useId, useRef, useState } from "react";
import { PETS } from "../domain.js";
import Sprout from "./Sprout.jsx";
import CookieCat from "./CookieCat.jsx";
import {
  HAPPY_MS,
  MOOD_LABEL,
  STAGE_NAMES,
  eyeOffset,
  growthStage,
  petMood,
  registerTap,
} from "../pet/state.js";

const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

function Eyes({ left, right, y, color, mood, look }) {
  if (mood === "happy" || mood === "celebrate" || mood === "excited")
    return (
      <g
        className="pet-eyes happy-eyes"
        fill="none"
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
      >
        <path d={`M${left - 7} ${y + 2}q7-10 14 0`} />
        <path d={`M${right - 7} ${y + 2}q7-10 14 0`} />
      </g>
    );
  if (mood === "sleepy")
    return (
      <g
        className="pet-eyes sleepy-eyes"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path d={`M${left - 7} ${y}q7 6 14 0`} />
        <path d={`M${right - 7} ${y}q7 6 14 0`} />
      </g>
    );
  return (
    <g className="pet-eyes">
      {mood === "sad" && (
        <g fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
          <path d={`M${left - 9} ${y - 10}l12 -5`} />
          <path d={`M${right + 9} ${y - 10}l-12 -5`} />
        </g>
      )}
      <g transform={`translate(${look.x} ${mood === "sad" ? 2 : look.y})`}>
        <ellipse cx={left} cy={y} rx="5.5" ry="7.5" fill={color} />
        <ellipse cx={right} cy={y} rx="5.5" ry="7.5" fill={color} />
        <circle cx={left + 2} cy={y - 2.5} r="2" fill="white" />
        <circle cx={right + 2} cy={y - 2.5} r="2" fill="white" />
      </g>
    </g>
  );
}

function Mouth({ x, y, color, mood, bunny }) {
  if (mood === "sad")
    return (
      <path
        d={`M${x - 11} ${y + 5}q11-11 22 0`}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    );
  if (mood === "sleepy")
    return (
      <ellipse
        cx={x}
        cy={y + 2}
        rx="4"
        ry="3"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
      />
    );
  if (mood === "happy" || mood === "celebrate" || mood === "excited")
    return (
      <path
        d={`M${x - 12} ${y - 2}q12 18 24 0z`}
        fill="#c9667e"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    );
  if (bunny)
    return (
      <path
        d={`M${x - 12} ${y - 15}q6 9 12 0 6 9 12 0`}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    );
  return (
    <path
      d={`M${x - 10} ${y}q10 9 20 0`}
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  );
}

export default function Mascot(props) {
  return props.pet === "cat" ? (
    <CookieCat {...props} />
  ) : (
    <ClassicMascot {...props} />
  );
}

function ClassicMascot({
  pet = "box",
  name,
  accessory = "leaf",
  progress = 0,
  sad = false,
  small = false,
  interactive = false,
  celebrating = false,
  mood: moodProp,
  stage: stageProp,
  motion = true,
  onPet,
  onTrick,
}) {
  const id = useId().replaceAll(":", "");
  const [happy, setHappy] = useState(false),
    [bounce, setBounce] = useState(0),
    [trick, setTrick] = useState(false),
    [look, setLook] = useState({ x: 0, y: 0 });
  const taps = useRef([]),
    pressTimer = useRef(),
    longPress = useRef(false),
    happyTimer = useRef(),
    trickTimer = useRef(),
    svg = useRef();
  const spec = PETS[pet] ?? PETS.box,
    stage = stageProp ?? growthStage(progress),
    growth = 0.85 + Math.min(1, Math.max(0, progress)) * 0.15;
  const mood = petMood({
    celebrating: celebrating || moodProp === "celebrate",
    sad: sad || moodProp === "sad",
    excited: moodProp === "excited",
    happy: happy || moodProp === "happy",
    waiting: moodProp === "waiting",
    daysAway: moodProp === "sleepy" ? Infinity : 0,
  });
  const animal = pet !== "box",
    outline = "#574d55";
  const shown = name ?? spec.name;
  const label = `${shown} ${MOOD_LABEL[mood]}`;
  const canMove = motion && interactive;
  useEffect(() => {
    if (!canMove || reducedMotion()) return;
    let frame = 0;
    function follow(e) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = svg.current?.getBoundingClientRect();
        if (box) setLook(eyeOffset({ x: e.clientX, y: e.clientY }, box));
      });
    }
    window.addEventListener("pointermove", follow);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", follow);
    };
  }, [canMove]);
  useEffect(
    () => () => {
      clearTimeout(pressTimer.current);
      clearTimeout(happyTimer.current);
      clearTimeout(trickTimer.current);
    },
    [],
  );
  function cheer() {
    setHappy(true);
    clearTimeout(happyTimer.current);
    happyTimer.current = setTimeout(() => setHappy(false), HAPPY_MS);
  }
  function tap() {
    if (longPress.current) {
      longPress.current = false;
      return;
    }
    setBounce((n) => n + 1);
    cheer();
    onPet?.();
    const next = registerTap(taps.current, Date.now());
    taps.current = next.taps;
    if (next.trick) {
      setTrick(true);
      clearTimeout(trickTimer.current);
      trickTimer.current = setTimeout(() => setTrick(false), 1100);
      onTrick?.();
    }
  }
  function pressStart() {
    clearTimeout(pressTimer.current);
    longPress.current = false;
    pressTimer.current = setTimeout(() => {
      longPress.current = true;
      cheer();
      onPet?.("cuddle");
    }, 550);
  }
  function pressEnd() {
    clearTimeout(pressTimer.current);
  }
  const picture = (
    <svg
      ref={svg}
      className={`mascot ${small ? "small" : ""} pet-${pet} mood-${mood} ${mood === "celebrate" ? "celebrating" : ""}`}
      viewBox="0 0 240 220"
      role="img"
      aria-label={label}
      data-mood={mood}
      data-stage={stage}
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
        className={`pet-motion ${trick ? "trick" : ""} ${bounce ? `tap-${bounce % 2}` : ""}`}
      >
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
              <Eyes
                left={95}
                right={145}
                y={98}
                color={outline}
                mood={mood}
                look={look}
              />
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
              <Mouth
                x={120}
                y={139}
                color={outline}
                mood={mood}
                bunny={pet === "bunny"}
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
              <Eyes
                left={97}
                right={142}
                y={122}
                color="#476955"
                mood={mood}
                look={look}
              />
              <Mouth x={120} y={140} color="#476955" mood={mood} />
            </>
          )}
          <g transform={animal ? "translate(0 -8)" : "translate(0 6)"}>
            <Sprout stage={stage} />
          </g>
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
          {mood === "sad" && (
            <path
              className="pet-tear"
              d={
                animal
                  ? "M151 107q-7 11 0 14 7-3 0-14"
                  : "M150 130q-7 11 0 14 7-3 0-14"
              }
              fill="#9dc8e5"
            />
          )}
        </g>
      </g>
      <g className="pet-sparkles" fill="#dcb76c">
        <path d="m203 43 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" />
        <path d="m30 85 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" />
      </g>
      {(mood === "happy" || mood === "celebrate") && (
        <g className="pet-hearts" fill="#d796aa" key={bounce}>
          <path d="M82 46q-12-14-17-3-4 11 17 20 20-13 16-21-5-11-16 4" />
          <path d="M177 29q-8-9-11-2-2 7 11 13 14-8 10-14-3-6-10 3" />
        </g>
      )}
      {mood === "excited" && (
        <g className="pet-burst" fill="#f2c14e">
          <path d="m40 50 4 11 11 4-11 4-4 11-4-11-11-4 11-4Z" />
          <path d="m200 70 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" />
          <path d="m190 150 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" />
        </g>
      )}
      {mood === "sleepy" && (
        <g
          className="pet-zzz"
          fill="#8c7fb0"
          fontFamily="inherit"
          fontWeight="900"
        >
          <text x="176" y="58" fontSize="22">
            z
          </text>
          <text x="192" y="40" fontSize="16">
            z
          </text>
          <text x="204" y="26" fontSize="12">
            z
          </text>
        </g>
      )}
      {mood === "waiting" && (
        <g className="pet-question">
          <circle
            cx="196"
            cy="44"
            r="19"
            fill="#fff"
            stroke="#8c7fb0"
            strokeWidth="2.5"
          />
          <path
            d="m182 58-6 10 13-5"
            fill="#fff"
            stroke="#8c7fb0"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <text
            x="196"
            y="52"
            fontSize="22"
            fontWeight="900"
            textAnchor="middle"
            fill="#6b4fb0"
          >
            $
          </text>
        </g>
      )}
      <title>{`${label}. Brote: ${STAGE_NAMES[stage]}.`}</title>
    </svg>
  );
  return interactive ? (
    <button
      className="pet-cuddle"
      type="button"
      onClick={tap}
      onPointerDown={pressStart}
      onPointerUp={pressEnd}
      onPointerLeave={pressEnd}
      onPointerCancel={pressEnd}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={`Acariciar a ${shown}`}
    >
      {picture}
    </button>
  ) : (
    picture
  );
}
