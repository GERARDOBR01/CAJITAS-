import Sprout from "./Sprout.jsx";

// Taro (shiba) and Nuri (nutria): flat, outline-free companions drawn in
// layers (tail, ears, arms, eyes, body) so each part can move on its own.
// Same props and moods as the classic pets; ClassicMascot owns the state.
const INK = "#2f2626";
const BODY =
  "M56 84C56 52 84 34 120 34C156 34 184 52 184 84L190 156C192 188 160 204 120 204C80 204 48 188 50 156Z";
const ARM = "M68 122C42 130 24 152 28 178C54 180 78 170 88 152Z";
const PAW_ARM = "M72 132C48 142 44 170 66 180C86 186 102 172 104 156Z";
const PEBBLE =
  "M120 192C78 166 84 134 106 136C113 137 118 142 120 147C122 142 127 137 134 136C156 134 162 166 120 192Z";

const SHIBA = {
  body: "#ff9638",
  dark: "#e86f1c",
  ring: "#ffc27a",
  cream: "#fff0d6",
};
const OTTER = {
  body: "#b0733f",
  dark: "#8c5530",
  ring: "#d7a06c",
  cream: "#f6e0bd",
};

const mirror = (children) => (
  <g transform="translate(240 0) scale(-1 1)">{children}</g>
);
const isHappy = (mood) =>
  mood === "happy" || mood === "celebrate" || mood === "excited";

function Toes({ x, y }) {
  return (
    <path
      d={`M${x - 6} ${y - 2}v5M${x} ${y - 3}v6M${x + 6} ${y - 2}v5`}
      fill="none"
      stroke="#000"
      strokeWidth="2"
      strokeLinecap="round"
      opacity=".22"
    />
  );
}

function Eyes({ mood, look, ring }) {
  return (
    <g>
      {[
        [88, 1],
        [152, -1],
      ].map(([x, side]) => (
        <g key={x}>
          <ellipse cx={x} cy="88" rx="28" ry="32" fill={ring} />
          {isHappy(mood) ? (
            <path
              className="pet-eyes happy-eyes"
              d={`M${x - 15} 96q15-24 30 0`}
              fill="none"
              stroke={INK}
              strokeWidth="6"
              strokeLinecap="round"
            />
          ) : mood === "sleepy" ? (
            <path
              className="pet-eyes sleepy-eyes"
              d={`M${x - 15} 90q15 14 30 0`}
              fill="none"
              stroke={INK}
              strokeWidth="5.5"
              strokeLinecap="round"
            />
          ) : (
            <g className="pet-eyes">
              <ellipse cx={x} cy="88" rx="23" ry="27" fill="#fff" />
              <g transform={`translate(${look.x} ${look.y})`}>
                <ellipse
                  cx={x + side * 6}
                  cy="92"
                  rx="9.5"
                  ry="14"
                  fill={INK}
                />
                <circle cx={x + side * 6 + 3.4} cy="85" r="4.2" fill="#fff" />
              </g>
            </g>
          )}
        </g>
      ))}
    </g>
  );
}

function Smile({ mood, y }) {
  if (mood === "sleepy")
    return (
      <ellipse cx="120" cy={y + 2} rx="4" ry="3" fill={INK} opacity=".7" />
    );
  return isHappy(mood) ? (
    <path
      d={`M108 ${y - 1}q12 20 24 0z`}
      fill="#d9546f"
      stroke={INK}
      strokeWidth="3"
      strokeLinejoin="round"
    />
  ) : (
    <path
      d={`M110 ${y}q10 10 20 0`}
      fill="none"
      stroke={INK}
      strokeWidth="3.6"
      strokeLinecap="round"
    />
  );
}

function Accessory({ accessory, y }) {
  if (accessory === "bow")
    return (
      <g transform="translate(150 50)">
        <path
          d="M0 0q-22-18-20 3 2 16 20 2 20 16 21-2 0-20-21-3"
          fill="#e9a5b9"
        />
        <circle cx="0" cy="2" r="5" fill="#f7c6d3" />
      </g>
    );
  if (accessory === "scarf")
    return (
      <g>
        <path
          d="M68 158Q120 188 172 158L170 174Q120 204 70 174Z"
          fill="#c9a8e6"
        />
        <path d="M146 182l12 0 8 24-14-3z" fill="#c9a8e6" />
      </g>
    );
  if (accessory === "star")
    return (
      <path
        d={`m120 ${y} 5 9 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2Z`}
        fill="#ffd64a"
      />
    );
  return null;
}

const SHIBA_EAR = (
  <>
    <path d="M70 70L60 18C59 10 68 10 76 15L114 42Z" fill={SHIBA.body} />
    <path d="M72 56L66 28C65 24 70 24 75 27L96 42Z" fill="#ffb3c4" />
  </>
);

