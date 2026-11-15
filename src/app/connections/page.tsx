import { Handshake } from "lucide-react";
import { LiveRefresh } from "@/components/live-refresh";
import { PageHeader } from "@/components/page-header";
import { AgentAvatar } from "@/components/agent-avatar";
import { ConnectButton } from "@/components/work/connect-button";
import { CopyButton } from "@/components/work/copy-button";
import { AvatarStack, Empty, Pill, card, enter } from "@/components/work/status";
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
      <PageHeader title="Connections" subtitle="People you and your agent met, only after both said yes." />

      <section className="space-y-3">
        <h2 className="font-heading text-lg">Connected</h2>
        {mutual.length === 0 && <Empty>No mutual connections yet.</Empty>}
        {mutual.map(({ connection, other, otherName, contact }) => {
          const details = agreed.get(connection.id);
          return (
            <div key={connection.id} className={`${card} ${enter} space-y-3 border-emerald-200 bg-emerald-50/50 p-5`}>
              <div className="flex items-center gap-3">
                <AvatarStack agents={[...(viewer.agent ? [viewer.agent] : []), other]} size="md" />
                <p className="font-heading text-lg text-slate-900">You and {otherName ?? other.ownerLabel} agreed to meet</p>
              </div>
              {details && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(details).map(([k, v]) => (
                    <Pill key={k} tone="emerald">{k}: {v}</Pill>
                  ))}
                </div>
              )}
              {contact && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm">
                  <span>
                    <span className="text-slate-500">Contact </span>
                    <span className="font-medium text-slate-900">{contact}</span>
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
          <h2 className="font-heading text-lg">Waiting for the other human</h2>
          {pending.map(({ connection, other }) => (
            <div key={connection.id} className={`${card} flex items-center gap-3 p-4`}>
              <AgentAvatar agent={other} size="sm" />
              <span className="flex-1 text-sm text-slate-700">{other.ownerLabel} has not answered yet</span>
              <Pill tone="amber">Pending</Pill>
            </div>
          ))}
        </section>
      )}

      {declined.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-heading text-lg">Declined</h2>
          {declined.map(({ connection, other }) => (
            <div key={connection.id} className={`${card} flex items-center gap-3 p-4 opacity-70`}>
              <AgentAvatar agent={other} size="sm" />
              <span className="flex-1 text-sm text-slate-600">{other.ownerLabel}</span>
              <Pill tone="slate">Declined</Pill>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-heading text-lg">
          <Handshake className="size-5 text-indigo-600" /> People your agent recommends
        </h2>
        {dash.recommended.length === 0 && <Empty>No recommendations yet.</Empty>}
        <div className="grid gap-3 md:grid-cols-2">
          {dash.recommended.map((a) => (
            <div key={a.id} className={`${card} ${enter} space-y-3 p-4`}>
              <div className="flex items-center gap-3">
                <AgentAvatar agent={a} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{a.name}</p>
                  <p className="truncate text-xs text-slate-500">{a.interests.slice(0, 3).join(", ")}</p>
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
