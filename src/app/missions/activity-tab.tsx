import { Bell, CheckCircle2, Compass, MessageSquare, Network, Users, type LucideIcon } from "lucide-react";
import { ActivityControls } from "@/components/work/activity-controls";
import { NetworkPulse } from "@/components/work/network-pulse";
import { Empty, enter, timeAgo } from "@/components/work/status";
import type { getActivity, getConversations, getDashboard, getViewer } from "@/lib/queries";

const TILES: { key: "contacted" | "discoveries" | "conversations" | "pending" | "recommended" | "completed"; label: string; Icon: LucideIcon; tone: string }[] = [
  { key: "contacted", label: "Agents contacted", Icon: Network, tone: "bg-white/10 text-lime" },
  { key: "discoveries", label: "Discoveries", Icon: Compass, tone: "bg-cream-2 text-ink" },
  { key: "conversations", label: "Agent conversations", Icon: MessageSquare, tone: "bg-lime/30 text-forest" },
  { key: "pending", label: "Pending questions", Icon: Bell, tone: "bg-sand text-sand-foreground" },
  { key: "recommended", label: "Recommended people", Icon: Users, tone: "bg-lime/30 text-forest" },
  { key: "completed", label: "Completed missions", Icon: CheckCircle2, tone: "bg-lime/30 text-forest" },
];

const dotFor = (type: string, notify: boolean) => (notify ? "bg-sand-foreground" : /error|fail|reject|declin/.test(type) ? "bg-destructive" : "bg-lime");

export function ActivityTab({
  dash,
  activity,
  convos,
  viewer,
}: {
  dash: Awaited<ReturnType<typeof getDashboard>>;
  activity: Awaited<ReturnType<typeof getActivity>>;
  convos: Awaited<ReturnType<typeof getConversations>>;
  viewer: Awaited<ReturnType<typeof getViewer>>;
}) {
  const live = new Set(["requested", "awaiting_human", "negotiating", "awaiting_intro"]);
  const others = [...new Map(convos.map((c) => [c.other.id, c.other])).values()];
  const active = new Set(convos.filter((c) => live.has(c.collab.status)).map((c) => c.other.id));

  return (
    <div className="space-y-6">
      <ActivityControls paused={viewer.agent?.paused ?? false} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {TILES.map(({ key, label, Icon, tone }, i) => {
          const dark = i === 0;
          return (
            <div key={key} className={`${dark ? "ac-panel-dark" : "ac-card"} ${enter} p-4`}>
              <span className={`mb-3 flex size-9 items-center justify-center rounded-full ${tone}`}>
                <Icon className="size-4" />
              </span>
              <p className={`font-heading text-3xl tracking-[-0.025em] ${dark ? "text-lime" : "text-foreground"}`}>{dash.stats[key]}</p>
              <p className={`ac-eyebrow mt-1 ${dark ? "text-cream/70" : "text-muted-foreground"}`}>{label}</p>
            </div>
          );
        })}
      </div>

      {viewer.agent && (
        <section className="ac-card space-y-2 p-5">
          <h2 className="font-heading text-2xl tracking-[-0.025em]">Network pulse</h2>
          <NetworkPulse
            me={{ ...viewer.agent, ownerLabel: "You", interests: [] }}
            others={others}
            active={active}
          />
        </section>
      )}

      <section className="space-y-3">
        <p className="ac-eyebrow">[ Timeline ]</p>
        <h2 className="font-heading text-2xl tracking-[-0.025em]">Timeline</h2>
        {activity.length === 0 && <Empty>Nothing yet. Start a mission.</Empty>}
        <ol className="relative ml-24 space-y-5 border-l border-border pl-6">
          {activity.map((a) => (
            <li key={a.id} className="relative">
              <span className={`absolute -left-[29px] top-1.5 size-2.5 rounded-full ring-4 ring-background ${dotFor(a.type, !!a.notify)}`} />
              <time className="absolute -left-[7.5rem] top-0.5 w-20 text-right font-mono text-[11px] text-muted-foreground" dateTime={a.createdAt}>
                {timeAgo(a.createdAt)}
              </time>
              <p className={`text-sm ${a.notify ? "rounded-xl bg-sand px-3 py-2 text-sand-foreground" : "text-foreground"}`}>{a.text}</p>
              <p className="mt-1 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">{a.type}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
