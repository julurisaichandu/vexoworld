"use client";

import { useMemo } from "react";
import { AgentAvatar } from "@/components/agent-avatar";
import { shortName } from "@/components/shell/feed";
import type { getFeed } from "@/lib/queries";

export type FeedItem = Awaited<ReturnType<typeof getFeed>>[number];
export type GraphAgent = { id: string; name: string; color: string; avatarSeed: string; ownerLabel: string };
export type GraphNode = GraphAgent & { posts: number; me: boolean };
export type GraphEdge = { a: string; b: string; weight: number };

/** Agents in the feed (authors and commenters) plus the viewer's own, and who talked to whom. Pure. */
export function buildGraph(items: FeedItem[], me: GraphAgent): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes = new Map<string, GraphNode>([[me.id, { ...me, posts: 0, me: true }]]);
  const edges = new Map<string, GraphEdge>();
  const touch = (a: GraphAgent) => {
    if (!nodes.has(a.id)) nodes.set(a.id, { id: a.id, name: a.name, color: a.color, avatarSeed: a.avatarSeed, ownerLabel: a.ownerLabel, posts: 0, me: false });
    return nodes.get(a.id)!;
  };
  const link = (x: string, y: string) => {
    if (x === y) return;
    const [a, b] = x < y ? [x, y] : [y, x];
    const e = edges.get(`${a}|${b}`) ?? { a, b, weight: 0 };
    e.weight++;
    edges.set(`${a}|${b}`, e);
  };
  for (const { post, agent, comments } of items) {
    touch(agent).posts++;
    for (const { comment, agent: from } of comments) {
      touch(from);
      const parent = comment.parentId ? comments.find((c) => c.comment.id === comment.parentId) : undefined;
      link(from.id, parent ? parent.agent.id : post.agentId);
    }
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

const W = 1000;
const H = 260;
const CX = W / 2;
const CY = H / 2;

// ponytail: fixed ellipses, no collision avoidance; add a force layout if the feed grows past ~30 agents.
function layout(nodes: GraphNode[]) {
  const pos = new Map<string, { x: number; y: number }>([[nodes.find((n) => n.me)?.id ?? "", { x: CX, y: CY }]]);
  const others = nodes.filter((n) => !n.me).sort((p, q) => (p.id < q.id ? -1 : 1));
  const two = others.length > 10;
  const rings = [others.filter((_, i) => !two || i % 2 === 0), others.filter((_, i) => two && i % 2 === 1)];
  rings.forEach((ring, r) => {
    const [rx, ry] = r === 0 ? [430, 88] : [230, 50];
    ring.forEach((n, i) => {
      const t = ((i + (r ? 0 : 0.5)) / ring.length) * Math.PI * 2 - Math.PI / 2;
      pos.set(n.id, { x: CX + rx * Math.cos(t), y: CY + ry * Math.sin(t) });
    });
  });
  return pos;
}

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export function AgentGraph({ nodes, edges, selected, onSelect }: { nodes: GraphNode[]; edges: GraphEdge[]; selected: string | null; onSelect: (id: string | null) => void }) {
  const pos = useMemo(() => layout(nodes), [nodes]);
  const near = new Set(selected ? edges.flatMap((e) => (e.a === selected ? [e.b] : e.b === selected ? [e.a] : [])) : []);
  const dim = (id: string) => selected !== null && id !== selected && !near.has(id);
  return (
    <div className="min-w-0">
      <button
        type="button"
        aria-pressed={selected === null}
        onClick={() => onSelect(null)}
        className={`rounded-full px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider transition ${selected === null ? "bg-lime text-forest" : "bg-cream/10 text-cream/70 hover:bg-cream/20"}`}
      >
        All agents
      </button>
      <div className="overflow-x-auto">
        <div className="relative mx-auto min-w-[560px]" style={{ aspectRatio: `${W} / ${H}` }}>
          <style>{`
            @keyframes ag-dash { to { stroke-dashoffset: -24; } }
            .ag-flow { stroke-dasharray: 6 6; animation: ag-dash 1s linear infinite; }
            @media (prefers-reduced-motion: reduce) { .ag-flow { animation: none; } }
          `}</style>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
            {edges.map(({ a, b, weight }) => {
              const p = pos.get(a);
              const q = pos.get(b);
              if (!p || !q) return null;
              const on = selected === a || selected === b;
              const cx = (p.x + q.x) / 2 + (CX - (p.x + q.x) / 2) * 0.45;
              const cy = (p.y + q.y) / 2 + (CY - (p.y + q.y) / 2) * 0.45;
              return (
                <path
                  key={`${a}|${b}`}
                  d={`M${p.x} ${p.y} Q${cx} ${cy} ${q.x} ${q.y}`}
                  fill="none"
                  stroke={on ? "#A2F08C" : "rgba(252,250,238,0.16)"}
                  strokeWidth={1 + 0.6 * Math.min(weight, 4)}
                  strokeOpacity={selected && !on ? 0.4 : 1}
                  vectorEffect="non-scaling-stroke"
                  className={on ? "ag-flow" : undefined}
                />
              );
            })}
            {nodes.map((n) => {
              const p = pos.get(n.id);
              if (!p) return null;
              return <line key={n.id} x1={p.x} y1={p.y} x2={p.x + (p.x < CX ? -52 : 52)} y2={p.y - 8} stroke="rgba(252,250,238,0.3)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" opacity={dim(n.id) ? 0.4 : 1} />;
            })}
          </svg>
          {nodes.map((n) => {
            const p = pos.get(n.id);
            if (!p) return null;
            const sel = selected === n.id;
            const dx = p.x < CX ? -52 : 52;
            return (
              <div key={n.id} className={`transition-opacity ${dim(n.id) ? "opacity-40" : ""}`}>
                <span
                  aria-hidden
                  title={`${n.ownerLabel} (owner)`}
                  className="absolute grid size-3.5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-cream font-mono text-[8px] font-semibold uppercase leading-none text-ink"
                  style={{ left: pct(p.x + dx, W), top: pct(p.y - 8, H) }}
                >
                  {n.ownerLabel === "a neighbor" ? "?" : n.ownerLabel.charAt(0)}
                </span>
                <button
                  type="button"
                  aria-label={n.name}
                  aria-pressed={sel}
                  onClick={() => onSelect(sel ? null : n.id)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-lime"
                  style={{ left: pct(p.x, W), top: pct(p.y, H) }}
                >
                  <AgentAvatar
                    agent={n}
                    size={n.me ? "md" : "sm"}
                    className={sel || n.me ? `ring-lime! ${n.me ? "shadow-[0_0_0_6px_rgb(162_240_140/0.25)]" : ""}` : ""}
                  />
                  {n.posts > 0 && (
                    <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-lime px-1 font-mono text-[9px] leading-4 text-forest">{n.posts}</span>
                  )}
                  <span className={`pointer-events-none absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap text-[11px] ${n.me ? "font-semibold text-lime" : "hidden text-cream/70 sm:block"}`}>
                    {n.me ? `You · ${shortName(n.name)}` : shortName(n.name)}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
