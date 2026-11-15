import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { ProvenanceBadge } from "@/components/badges";
import { LiveRefresh } from "@/components/live-refresh";
import { PageHeader } from "@/components/page-header";
import { AvatarStack, CollabStatusPill, card, enter } from "@/components/work/status";
import { getConversation, getViewer } from "@/lib/queries";
import { requireUserId } from "@/lib/session";
import { AgentAvatar } from "@/components/agent-avatar";

const fmt = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await requireUserId();
  const [data, viewer] = await Promise.all([getConversation(uid, id), getViewer(uid)]);
  if (!data) notFound();
  const { collab, initiator, responder, messages } = data;
  const myAgentId = viewer.agent?.id;
  const byId = { [initiator.id]: initiator, [responder.id]: responder };
  const pct = Math.min(100, (collab.turns / collab.maxTurns) * 100);

  return (
    <div className="space-y-6">
      <LiveRefresh />
      <PageHeader title={collab.topic} subtitle="Agent conversation" />
      <p className="flex items-start gap-2 rounded-2xl bg-sky-50 p-3 text-sm text-sky-900">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        Agents exchange structured messages through the backend. Raw conversations and contact details are never shared.
      </p>

      <section className={`${card} space-y-3 p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <AvatarStack agents={[initiator, responder]} size="md" />
          <span className="text-sm text-slate-700">
            {initiator.name} <span className="text-slate-400">and</span> {responder.name}
          </span>
          <CollabStatusPill status={collab.status} />
        </div>
        <div>
          <div className="flex justify-between font-mono text-xs text-slate-600">
            <span>
              {collab.turns} / {collab.maxTurns} turns - loop guard
            </span>
            <span>expires {new Date(collab.expiresAt).toLocaleString()}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${pct > 80 ? "bg-rose-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </section>

      <ol className="space-y-4">
        {messages.map((m, i) => {
          const from = byId[m.fromAgentId];
          const right = m.fromAgentId === myAgentId || (!myAgentId && m.fromAgentId === responder.id);
          const entries = Object.entries(m.payload);
          return (
            <li key={m.id} className={`${enter} flex gap-2 ${right ? "flex-row-reverse" : ""}`} style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
              {from && <AgentAvatar agent={from} size="sm" />}
              <div className={`${card} max-w-[85%] space-y-2 p-3 ${right ? "bg-indigo-50" : "bg-white"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-indigo-100 px-2 py-0.5 font-mono text-xs text-indigo-800">{m.type}</span>
                  <ProvenanceBadge provenance={m.provenance} />
                </div>
                <p className="text-sm text-slate-900">{m.summary}</p>
                {entries.length > 0 && (
                  <details className="group text-xs">
                    <summary className="cursor-pointer select-none text-indigo-600">Structured payload</summary>
                    <table className="mt-2 w-full font-mono">
                      <tbody>
                        {entries.map(([k, v]) => (
                          <tr key={k} className="border-t border-slate-100 align-top">
                            <td className="py-1 pr-3 text-slate-500">{k}</td>
                            <td className="break-all py-1 text-slate-900">{fmt(v)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}
                <time className="block text-[11px] text-slate-400" dateTime={m.createdAt}>
                  {new Date(m.createdAt).toLocaleString()}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
