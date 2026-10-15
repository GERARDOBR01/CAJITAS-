import { useId } from "react";

// Small, original drawings: a seed becomes a flower as a goal grows.
const ink = "#66564e";
const pink = "#f2bdc9";
const sage = "#b9d1ad";
const cream = "#fff9eb";
const lilac = "#d8cbe8";
const honey = "#f1d491";

function Leaf({ x = 0, y = 0, rotate = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <path d="M0 12Q-18 12-19-3 0-5 0 12Q1-10 20-12 22 7 0 12Z" fill={sage} />
      <path d="M0 24V12M0 12-12 2M0 12 12-4" fill="none" />
    </g>
  );
}

function Flower({ x, y, color = pink, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M0 8V33M0 27Q-15 27-16 16 0 15 0 27M0 23Q14 23 15 12 0 12 0 23"
        fill={sage}
      />
      <path
        d="M0-9C-8-24-22-8-10 0-28 4-13 22-3 10 0 29 18 16 9 6 27 4 19-14 7-7 10-25-7-25 0-9Z"
        fill={color}
      />
      <circle r="6" fill={honey} />
    </g>
  );
}

function Sparkle({ x, y, small = false }) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${small ? 0.65 : 1})`}
      stroke="#b69962"
      fill={honey}
    >
      <path d="M0-8 2-2 8 0 2 2 0 8-2 2-8 0-2-2Z" />
    </g>
  );
}

function Face({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="-20" cy="7" rx="7" ry="4" fill={pink} stroke="none" />
      <ellipse cx="20" cy="7" rx="7" ry="4" fill={pink} stroke="none" />
      <path d="M-12-1v3M12-1v3M-5 8q5 6 10 0" fill="none" />
    </g>
  );
}

function Welcome() {
  return (
    <>
      <path
        d="M35 133C8 111 33 66 53 67 33 31 86 16 114 39 136 13 174 30 179 55 209 38 236 87 212 112 232 145 196 161 168 146 119 172 77 161 35 133Z"
        fill="#f4eee0"
        stroke="none"
      />
      <ellipse
        cx="120"
        cy="159"
        rx="88"
        ry="8"
        fill="#66564e"
        opacity=".07"
        stroke="none"
      />
      <g transform="rotate(9 176 104)">
        <rect x="139" y="66" width="76" height="86" rx="8" fill={cream} />
        <path d="M169 69h17" stroke={lilac} strokeWidth="9" />
        <path d="M153 131h27M153 140h40" stroke="#d5c5ac" />
        <path
          d="m184 85 5 9 10 2-7 7 1 10-9-5-9 5 2-10-8-7 10-2Z"
          fill={honey}
        />
        <Leaf x={160} y={102} rotate={-8} />
      </g>
      <g>
        <path
          d="M56 80Q34 47 48 38q26 2 31 32M104 68q11-30 31-30 14 11-8 42"
          fill={pink}
        />
        <path d="m53 49 9 16M120 49l-8 16" stroke="#d99aa9" />
        <path d="M130 122q26-11 21 4-8 7-16-2" fill="none" />
        <path
          d="M51 105Q28 112 34 129q7 8 19-5M127 108q22-14 26 0-3 11-21 13"
          fill={pink}
        />
        <path
          d="M58 137v16q11 7 20-1l4-14M102 140l3 14q12 6 21-2l-5-19"
          fill={pink}
        />
        <path
          d="M44 93C44 51 131 50 134 91L132 121q-5 27-44 26-44-1-44-54Z"
          fill="#f7ccd4"
        />
        <ellipse cx="63" cy="102" rx="9" ry="5" fill="#ecacb9" stroke="none" />
        <ellipse cx="116" cy="102" rx="9" ry="5" fill="#ecacb9" stroke="none" />
        <path d="M72 89v4M107 89v4" fill="none" strokeWidth="3.4" />
        <ellipse cx="89" cy="104" rx="17" ry="12" fill={pink} />
        <path d="M83 102v4M95 102v4M83 124q7 5 14-1" fill="none" />
        <path d="M70 132q19-11 40 0l-3 22H73Z" fill={honey} />
        <path d="M76 141q12-4 27 0M77 148h23" stroke="#c8a972" />
        <Leaf x={88} y={118} rotate={-9} />
      </g>
      <g className="illustration-float">
        <Sparkle x={25} y={63} />
        <Sparkle x={217} y={43} small />
      </g>
    </>
  );
}

function Empty() {
  return (
    <>
      <ellipse
        cx="120"
        cy="153"
        rx="78"
        ry="8"
        fill="#66564e"
        opacity=".07"
        stroke="none"
      />
      <path
        d="M53 143Q24 104 62 73q24-18 52 1 32-37 68-14 42 29 17 70Z"
        fill="#f0f1e5"
        stroke="none"
      />
      <path
        d="M50 151q-12-17-23-10 2 14 23 10M50 151q-2-23 11-22 8 13-11 22"
        fill={sage}
      />
      <g transform="rotate(-5 112 104)">
        <rect x="65" y="72" width="104" height="76" rx="18" fill={sage} />
        <rect x="57" y="64" width="120" height="27" rx="9" fill="#d9e6c9" />
        <path d="M99 76h35" strokeWidth="4" />
        <Face x={117} y={111} />
        <path
          d="M145 149v-20q-18 0-20-14 19-3 20 14 2-23 18-23 5 15-18 23"
          fill={sage}
        />
      </g>
      <path d="M164 122q-4-25 15-27 22 1 18 27" fill="none" />
      <path d="M156 119q21-7 46 0l-5 30q-17 9-36 0Z" fill={honey} />
      <path d="M164 127h29M166 136h24M169 145h18" stroke="#c5a66f" />
      <g className="illustration-float">
        <Leaf x={118} y={39} rotate={9} />
      </g>
      <path d="M113 48q4 3 8 0" fill="none" stroke="#809775" />
      <Sparkle x={51} y={49} small />
      <Sparkle x={199} y={70} small />
    </>
  );
}

function Activity() {
  return (
    <>
      <path
        d="M53 133C21 120 34 70 63 62 82 27 126 33 142 60 175 40 214 73 199 110 211 147 155 158 127 143 99 163 70 153 53 133Z"
        fill="#f0eaf5"
        stroke="none"
      />
      <ellipse
        cx="123"
        cy="157"
        rx="76"
        ry="7"
        fill="#66564e"
        opacity=".07"
        stroke="none"
      />
      <g transform="rotate(-7 113 106)">
        <rect x="64" y="48" width="99" height="107" rx="9" fill={lilac} />
        <path d="M80 49v105" fill="none" stroke="#b7a3ca" />
        <rect x="92" y="67" width="56" height="68" rx="8" fill={cream} />
        <path
          d="m102 82 3 3 6-7M119 83h18m-35 16 3 3 6-7M119 100h18m-35 16 3 3 6-7M119 117h10"
          fill="none"
        />
        <path
          d="M70 65h13M70 86h13M70 107h13M70 128h13"
          stroke="#9a87ad"
          strokeWidth="4"
        />
      </g>
      <g transform="rotate(22 174 102)">
        <path d="M161 59a12 12 0 0 1 24 0v66l-12 24-12-24Z" fill={honey} />
        <path d="M161 67h24v-9q-1-16-12-16-11 0-12 16Z" fill={pink} />
        <path d="M161 67h24v9h-24Z" fill={cream} />
        <path d="M161 125h24l-12 24Z" fill="#f1dec2" />
        <path d="m169 141 4 8 4-8" fill={ink} />
        <path d="M169 82v39" fill="none" stroke="#d6b36d" />
        <Face x={173} y={94} />
      </g>
      <g className="illustration-float">
        <Sparkle x={48} y={86} />
        <Sparkle x={198} y={38} small />
      </g>
    </>
  );
}

function Backup() {
  return (
    <>
      <path
        d="M47 135C21 119 35 74 64 64 64 30 125 21 146 51 182 34 220 86 196 116 202 150 159 162 130 147 97 163 59 163 47 135Z"
        fill="#edf0e5"
        stroke="none"
      />
      <ellipse
        cx="125"
        cy="157"
        rx="72"
        ry="8"
        fill="#66564e"
        opacity=".07"
        stroke="none"
      />
      <path d="M65 109q-24 6-15 35h26M174 109q24 6 15 35h-26" fill={sage} />
      <path d="M101 49v-9q17-15 34 0v9" fill="none" strokeWidth="6" />
      <path
        d="M68 74q1-27 26-29h50q25 2 26 29v65q-2 17-19 17H87q-19-1-19-17Z"
        fill={sage}
      />
      <path d="M69 74q48 20 100 0v14q-50 19-100 0Z" fill="#d8e3c7" />
      <rect x="85" y="101" width="68" height="42" rx="13" fill={cream} />
      <path d="M93 111h51" fill="none" stroke="#c5b8a0" />
      <path d="M138 111v7" fill="none" />
      <path
        d="M119 121q-9-12-15-3-5 10 15 20 20-10 15-20-6-9-15 3Z"
        fill={pink}
      />
      <path d="M91 63v3M146 63v3M112 70q7 5 14 0" fill="none" strokeWidth="3" />
      <g className="illustration-float">
        <g transform="rotate(12 179 49)">
          <rect x="163" y="30" width="34" height="40" rx="5" fill={cream} />
          <path d="M171 41h16M171 48h13M171 55h9" stroke="#b7a3ca" />
        </g>
      </g>
      <Flower x={47} y={133} scale={0.65} />
      <Sparkle x={58} y={42} small />
    </>
  );
}

function Complete() {
  return (
    <>
      <path
        d="M44 130C16 111 35 65 66 60 76 30 122 20 146 51 187 33 223 79 200 111 208 146 165 158 134 145 104 166 67 158 44 130Z"
        fill="#f8eedb"
        stroke="none"
      />
      <ellipse
        cx="120"
        cy="157"
        rx="75"
        ry="7"
        fill="#66564e"
        opacity=".07"
        stroke="none"
      />
      <g className="illustration-sway">
        <Flower x={76} y={93} color={lilac} scale={1.05} />
        <Flower x={153} y={81} color={pink} scale={1.1} />
        <Flower x={113} y={57} color="#f6e1a3" scale={1.2} />
        <Flower x={126} y={103} color={cream} scale={0.8} />
        <path
          d="m73 124 47 23 39-33M114 100l6 47"
          fill="none"
          stroke="#809775"
        />
      </g>
      <path d="M71 123q47 18 99-1l-8 28q-40 17-84 0Z" fill={sage} />
      <path d="M79 130q38 10 84-1" fill="none" stroke="#95ad89" />
      <path
        d="m107 137-10-8q-14 1-11 10 2 10 21-2 19 12 22 3 4-12-12-11Z"
        fill={pink}
      />
      <circle cx="112" cy="137" r="5" fill="#f9d4db" />
      <path d="m110 141-4 15M116 141l5 13" fill="none" stroke="#ce96a4" />
      <g className="illustration-float">
        <Sparkle x={37} y={67} />
        <Sparkle x={195} y={46} />
        <Sparkle x={195} y={130} small />
      </g>
      <path
        d="m49 35 4 7m117-18-3 8m43 59-7 3M29 113l6 3"
        fill="none"
        stroke="#b7a3ca"
        strokeWidth="3"
      />
    </>
  );
}

function Mail() {
  return (
    <>
      <path
        d="M39 132C18 112 34 75 65 68 70 34 117 28 139 51 177 33 216 68 204 102 226 132 189 157 157 145 117 166 65 160 39 132Z"
        fill="#f2edf5"
        stroke="none"
      />
      <ellipse
        cx="122"
        cy="155"
        rx="85"
        ry="7"
        fill={ink}
        opacity=".07"
        stroke="none"
      />
      <g transform="rotate(-6 137 106)">
        <rect x="77" y="63" width="122" height="84" rx="11" fill={cream} />
        <path d="m79 70 51 39q8 6 16 0l51-39" fill="#f7dce1" />
        <path d="m79 141 37-30m81 30-37-30" fill="none" stroke="#d6c4b6" />
        <rect x="170" y="74" width="19" height="23" rx="3" fill={lilac} />
        <path
          d="M179 79q-5-3-5 2-5 2-1 5-1 5 4 4 4 4 6 0 5 0 3-4 3-5-2-5-2-4-5-2Z"
          fill={cream}
          stroke="none"
        />
        <circle cx="180" cy="85" r="2.2" fill={honey} stroke="none" />
        <Face x={138} y={121} />
      </g>
      <g className="illustration-sway">
        <path
          d="M58 114Q39 100 44 88q13-5 18 20 2-26 16-26 9 12-12 32"
          fill={sage}
        />
        <path d="m50 96 10 17m12-22-8 22" fill="none" stroke="#809775" />
      </g>
      <path
        d="M37 132q-1-23 25-26 25 3 25 26-1 24-25 24-23 0-25-24Z"
        fill={honey}
      />
      <path d="M62 111q-6 12-4 20" fill="none" stroke="#d3b570" />
      <g transform="translate(62 133) scale(.58)">
        <Face x={0} y={0} />
      </g>
      <path d="m42 148-6 4m45-4 6 4" fill="none" />
      <Flower x={204} y={132} color={pink} scale={0.55} />
      <Sparkle x={46} y={56} small />
      <Sparkle x={210} y={50} small />
    </>
  );
}

function Path() {
  return (
    <>
      <path
        d="M31 130C14 106 37 76 64 78 81 43 113 43 139 56 158 24 206 40 207 72 234 98 213 140 181 137 144 168 71 163 31 130Z"
        fill="#eff2e7"
        stroke="none"
      />
      <path
        d="M52 134c26 19 36-33 69-16s43 6 69-24"
        fill="none"
        stroke="#a5b796"
        strokeWidth="3"
        strokeDasharray="1 8"
      />
      <g transform="translate(52 127)">
        <g transform="translate(0 -47) scale(.48)">
          <Leaf />
        </g>
        <path
          d="M-21-18c0-25 42-25 42 0C21-5 7 0 0 7-7 0-21-5-21-18Z"
          fill={cream}
        />
        <g transform="translate(0 -18) scale(.48)">
          <Face x={0} y={0} />
        </g>
      </g>
      <g transform="translate(121 111)">
        <g transform="translate(0 -49) scale(.58)">
          <Leaf />
        </g>
        <path
          d="M-21-18c0-25 42-25 42 0C21-5 7 0 0 7-7 0-21-5-21-18Z"
          fill={lilac}
        />
        <g transform="translate(0 -18) scale(.48)">
          <Face x={0} y={0} />
        </g>
      </g>
      <g transform="translate(190 87)">
        <g transform="translate(0 -51) scale(.68)">
          <Leaf />
        </g>
        <path
          d="M-21-18c0-25 42-25 42 0C21-5 7 0 0 7-7 0-21-5-21-18Z"
          fill="#f7ccd4"
        />
        <g transform="translate(0 -18) scale(.48)">
          <Face x={0} y={0} />
        </g>
      </g>
      <Sparkle x={157} y={34} />
      <path d="m150 137 3 4m-69-88 3-3" fill="none" stroke="#baa3c9" />
    </>
  );
}

const scenes = {
  welcome: Welcome,
  empty: Empty,
  activity: Activity,
  backup: Backup,
  complete: Complete,
  mail: Mail,
  path: Path,
};

/** Decorative by default. Supply a Spanish title when the drawing conveys content. */
export default function Illustration({
  kind = "empty",
  className = "",
  title,
  ...svgProps
}) {
  const titleId = useId();
  const Scene = scenes[kind] || Empty;
  return (
    <svg
      {...svgProps}
      className={`cajitas-illustration cajitas-illustration--${kind} ${className}`.trim()}
      viewBox="0 0 240 180"
      fill="none"
      stroke={ink}
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-labelledby={title ? titleId : undefined}
      focusable="false"
    >
      {title && <title id={titleId}>{title}</title>}
      <Scene />
    </svg>
  );
}
