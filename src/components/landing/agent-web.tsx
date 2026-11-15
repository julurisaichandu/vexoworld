type Agent = {
  x: number;
  y: number;
  human: { x: number; y: number; initials: string; name: string };
  chip?: { who: string; state: string; below?: boolean };
};

const AGENTS: Agent[] = [
  { x: 210, y: 170, human: { x: 90, y: 260, initials: "SR", name: "Sarah" }, chip: { who: "Sarah's agent", state: "negotiating" } },
  { x: 430, y: 95, human: { x: 350, y: 185, initials: "AK", name: "Alex" }, chip: { who: "Alex's agent", state: "asking Alex" } },
  { x: 600, y: 225, human: { x: 690, y: 305, initials: "MJ", name: "Maya" }, chip: { who: "Maya's agent", state: "scheduling", below: true } },
  { x: 820, y: 110, human: { x: 915, y: 195, initials: "LP", name: "Leo" }, chip: { who: "Leo's agent", state: "searching" } },
  { x: 1010, y: 250, human: { x: 1110, y: 330, initials: "NR", name: "Nina" } },
  { x: 380, y: 290, human: { x: 280, y: 370, initials: "OK", name: "Omar" } },
  { x: 760, y: 335, human: { x: 850, y: 405, initials: "PS", name: "Priya" } },
  { x: 1100, y: 120, human: { x: 1150, y: 50, initials: "DV", name: "Dev" } },
];

// agent-to-agent mesh: every agent has 2-3 links, no hub
const LINKS: [number, number][] = [
  [0, 1], [0, 5], [1, 2], [1, 3], [2, 3], [2, 6], [3, 7], [4, 7], [4, 6], [5, 6],
];

const CSS = `
.aw-pulse{fill:none;stroke:#a2f08c;stroke-width:2.5;stroke-linecap:round;stroke-dasharray:6 94;animation:aw-run 5s linear infinite}
.aw-ask{animation:aw-ask 7s ease-in-out infinite}
.aw-core{animation:aw-glow 3.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes aw-run{from{stroke-dashoffset:6}to{stroke-dashoffset:-94}}
@keyframes aw-ask{0%,68%{stroke-opacity:.28;stroke:#fcfaee}78%{stroke-opacity:1;stroke:#a2f08c}100%{stroke-opacity:.28;stroke:#fcfaee}}
@keyframes aw-glow{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.18)}}
@media (prefers-reduced-motion: reduce){.aw-pulse,.aw-ask,.aw-core{animation:none}.aw-pulse{stroke-dasharray:none;stroke-opacity:.25}}
`;

export function AgentWeb({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 540"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="A network of personal AI agents, each connected to its human"
      className={className ?? "block h-auto w-full"}
      style={{ fontFamily: "var(--font-geist), ui-sans-serif, system-ui, sans-serif" }}
    >
      <style>{CSS}</style>
      <defs>
        <radialGradient id="aw-glow">
          <stop offset="0" stopColor="#a2f08c" stopOpacity=".5" />
          <stop offset="1" stopColor="#a2f08c" stopOpacity="0" />
        </radialGradient>
      </defs>

      {LINKS.map(([a, b], i) => {
        const p = AGENTS[a];
        const q = AGENTS[b];
        return (
          <g key={`l${i}`}>
            <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#fcfaee" strokeOpacity=".14" strokeWidth="1.2" />
            <line
              className="aw-pulse"
              x1={p.x}
              y1={p.y}
              x2={q.x}
              y2={q.y}
              pathLength={100}
              style={{ animationDelay: `${-(i * 0.9).toFixed(1)}s`, animationDuration: `${4.4 + (i % 4) * 0.7}s` }}
            />
          </g>
        );
      })}

      {AGENTS.map((a, i) => (
        <line
          key={`t${i}`}
          className="aw-ask"
          x1={a.x}
          y1={a.y}
          x2={a.human.x}
          y2={a.human.y}
          stroke="#fcfaee"
          strokeOpacity=".28"
          strokeWidth="1.2"
          strokeDasharray="3 5"
          style={{ animationDelay: `${-(i * 1.7).toFixed(1)}s` }}
        />
      ))}

      {AGENTS.map((a, i) => (
        <g key={`h${i}`}>
          <circle cx={a.human.x} cy={a.human.y} r="15" fill="#fcfaee" />
          <text x={a.human.x} y={a.human.y + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="#0e1711">
            {a.human.initials}
          </text>
          <text x={a.human.x} y={a.human.y + 30} textAnchor="middle" fontSize="10.5" fill="#fcfaee" fillOpacity=".6">
            {a.human.name}
          </text>
        </g>
      ))}

      {AGENTS.map((a, i) => (
        <g key={`a${i}`}>
          <circle cx={a.x} cy={a.y} r="38" fill="url(#aw-glow)" className="aw-core" style={{ animationDelay: `${-(i * 0.8).toFixed(1)}s` }} />
          <rect x={a.x - 20} y={a.y - 20} width="40" height="40" rx="13" fill="#0e1711" stroke="#a2f08c" strokeOpacity=".4" strokeWidth="1.2" />
          <circle cx={a.x} cy={a.y} r="6.5" fill="#a2f08c" />
        </g>
      ))}

      {AGENTS.map((a, i) => {
        if (!a.chip) return null;
        const w = Math.round((a.chip.who.length + a.chip.state.length + 3) * 6.4 + 34);
        const x = a.x - w / 2;
        const y = a.chip.below ? a.y + 34 : a.y - 58;
        return (
          <g key={`c${i}`}>
            <rect x={x} y={y} width={w} height="26" rx="13" fill="#fcfaee" fillOpacity=".96" />
            <circle cx={x + 15} cy={y + 13} r="3.5" fill="#5fd13f" />
            <text x={x + 26} y={y + 17} fontSize="12" fill="#0e1711">
              {a.chip.who}
              <tspan fill="#5c6358">{` · ${a.chip.state}`}</tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}
