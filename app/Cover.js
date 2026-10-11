// A cover picture for a course card. It is drawn here, so the home page does not load images from YouTube.
const PALETTES = [["#1f3b2d", "#2f5d46"], ["#1b2a5c", "#2b59e8"], ["#3b1f4a", "#7a3fa0"], ["#12403f", "#1f8a85"], ["#2d2f3a", "#4b5068"], ["#4a2f14", "#a8672a"]];
const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

export default function Cover({ seed }) {
  const h = hash(seed || "x");
  const [a, b] = PALETTES[h % PALETTES.length];
  const counts = [2 + ((h >> 3) % 2), 3 + ((h >> 5) % 2), 2 + ((h >> 7) % 2)];
  const xs = [90, 160, 230];
  const pos = counts.map((n, l) => Array.from({ length: n }, (_, i) => [xs[l], 90 + (i - (n - 1) / 2) * 38]));
  const lines = [];
  for (let l = 0; l < 2; l++) pos[l].forEach((p, i) => pos[l + 1].forEach((q, j) => lines.push(<line key={`${l}-${i}-${j}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} />)));
  return (
    <svg className="cover" viewBox="0 0 320 180" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id={`g${h}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient></defs>
      <rect width="320" height="180" fill={`url(#g${h})`} />
      <g stroke="#f3f1e7" strokeOpacity=".28" strokeWidth="1.4">{lines}</g>
      <g stroke="#f3f1e7" strokeWidth="2.2" fill="none">
        {pos.flat().map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="7" />)}
      </g>
      <circle cx={pos[2][0][0]} cy={pos[2][0][1]} r="7" fill="#f4c542" />
    </svg>
  );
}
