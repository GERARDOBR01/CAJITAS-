import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Sprout from "./Sprout.jsx";
import {
  HAPPY_MS,
  MOOD_LABEL,
  STAGE_NAMES,
  eyeOffset,
  growthStage,
  petMood,
  registerTap,
} from "../pet/state.js";

// Cookie, el gatito café: la mascota principal de Guardadito. Original art,
// drawn as layered SVG so each part (ears, tail, paws, face) can move.
const FUR = "#c98b5b",
  FUR_DARK = "#9c6239",
  FUR_LIGHT = "#e6b688",
  CREAM = "#fcebd6",
  LINE = "#5b3826",
  PINK = "#f39bb0",
  INNER_EAR = "#f7b9c6",
  EYE = "#3a2216";

export const BECHO_LINES = ["¡BECHO!", "BECHO BECHO"];
export const LOVE_TEXT = "¡Te amo Jade!";
export const LOVE_MS = 3200;
const KISS_MS = 2400;

const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Next “becho” in 9–16 s, so it feels spontaneous but frequent. */
export function nextBechoDelay(random = Math.random) {
  return 9000 + Math.floor(random() * 7000);
}

function CatEyes({ face, look }) {
  const L = 93,
    R = 147,
    Y = 100;
  if (face === "love")
    return (
      <g
        className="cookie-eyes love-eyes"
        fill="#e5486c"
        stroke={LINE}
        strokeWidth="2"
      >
        {[L, R].map((x) => (
          <path
            key={x}
            d={`M${x} ${Y + 10}c-14-9-16-17-10-21 4-3 9-1 10 3 1-4 6-6 10-3 6 4 4 12-10 21z`}
          />
        ))}
        <circle cx={L - 3} cy={Y - 4} r="2.4" fill="#fff" stroke="none" />
        <circle cx={R - 3} cy={Y - 4} r="2.4" fill="#fff" stroke="none" />
      </g>
    );
  if (face === "happy" || face === "kiss")
    return (
      <g
        className="cookie-eyes happy-eyes"
        fill="none"
        stroke={LINE}
        strokeWidth="4"
        strokeLinecap="round"
      >
        <path d={`M${L - 10} ${Y + 3}q10-13 20 0`} />
        <path d={`M${R - 10} ${Y + 3}q10-13 20 0`} />
      </g>
    );
  if (face === "sleepy")
    return (
      <g
        className="cookie-eyes sleepy-eyes"
        fill="none"
        stroke={LINE}
        strokeWidth="3.5"
        strokeLinecap="round"
      >
        <path d={`M${L - 10} ${Y}q10 8 20 0`} />
        <path d={`M${R - 10} ${Y}q10 8 20 0`} />
      </g>
    );
  const big = face === "excited";
  return (
    <g className="cookie-eyes">
      <g transform={`translate(${look.x} ${look.y})`}>
        {[L, R].map((x) => (
          <g key={x}>
            <ellipse
              cx={x}
              cy={Y}
              rx={big ? 13 : 11.5}
              ry={big ? 15.5 : 14}
              fill={EYE}
            />
            <ellipse
              cx={x}
              cy={Y + 5}
              rx={big ? 9 : 8}
              ry="6"
              fill="#6b4126"
              opacity=".55"
            />
            <circle cx={x + 4} cy={Y - 5} r={big ? 5.2 : 4.6} fill="#fff" />
            <circle cx={x - 4.5} cy={Y + 5} r="2.2" fill="#fff" opacity=".9" />
            {big && (
              <path
                d={`m${x - 6} ${Y - 10} 1.2 2.6 2.6 1.2-2.6 1.2-1.2 2.6-1.2-2.6-2.6-1.2 2.6-1.2z`}
                fill="#fff"
              />
            )}
          </g>
        ))}
      </g>
    </g>
  );
}

