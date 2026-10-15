/** The sprout grows with the savings: semilla, brote, hojitas, botón, flor. */
export default function Sprout({ stage }) {
  const stroke = "#557858";
  return (
    <g className={`pet-sprout stage-${stage}`} key={stage}>
      {stage === 0 ? (
        <>
          <ellipse
            cx="120"
            cy="56"
            rx="8"
            ry="5.5"
            fill="#c99a6b"
            stroke="#7b5a3c"
            strokeWidth="2.5"
          />
          <path
            d="M117 53q3 3 6 0"
            fill="none"
            stroke="#7b5a3c"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <path
            d={`M120 60V${stage === 1 ? 47 : 40}`}
            stroke={stroke}
            strokeWidth="3"
            strokeLinecap="round"
          />
          {stage === 1 ? (
            <path
              d="M120 49q-12 1-13-9 12-1 13 9 2-11 13-11 1 11-13 11"
              fill="#a5cf9b"
              stroke={stroke}
              strokeWidth="2.5"
            />
          ) : (
            <path
              d="M120 60V41q-24 1-26-17 24-2 26 17 5-22 26-25 2 23-26 25"
              fill="#90b68f"
              stroke={stroke}
              strokeWidth="2.5"
            />
          )}
          {stage === 3 && (
            <ellipse
              cx="120"
              cy="30"
              rx="8"
              ry="10"
              fill="#f2a7bd"
              stroke="#a5566e"
              strokeWidth="2.5"
            />
          )}
          {stage === 4 && (
            <g stroke="#a5566e" strokeWidth="2">
              {[0, 72, 144, 216, 288].map((r) => (
                <ellipse
                  key={r}
                  cx="120"
                  cy="20"
                  rx="7"
                  ry="10"
                  fill="#f6b8cb"
                  transform={`rotate(${r} 120 30)`}
                />
              ))}
              <circle cx="120" cy="30" r="6" fill="#f9dc8c" />
            </g>
          )}
        </>
      )}
    </g>
  );
}
