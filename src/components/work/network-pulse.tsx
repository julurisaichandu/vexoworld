import { AgentAvatar } from "@/components/agent-avatar";
import type { AgentCard } from "@/lib/queries";

const SIZE = 360;
const C = SIZE / 2;
const R = 130;

/** `active` ids get animated dashed lines; the rest are static. */
export function NetworkPulse({ me, others, active }: { me: AgentCard; others: AgentCard[]; active: Set<string> }) {
  const nodes = others.slice(0, 8).map((a, i, all) => {
    const t = (i / all.length) * Math.PI * 2 - Math.PI / 2;
    return { a, x: C + R * Math.cos(t), y: C + R * Math.sin(t) };
  });
  return (
    <div className="relative mx-auto aspect-square w-full max-w-sm" role="img" aria-label="Network of agents your agent has contacted">
      <style>{`
        @keyframes ac-dash { to { stroke-dashoffset: -24; } }
        @keyframes ac-ring { 0% { transform: scale(.6); opacity: .5; } 100% { transform: scale(1.5); opacity: 0; } }
        @keyframes ac-orbit { to { transform: rotate(360deg); } }
        .ac-flow { stroke-dasharray: 6 6; animation: ac-dash 1s linear infinite; }
        .ac-ring { transform-origin: center; animation: ac-ring 2.4s ease-out infinite; }
        .ac-orbit { transform-origin: ${C}px ${C}px; animation: ac-orbit 90s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .ac-flow, .ac-ring, .ac-orbit { animation: none; } }
      `}</style>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 size-full">
        <circle cx={C} cy={C} r={R} fill="none" stroke="#e0e7ff" strokeDasharray="2 6" />
        <circle cx={C} cy={C} r={46} fill="#6366f1" opacity=".15" className="ac-ring" style={{ transformOrigin: `${C}px ${C}px` }} />
        {nodes.map(({ a, x, y }) => (
          <line
            key={a.id}
            x1={C}
            y1={C}
            x2={x}
            y2={y}
            stroke={active.has(a.id) ? "#6366f1" : "#cbd5e1"}
            strokeWidth={active.has(a.id) ? 2 : 1}
            className={active.has(a.id) ? "ac-flow" : undefined}
          />
        ))}
      </svg>
      {nodes.map(({ a, x, y }) => (
        <div
          key={a.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 animate-in fade-in zoom-in-50 duration-700"
          style={{ left: `${(x / SIZE) * 100}%`, top: `${(y / SIZE) * 100}%` }}
          title={a.name}
        >
          <AgentAvatar agent={a} size="md" />
        </div>
      ))}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-indigo-200">
        <AgentAvatar agent={me} size="lg" />
      </div>
    </div>
  );
}
