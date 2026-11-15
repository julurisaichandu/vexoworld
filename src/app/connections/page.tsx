import { Handshake } from "lucide-react";
import { LiveRefresh } from "@/components/live-refresh";
import { PageHeader } from "@/components/page-header";
import { AgentAvatar } from "@/components/agent-avatar";
import { ConnectButton } from "@/components/work/connect-button";
import { CopyButton } from "@/components/work/copy-button";
import { Empty, enter } from "@/components/work/status";
import { getConnections, getConversation, getDashboard, getViewer } from "@/lib/queries";
import { requireUserId } from "@/lib/session";

export default async function ConnectionsPage() {
  const uid = await requireUserId();
  const [conns, dash, viewer] = await Promise.all([getConnections(uid), getDashboard(uid), getViewer(uid)]);
  const mutual = conns.filter((c) => c.connection.status === "mutual");
  const pending = conns.filter((c) => c.connection.status === "pending");
  const declined = conns.filter((c) => c.connection.status === "declined");
  const agreed = new Map(
    await Promise.all(
      mutual.map(async (c) => {
        const cid = c.connection.collaborationId;
        const conv = cid ? await getConversation(uid, cid) : null;
        return [c.connection.id, conv?.collab.agreed] as const;
      }),
    ),
  );

  return (
    <div className="space-y-8">
      <LiveRefresh />
      <p className="ac-eyebrow">[ Connections ]</p>
      <PageHeader title="Connections" subtitle="People you and your agent met, only after both said yes." />

      <section className="space-y-3">
        <h2 className="ac-eyebrow">[ Connected <span className="text-muted-foreground">{mutual.length}</span> ]</h2>
        {mutual.length === 0 && <Empty>No mutual connections yet.</Empty>}
        {mutual.map(({ connection, other, otherName, contact }) => {
          const details = agreed.get(connection.id);
          return (
            <div key={connection.id} className={`ac-card ${enter} space-y-4 p-6`}>
              <div className="flex items-center gap-3">
                {viewer.agent && <AgentAvatar agent={viewer.agent} size="md" />}
                <span className="h-0.5 w-6 rounded-full bg-lime" />
                <AgentAvatar agent={other} size="md" />
                <div className="min-w-0">
                  <p className="font-heading text-xl tracking-[-0.025em] text-foreground">{otherName ?? other.ownerLabel}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">met via {other.name}</p>
                </div>
              </div>
              {details && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(details).map(([k, v]) => (
                    <span key={k} className="rounded-full bg-lime/35 px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-forest">{k}: {v}</span>
                  ))}
                </div>
              )}
              {contact && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-cream-2 p-3 text-sm">
                  <span>
                    <span className="text-muted-foreground">Contact </span>
                    <span className="font-mono text-foreground">{contact}</span>
                  </span>
                  <CopyButton text={contact} />
                </div>
              )}
            </div>
          );
        })}
      </section>

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="ac-eyebrow">[ Waiting for the other human <span className="text-muted-foreground">{pending.length}</span> ]</h2>
          {pending.map(({ connection, other }) => (
            <div key={connection.id} className={`ac-card flex items-center gap-3 p-4`}>
              <AgentAvatar agent={other} size="sm" />
              <span className="flex-1 text-sm text-foreground/75">{other.ownerLabel} has not answered yet</span>
              <span className="rounded-full bg-sand px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-sand-foreground">Pending</span>
            </div>
          ))}
        </section>
      )}

      {declined.length > 0 && (
        <section className="space-y-3">
          <h2 className="ac-eyebrow">[ Declined <span className="text-muted-foreground">{declined.length}</span> ]</h2>
          {declined.map(({ connection, other }) => (
            <div key={connection.id} className={`ac-card flex items-center gap-3 p-4 opacity-70`}>
              <AgentAvatar agent={other} size="sm" />
              <span className="flex-1 text-sm text-muted-foreground">{other.ownerLabel}</span>
              <span className="rounded-full bg-cream-2 px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-sage">Declined</span>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="ac-eyebrow flex items-center gap-2">
          <Handshake className="size-4 text-forest" /> [ People your agent recommends ]
        </h2>
        {dash.recommended.length === 0 && <Empty>No recommendations yet.</Empty>}
        <div className="grid gap-3 md:grid-cols-2">
          {dash.recommended.map((a) => (
            <div key={a.id} className={`ac-card ${enter} space-y-3 p-4`}>
              <div className="flex items-center gap-3">
                <AgentAvatar agent={a} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.interests.slice(0, 3).join(", ")}</p>
                </div>
              </div>
              <ConnectButton goal={`Connect me with ${a.ownerLabel} (${a.name})`} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
