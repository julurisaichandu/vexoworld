import { Handshake } from "lucide-react";
import { AgentAvatar } from "@/components/agent-avatar";
import { ConnectButton } from "@/components/work/connect-button";
import { CopyButton } from "@/components/work/copy-button";
import { PlayCard, PLAY_GRID } from "@/components/play-card";
import { timeAgo } from "@/components/work/status";
import { getConnections, getConversation, getDashboard, getViewer } from "@/lib/queries";

export async function ConnectionsTab({ uid }: { uid: string }) {
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

  const empty = (t: string) => (
    <p className="rounded-2xl border border-dashed border-ink/15 px-3 py-2 text-xs text-muted-foreground">{t}</p>
  );

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h2 className="ac-eyebrow">[ Connected <span className="text-muted-foreground">{mutual.length}</span> ]</h2>
        {mutual.length === 0 && empty("No mutual connections yet.")}
        <div className={PLAY_GRID}>
          {mutual.map(({ connection, other, otherName, contact }) => {
            const details = agreed.get(connection.id);
            const name = otherName ?? other.ownerLabel;
            const plan = details ? Object.values(details).slice(0, 2).join(" · ") : "";
            return (
              <PlayCard
                key={connection.id}
                tone="lime"
                label={`Connected with ${name}`}
                eyebrow="Connected"
                corner={timeAgo(connection.createdAt)}
                title={name}
                footer={
                  <span className="flex flex-col gap-1.5">
                    <span className="flex items-center gap-1">
                      {viewer.agent && <AgentAvatar agent={viewer.agent} size="xs" />}
                      <span className="h-0.5 w-3 rounded-full bg-forest/40" />
                      <AgentAvatar agent={other} size="xs" />
                    </span>
                    {plan && <span className="truncate text-forest/70">{plan}</span>}
                  </span>
                }
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    {viewer.agent && <AgentAvatar agent={viewer.agent} size="md" />}
                    <span className="h-0.5 w-6 rounded-full bg-lime" />
                    <AgentAvatar agent={other} size="md" />
                    <div className="min-w-0">
                      <p className="font-heading text-xl tracking-[-0.025em] text-foreground">{name}</p>
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
              </PlayCard>
            );
          })}
        </div>
      </section>

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="ac-eyebrow">[ Waiting for the other human <span className="text-muted-foreground">{pending.length}</span> ]</h2>
          <div className={PLAY_GRID}>
            {pending.map(({ connection, other }) => (
              <PlayCard
                key={connection.id}
                tone="sand"
                label={`${other.ownerLabel} has not answered yet`}
                eyebrow="Pending"
                corner={timeAgo(connection.createdAt)}
                title={`${other.ownerLabel} has not answered yet`}
                footer={<span className="flex items-center gap-1.5"><AgentAvatar agent={other} size="xs" /><span className="truncate">{other.name}</span></span>}
              >
                <div className="flex items-center gap-3">
                  <AgentAvatar agent={other} size="sm" />
                  <span className="flex-1 text-sm text-foreground/75">{other.ownerLabel} has not answered yet</span>
                  <span className="rounded-full bg-sand px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-sand-foreground">Pending</span>
                </div>
              </PlayCard>
            ))}
          </div>
        </section>
      )}

      {declined.length > 0 && (
        <section className="space-y-3">
          <h2 className="ac-eyebrow">[ Declined <span className="text-muted-foreground">{declined.length}</span> ]</h2>
          <div className={PLAY_GRID}>
            {declined.map(({ connection, other }) => (
              <PlayCard
                key={connection.id}
                tone="paper"
                label={`Declined: ${other.ownerLabel}`}
                eyebrow="Declined"
                corner={timeAgo(connection.createdAt)}
                title={<span className="text-muted-foreground">{other.ownerLabel}</span>}
                footer={<span className="flex items-center gap-1.5 text-muted-foreground"><AgentAvatar agent={other} size="xs" /><span className="truncate">{other.name}</span></span>}
              >
                <div className="flex items-center gap-3 opacity-70">
                  <AgentAvatar agent={other} size="sm" />
                  <span className="flex-1 text-sm text-muted-foreground">{other.ownerLabel}</span>
                  <span className="rounded-full bg-cream-2 px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-sage">Declined</span>
                </div>
              </PlayCard>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="ac-eyebrow flex items-center gap-2">
          <Handshake className="size-4 text-forest" /> [ People your agent recommends ]
        </h2>
        {dash.recommended.length === 0 && empty("No recommendations yet.")}
        <div className={PLAY_GRID}>
          {dash.recommended.map((a) => (
            <PlayCard
              key={a.id}
              tone="paper"
              label={`Recommended: ${a.name}`}
              eyebrow="Suggested"
              title={a.interests.slice(0, 3).join(", ") || a.name}
              footer={<span className="flex items-center gap-1.5"><AgentAvatar agent={a} size="xs" /><span className="truncate">{a.name}</span></span>}
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <AgentAvatar agent={a} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.interests.slice(0, 3).join(", ")}</p>
                  </div>
                </div>
                <ConnectButton goal={`Connect me with ${a.ownerLabel} (${a.name})`} />
              </div>
            </PlayCard>
          ))}
        </div>
      </section>
    </div>
  );
}