function CatMouth({ face }) {
  if (face === "kiss")
    return (
      <g className="cookie-kiss-mouth">
        <path
          d="M117 121q8-2 6 4-1 3-5 3 7 1 4 6-2 3-6 1"
          fill="none"
          stroke={LINE}
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    );
  if (face === "sleepy")
    return (
      <ellipse
        cx="120"
        cy="128"
        rx="3.5"
        ry="3"
        fill="none"
        stroke={LINE}
        strokeWidth="2.4"
      />
    );
  const open = face === "happy" || face === "excited" || face === "love";
  return (
    <g>
      {open && (
        <path
          d="M111 125q9 17 18 0z"
          fill="#d9617b"
          stroke={LINE}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
      )}
      {open && <path d="M115 132q5-4 10 0q-5 4-10 0" fill="#f6a1b2" />}
      <path
        d="M108 122q6 8 12 0q6 8 12 0"
        fill="none"
        stroke={LINE}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function Accessory({ accessory, stage }) {
  if (accessory === "leaf")
    return (
      <g transform="translate(0 -10)">
        <Sprout stage={stage} />
      </g>
    );
  if (accessory === "bow")
    return (
      <g transform="translate(160 52) rotate(18)">
        <path
          d="M0 0q-24-18-21 3 3 17 21 0 22 17 22-2 0-21-22-1"
          fill="#f28fb0"
          stroke={LINE}
          strokeWidth="2.2"
        />
        <circle
          cx="0"
          cy="1"
          r="5"
          fill="#f9c3d4"
          stroke={LINE}
          strokeWidth="2"
        />
      </g>
    );
  if (accessory === "scarf")
    return (
      <g className="cookie-scarf">
        <path
          d="M74 139q46 24 92 0l-1 13q-45 22-90 0Z"
          fill="#c9a3ec"
          stroke={LINE}
          strokeWidth="2.5"
        />
        <path
          d="M80 144l4 9M96 150l2 9M144 150l-2 9M160 144l-4 9"
          stroke="#fff"
          strokeWidth="2"
          opacity=".6"
        />
        <path
          d="M140 152v32l-15-5 4-26"
          fill="#c9a3ec"
          stroke={LINE}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </g>
    );
  if (accessory === "star")
    return (
      <path
        d="m162 46 4.5 9 10 1.5-7.2 7 1.7 10-9-4.7-9 4.7 1.7-10-7.2-7 10-1.5Z"
        fill="#f9d77a"
        stroke="#b08a3c"
        strokeWidth="2"
      />
    );
  return null;
}

export default function CookieCat({
  name,
  accessory = "leaf",
  progress = 0,
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
    [look, setLook] = useState({ x: 0, y: 0 }),
    [kiss, setKiss] = useState(""),
    [love, setLove] = useState(0);
  const taps = useRef([]),
    timers = useRef({}),
    longPress = useRef(false),
    bechoCount = useRef(0),
    svg = useRef();
  const shown = name ?? "Cookie",
    stage = stageProp ?? growthStage(progress),
    growth = 0.88 + Math.min(1, Math.max(0, progress)) * 0.12;
  const mood = petMood({
    celebrating: celebrating || moodProp === "celebrate",
    excited: moodProp === "excited",
    happy: happy || moodProp === "happy",
    waiting: moodProp === "waiting",
    daysAway: moodProp === "sleepy" ? Infinity : 0,
  });
  const loving = love > 0;
  const face = loving
    ? "love"
    : kiss && (mood === "idle" || mood === "waiting" || mood === "happy")
      ? "kiss"
      : mood === "celebrate"
        ? "happy"
        : mood;
  const label = loving
    ? `${shown} dice: ${LOVE_TEXT}`
    : `${shown}, tu gatito, ${MOOD_LABEL[mood]}`;
  const lively = motion && !reducedMotion();

  function later(key, fn, ms) {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, ms);
  }
  useEffect(() => {
    const all = timers.current;
    return () => Object.values(all).forEach(clearTimeout);
  }, []);

  // ¡BECHO! cada poco tiempo, alternando con BECHO BECHO.
  useEffect(() => {
    if (!interactive) return;
    let alive = true;
    function schedule() {
      later(
        "becho",
        () => {
          if (!alive) return;
          setKiss(BECHO_LINES[bechoCount.current++ % BECHO_LINES.length]);
          later("kiss", () => setKiss(""), KISS_MS);
          schedule();
        },
        nextBechoDelay(),
      );
    }
    later(
      "first",
      () => {
        if (!alive) return;
        setKiss(BECHO_LINES[bechoCount.current++ % BECHO_LINES.length]);
        later("kiss", () => setKiss(""), KISS_MS);
        schedule();
      },
      3500,
    );
    return () => {
      alive = false;
      clearTimeout(timers.current.first);
      clearTimeout(timers.current.becho);
    };
  }, [interactive]);

  useEffect(() => {
    if (!interactive || !lively) return;
    let frame = 0;
    function follow(e) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = svg.current?.getBoundingClientRect();
        if (box) setLook(eyeOffset({ x: e.clientX, y: e.clientY }, box, 3.5));
      });
    }
    window.addEventListener("pointermove", follow);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", follow);
    };
  }, [interactive, lively]);

  function cheer(ms = HAPPY_MS) {
    setHappy(true);
    later("happy", () => setHappy(false), ms);
  }
  function tap() {
    if (longPress.current) {
      longPress.current = false;
      return;
    }
    setBounce((n) => n + 1);
    setKiss("");
    setLove((n) => n + 1);
    later("love", () => setLove(0), LOVE_MS);
    onPet?.("love");
    const next = registerTap(taps.current, Date.now());
    taps.current = next.taps;
    if (next.trick) {
      setTrick(true);
      later("trick", () => setTrick(false), 1100);
      onTrick?.();
    }
  }
  function pressStart() {
    longPress.current = false;
    later(
      "press",
      () => {
        longPress.current = true;
        cheer(2400);
        setKiss("prrr… 💕");
        later("kiss", () => setKiss(""), 2400);
        onPet?.("cuddle");
      },
      550,
    );
  }
  function pressEnd() {
    clearTimeout(timers.current.press);
  }

  const picture = (
    <svg
      ref={svg}
      className={`mascot cookie ${small ? "small" : ""} pet-cat mood-${mood} face-${face} ${mood === "celebrate" ? "celebrating" : ""}`}
      viewBox="0 0 240 220"
      role="img"
      aria-label={label}
      data-mood={mood}
      data-face={face}
      data-stage={stage}
    >
      <defs>
        <radialGradient id={`aura-${id}`}>
          <stop stopColor="#fff2dc" />
          <stop offset="1" stopColor="#f3c9a4" stopOpacity=".28" />
        </radialGradient>
        <radialGradient id={`fur-${id}`} cx=".42" cy=".32" r=".75">
          <stop stopColor={FUR_LIGHT} />
          <stop offset=".55" stopColor={FUR} />
          <stop offset="1" stopColor="#b87a4b" />
        </radialGradient>
      </defs>
      <circle
        className="pet-aura"
        cx="120"
        cy="118"
        r="94"
        fill={`url(#aura-${id})`}
      />
      <ellipse cx="120" cy="206" rx="62" ry="8" fill="#6d4a33" opacity=".12" />
      <g
        className={`pet-motion ${trick ? "trick" : ""} ${bounce ? `tap-${bounce % 2}` : ""}`}
      >
        <g
          className="pet-body"
          transform={`translate(120 205) scale(${growth}) translate(-120 -205)`}
        >
          {/* Tail */}
          <g className="cookie-tail">
            <path
              d="M158 182q42 4 44-30 1-22-14-30"
              fill="none"
              stroke={LINE}
              strokeWidth="19"
              strokeLinecap="round"
            />
            <path
              d="M158 182q42 4 44-30 1-22-14-30"
              fill="none"
              stroke={FUR}
              strokeWidth="13"
              strokeLinecap="round"
            />
            <path
              d="M196 140q3-10-8-18"
              fill="none"
              stroke={FUR_DARK}
              strokeWidth="13"
              strokeLinecap="round"
            />
            <path
              d="M201 160l-9-3M197 172l-9-5"
              stroke={FUR_DARK}
              strokeWidth="4"
              strokeLinecap="round"
            />
          </g>
          {/* Body */}
          <ellipse
            cx="120"
            cy="166"
            rx="52"
            ry="40"
            fill={`url(#fur-${id})`}
            stroke={LINE}
            strokeWidth="3"
          />
          <ellipse cx="120" cy="175" rx="29" ry="25" fill={CREAM} />
          <path
            d="M76 160q-6 6-4 13M164 160q6 6 4 13"
            fill="none"
            stroke={FUR_DARK}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* Feet */}
          {[88, 152].map((x) => (
            <g key={x}>
              <ellipse
                cx={x}
                cy="200"
                rx="18"
                ry="10"
                fill={CREAM}
                stroke={LINE}
                strokeWidth="3"
              />
              <path
                d={`M${x - 5} 196v6M${x + 5} 196v6`}
                stroke={LINE}
                strokeWidth="2"
                strokeLinecap="round"
                opacity=".55"
              />
            </g>
          ))}
          {/* Front paws */}
          <g className="cookie-paw left">
            <ellipse
              cx="99"
              cy="186"
              rx="13"
              ry="11"
              fill={CREAM}
              stroke={LINE}
              strokeWidth="3"
            />
            <path
              d="M95 183v5M103 183v5"
              stroke={LINE}
              strokeWidth="2"
              strokeLinecap="round"
              opacity=".55"
            />
          </g>
          <g className="cookie-paw right">
            <ellipse
              cx="141"
              cy="186"
              rx="13"
              ry="11"
              fill={CREAM}
              stroke={LINE}
              strokeWidth="3"
            />
            <circle cx="141" cy="188" r="3.4" fill={PINK} />
            <circle cx="136" cy="182" r="1.8" fill={PINK} />
            <circle cx="141" cy="180.5" r="1.8" fill={PINK} />
            <circle cx="146" cy="182" r="1.8" fill={PINK} />
          </g>
          {/* Collar with a cookie tag */}
          <path
            d="M76 140q44 22 88 0l-1 10q-43 21-86 0Z"
            fill="#e8667f"
            stroke={LINE}
            strokeWidth="2.5"
          />
          <g className="cookie-tag">
            <circle
              cx="120"
              cy="162"
              r="10"
              fill="#dca25d"
              stroke={LINE}
              strokeWidth="2.5"
            />
            <circle cx="116" cy="159" r="1.8" fill="#5b3420" />
            <circle cx="123" cy="158" r="1.5" fill="#5b3420" />
            <circle cx="121" cy="165" r="1.8" fill="#5b3420" />
            <circle cx="115" cy="165" r="1.2" fill="#5b3420" />
          </g>
          {/* Head */}
          <g className="cookie-head">
            <g className="pet-ear cat-ear left">
              <path
                d="M58 82 66 26q3-11 12-4l32 32Z"
                fill={FUR}
                stroke={LINE}
                strokeWidth="3"
                strokeLinejoin="round"
              />
              <path d="M70 70 74 36q2-5 6-1l20 22Z" fill={INNER_EAR} />
              <path
                d="M73 47l6 3M72 56l7 2"
                stroke="#fff"
                strokeWidth="1.8"
                strokeLinecap="round"
                opacity=".7"
              />
            </g>
            <g className="pet-ear cat-ear right">
              <path
                d="M182 82 174 26q-3-11-12-4l-32 32Z"
                fill={FUR}
                stroke={LINE}
                strokeWidth="3"
                strokeLinejoin="round"
              />
              <path d="M170 70 166 36q-2-5-6-1l-20 22Z" fill={INNER_EAR} />
              <path
                d="M167 47l-6 3M168 56l-7 2"
                stroke="#fff"
                strokeWidth="1.8"
                strokeLinecap="round"
                opacity=".7"
              />
            </g>
            <path
              d="M120 44c42 0 72 26 72 58 0 9-3 17-7 23l11 6-14 3c-13 16-35 24-62 24s-49-8-62-24l-14-3 11-6c-4-6-7-14-7-23 0-32 30-58 72-58Z"
              fill={`url(#fur-${id})`}
              stroke={LINE}
              strokeWidth="3"
              strokeLinejoin="round"
            />
            {/* Tabby stripes */}
            <g
              stroke={FUR_DARK}
              strokeWidth="4.5"
              strokeLinecap="round"
              fill="none"
            >
              <path d="M120 48v14" />
              <path d="M106 51l3 11" />
              <path d="M134 51l-3 11" />
              <path d="M54 98h10M52 108l11-2" />
              <path d="M186 98h-10M188 108l-11-2" />
            </g>
            <ellipse cx="120" cy="125" rx="31" ry="20" fill={CREAM} />
            <ellipse
              cx="78"
              cy="121"
              rx="13"
              ry="7.5"
              fill={PINK}
              opacity={face === "love" || face === "kiss" ? 0.95 : 0.6}
            />
            <ellipse
              cx="162"
              cy="121"
              rx="13"
              ry="7.5"
              fill={PINK}
              opacity={face === "love" || face === "kiss" ? 0.95 : 0.6}
            />
            <CatEyes face={face} look={look} />
            <path
              d="M114 112q6-4 12 0-2 6-6 7-4-1-6-7Z"
              fill="#f08aa1"
              stroke={LINE}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <CatMouth face={face} />
            <g
              className="cat-whiskers"
              stroke={LINE}
              strokeWidth="1.8"
              strokeLinecap="round"
              opacity=".55"
            >
              <path d="M90 120 62 114M90 126l-29 1M92 131l-26 8" />
              <path d="m150 120 28-6M150 126l29 1M148 131l26 8" />
            </g>
            <Accessory accessory={accessory} stage={stage} />
          </g>
        </g>
      </g>
      {(face === "kiss" || face === "love") && (
        <g
          className="cookie-kiss-hearts"
          fill="#ef6f8e"
          key={`${kiss}-${love}`}
        >
          <path d="M170 92c-8-7-9-12-5-15 3-2 6-1 7 2 1-3 4-4 7-2 4 3 2 8-9 15z" />
          <path d="M184 70c-6-5-7-9-4-11 2-2 5-1 6 1 1-2 3-3 5-1 3 2 2 6-7 11z" />
          <path d="M58 76c-6-5-7-9-4-11 2-2 5-1 6 1 1-2 3-3 5-1 3 2 2 6-7 11z" />
        </g>
      )}
      {mood === "happy" && !loving && !kiss && (
        <g className="pet-hearts" fill="#e28aa6" key={bounce}>
          <path d="M82 46q-12-14-17-3-4 11 17 20 20-13 16-21-5-11-16 4" />
        </g>
      )}
      {mood === "excited" && (
        <g className="pet-burst" fill="#f2c14e">
          <path d="m38 52 4 11 11 4-11 4-4 11-4-11-11-4 11-4Z" />
          <path d="m204 66 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" />
        </g>
      )}
      {mood === "sleepy" && !loving && (
        <g className="pet-zzz" fill="#8c7fb0" fontWeight="900">
          <text x="176" y="56" fontSize="22">
            z
          </text>
          <text x="192" y="38" fontSize="16">
            z
          </text>
          <text x="204" y="24" fontSize="12">
            z
          </text>
        </g>
      )}
      {mood === "waiting" && !loving && (
        <g className="pet-question">
          <circle
            cx="200"
            cy="40"
            r="19"
            fill="#fff"
            stroke="#8c7fb0"
            strokeWidth="2.5"
          />
          <path
            d="m186 54-6 10 13-5"
            fill="#fff"
            stroke="#8c7fb0"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <text
            x="200"
            y="48"
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

  const stageEl = (
    <span className={`cookie-stage ${small ? "small" : ""}`}>
      {picture}
      {kiss && !loving && (
        <span
          className={`cookie-bubble ${kiss.startsWith("prrr") ? "purr" : ""}`}
          role="status"
          key={kiss + bechoCount.current}
        >
          {kiss}
        </span>
      )}
      {loving && (
        <span className="cookie-love" role="status" key={love}>
          {/* With motion, the big message lives in the full-screen overlay. */}
          {lively ? (
            <span className="visually-hidden">{LOVE_TEXT}</span>
          ) : (
            <strong>{LOVE_TEXT}</strong>
          )}
          {lively &&
            Array.from({ length: 12 }, (_, i) => (
              <i
                key={i}
                style={{
                  "--angle": `${i * 30}deg`,
                  "--delay": `${(i % 4) * 0.05}s`,
                }}
              >
                ♥
              </i>
            ))}
        </span>
      )}
    </span>
  );

  return (
    <>
      {interactive ? (
        <button
          className="pet-cuddle cookie-button"
          type="button"
          onClick={tap}
          onPointerDown={pressStart}
          onPointerUp={pressEnd}
          onPointerLeave={pressEnd}
          onPointerCancel={pressEnd}
          onContextMenu={(e) => e.preventDefault()}
          aria-label={`Acariciar a ${shown}`}
        >
          {stageEl}
        </button>
      ) : (
        stageEl
      )}
      {loving &&
        lively &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="love-rain" aria-hidden="true" key={love}>
            <strong className="love-banner">
              <small>{shown} dice</small>
              {LOVE_TEXT}
            </strong>
            {Array.from({ length: 26 }, (_, i) => (
              <span
                key={i}
                style={{
                  left: `${(i * 37) % 100}%`,
                  animationDelay: `${(i % 9) * 0.11}s`,
                  fontSize: `${18 + ((i * 7) % 20)}px`,
                }}
              >
                {i % 3 ? "♥" : "💖"}
              </span>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