function Shiba({ mood, look, accessory }) {
  const c = SHIBA;
  return (
    <>
      <g className="pet-tail">
        <path
          d="M172 176C208 182 224 150 206 128C196 118 184 128 192 140C200 154 188 164 170 160Z"
          fill={c.dark}
        />
        <path
          d="M200 132C190 124 184 132 190 142C194 146 200 144 202 138Z"
          fill={c.cream}
        />
      </g>
      <g className="pet-ear">{SHIBA_EAR}</g>
      {mirror(<g className="pet-ear">{SHIBA_EAR}</g>)}
      <path className="pet-arm left" d={ARM} fill={c.dark} />
      {mirror(<path className="pet-arm right" d={ARM} fill={c.dark} />)}
      <path d={BODY} fill={c.body} />
      <clipPath id="shiba-clip">
        <path d={BODY} />
      </clipPath>
      <g clipPath="url(#shiba-clip)">
        <ellipse cx="120" cy="150" rx="60" ry="30" fill={c.cream} />
        <ellipse cx="120" cy="210" rx="40" ry="30" fill={c.cream} />
      </g>
      <Eyes mood={mood} look={look} ring={c.ring} />
      <circle cx="86" cy="50" r="4.8" fill={c.cream} />
      <circle cx="154" cy="50" r="4.8" fill={c.cream} />
      <path d="M114 122q6-5 12 0q-1 7-6 8q-5-1-6-8z" fill={INK} />
      {isHappy(mood) || mood === "sleepy" ? (
        <Smile mood={mood} y={133} />
      ) : (
        <path
          d="M120 130v4M120 134q-6 8-13 3M120 134q6 8 13 3"
          fill="none"
          stroke={INK}
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      )}
      <ellipse cx="58" cy="124" rx="10" ry="7" fill="#ff7f8f" opacity=".7" />
      <ellipse cx="182" cy="124" rx="10" ry="7" fill="#ff7f8f" opacity=".7" />
      <path d="M92 168Q120 180 148 168L120 194Z" fill="#ff4d57" />
      <Accessory accessory={accessory} y={176} />
      {[92, 148].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="205" rx="19" ry="8" fill={c.cream} />
          <Toes x={x} y={206} />
        </g>
      ))}
    </>
  );
}

function Otter({ mood, look, accessory }) {
  const c = OTTER;
  return (
    <>
      <g className="pet-tail otter-tail">
        <path
          d="M172 192C210 200 232 178 222 152C217 143 206 148 209 159C212 172 196 182 172 178Z"
          fill={c.dark}
        />
        <path
          d="M200 184q10-4 16-14M192 188q4-2 8-4"
          fill="none"
          stroke={c.body}
          strokeWidth="3"
          strokeLinecap="round"
          opacity=".6"
        />
      </g>
      {[78, 162].map((x) => (
        <g className="pet-ear" key={x}>
          <circle cx={x} cy="46" r="15" fill={c.body} />
          <circle cx={x} cy="48" r="7" fill={c.dark} />
        </g>
      ))}
      <path d={BODY} fill={c.body} />
      <clipPath id="otter-clip">
        <path d={BODY} />
      </clipPath>
      <g clipPath="url(#otter-clip)">
        <ellipse cx="120" cy="176" rx="42" ry="32" fill={c.cream} />
      </g>
      <path
        d="M82 56C92 44 110 40 124 42"
        fill="none"
        stroke="#fff"
        strokeWidth="6"
        strokeLinecap="round"
        opacity=".28"
      />
      <Eyes mood={mood} look={look} ring={c.ring} />
      <ellipse cx="120" cy="128" rx="35" ry="24" fill={c.cream} />
      <path d="M110 118q10-6 20 0q-1 9-10 11q-9-2-10-11z" fill={INK} />
      <ellipse cx="116" cy="120" rx="3" ry="1.7" fill="#fff" opacity=".6" />
      <Smile mood={mood} y={134} />
      <g fill={c.dark} opacity=".7">
        <circle cx="100" cy="130" r="1.8" />
        <circle cx="106" cy="135" r="1.8" />
        <circle cx="140" cy="130" r="1.8" />
        <circle cx="134" cy="135" r="1.8" />
      </g>
      <path
        d="M86 124l-14-3M86 130l-14 4M154 124l14-3M154 130l14 4"
        fill="none"
        stroke={c.dark}
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity=".7"
      />
      <ellipse cx="58" cy="124" rx="10" ry="7" fill="#ff8f9f" opacity=".7" />
      <ellipse cx="182" cy="124" rx="10" ry="7" fill="#ff8f9f" opacity=".7" />
      <path className="pet-arm left" d={PAW_ARM} fill={c.dark} />
      {mirror(<path className="pet-arm right" d={PAW_ARM} fill={c.dark} />)}
      <g className="pet-pebble">
        <path d={PEBBLE} fill="#a8a5c6" />
        <path
          d="M120 192C100 180 88 166 90 150C92 156 104 176 120 184C136 176 148 156 150 150C152 166 140 180 120 192Z"
          fill="#8b88ad"
        />
        <path
          d="M97 152q3-10 11-10"
          fill="none"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
          opacity=".55"
        />
        <g fill="#7a77a0" opacity=".7">
          <circle cx="132" cy="160" r="2" />
          <circle cx="124" cy="172" r="1.6" />
          <circle cx="140" cy="152" r="1.5" />
        </g>
        <path
          className="pet-twinkle"
          d="m146 138 2.2 5.8 5.8 2.2-5.8 2.2-2.2 5.8-2.2-5.8-5.8-2.2 5.8-2.2z"
          fill="#fff"
        />
      </g>
      <ellipse cx="92" cy="182" rx="12" ry="10" fill={c.dark} />
      <ellipse cx="148" cy="182" rx="12" ry="10" fill={c.dark} />
      <Accessory accessory={accessory} y={150} />
      {[92, 148].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="205" rx="19" ry="8" fill={c.dark} />
          <Toes x={x} y={206} />
        </g>
      ))}
    </>
  );
}

/** Sketch space is 240×225 with the feet at y=213; fit it into the 240×220
 * mascot frame, standing on the shared ground line, with room for the sprout. */
export default function FlatPet({ pet, mood, look, stage, accessory }) {
  const Body = pet === "otter" ? Otter : Shiba;
  return (
    <g transform="translate(120 199) scale(.9) translate(-120 -213)">
      <Body mood={mood} look={look} accessory={accessory} />
      <g transform="translate(0 -22)">
        <Sprout stage={stage} />
      </g>
    </g>
  );
}
