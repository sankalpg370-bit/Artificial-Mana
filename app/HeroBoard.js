// The picture in the hero: a chalkboard with a small neural network.
export default function HeroBoard() {
  const counts = [3, 4, 2];
  const xs = [150, 290, 430];
  const pos = counts.map((n, l) => Array.from({ length: n }, (_, i) => [xs[l], 215 + (i - (n - 1) / 2) * 62]));
  const lines = [];
  for (let l = 0; l < 2; l++) pos[l].forEach((p, i) => pos[l + 1].forEach((q, j) => lines.push(<line key={`${l}-${i}-${j}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} />)));
  const serif = "Georgia, 'Times New Roman', serif";
  return (
    <svg viewBox="0 0 560 390" role="img" aria-label="A chalkboard with a small neural network drawn on it">
      <rect className="board-bg" width="560" height="390" />
      <text x="36" y="62" fill="#f3f1e7" fontSize="32" fontStyle="italic" fontFamily={serif}>What is AI?</text>
      <path d="M36 78 C110 90 190 72 262 82" stroke="#f4c542" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <g stroke="#f3f1e7" strokeOpacity=".3" strokeWidth="1.6">{lines}</g>
      <g stroke="#f3f1e7" strokeWidth="2.8" fill="none">
        {pos.flat().map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="15" />)}
      </g>
      {pos[2].map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="15" fill="#f4c542" />)}
      <g fill="#f3f1e7" fillOpacity=".75" fontSize="16" fontStyle="italic" fontFamily={serif} textAnchor="middle">
        <text x="150" y="350">input</text><text x="290" y="350">hidden</text><text x="430" y="350">output</text>
      </g>
      <text x="524" y="62" fill="#f3f1e7" fillOpacity=".8" fontSize="20" fontStyle="italic" fontFamily={serif} textAnchor="end">y = f(Wx + b)</text>
    </svg>
  );
}
