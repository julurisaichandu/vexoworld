import { Activity as ActivityIcon, Bell, CheckCircle2, Compass, MessageSquare, Network, Sparkles, UserPlus, Users, type LucideIcon } from "lucide-react";
import { LiveRefresh } from "@/components/live-refresh";
import { PageHeader } from "@/components/page-header";
import { ActivityControls } from "@/components/work/activity-controls";
import { NetworkPulse } from "@/components/work/network-pulse";
import { Empty, card, enter, timeAgo } from "@/components/work/status";
import { getActivity, getConversations, getDashboard, getViewer } from "@/lib/queries";
import { requireUserId } from "@/lib/session";

const TILES: { key: "contacted" | "discoveries" | "conversations" | "pending" | "recommended" | "completed"; label: string; Icon: LucideIcon; tone: string }[] = [
  { key: "contacted", label: "Agents contacted", Icon: Network, tone: "bg-indigo-50 text-indigo-600" },
  { key: "discoveries", label: "Discoveries", Icon: Compass, tone: "bg-sky-50 text-sky-600" },
  { key: "conversations", label: "Agent conversations", Icon: MessageSquare, tone: "bg-emerald-50 text-emerald-600" },
  { key: "pending", label: "Pending questions", Icon: Bell, tone: "bg-amber-50 text-amber-600" },
  { key: "recommended", label: "Recommended people", Icon: Users, tone: "bg-rose-50 text-rose-500" },
  { key: "completed", label: "Completed missions", Icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600" },
];

const iconFor = (type: string): LucideIcon =>
  type.startsWith("mission") ? Sparkles : type.startsWith("agent") ? Network : type.startsWith("human") ? Bell : type.startsWith("connection") ? UserPlus : type.startsWith("collab") ? MessageSquare : ActivityIcon;

export default async function ActivityPage() {
  const uid = await requireUserId();
  const [dash, activity, convos, viewer] = await Promise.all([getDashboard(uid), getActivity(uid, 50), getConversations(uid), getViewer(uid)]);
  const live = new Set(["requested", "awaiting_human", "negotiating", "awaiting_intro"]);
  const others = [...new Map(convos.map((c) => [c.other.id, c.other])).values()];
  const active = new Set(convos.filter((c) => live.has(c.collab.status)).map((c) => c.other.id));

  return (
    <div className="space-y-6">
      <LiveRefresh />
      <PageHeader title="Activity" subtitle="Watch your agent explore a living network." />
      <ActivityControls paused={viewer.agent?.paused ?? false} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {TILES.map(({ key, label, Icon, tone }) => (
          <div key={key} className={`${card} ${enter} p-4`}>
            <span className={`mb-2 flex size-9 items-center justify-center rounded-xl ${tone}`}>
              <Icon className="size-5" />
            </span>
            <p className="font-heading text-3xl text-slate-900">{dash.stats[key]}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {viewer.agent && (
        <section className={`${card} space-y-2 bg-indigo-50/40 p-5`}>
          <h2 className="font-heading text-lg">Network pulse</h2>
          <NetworkPulse
            me={{ ...viewer.agent, ownerLabel: "You", interests: [] }}
            others={others}
            active={active}
          />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-heading text-lg">Timeline</h2>
        {activity.length === 0 && <Empty>Nothing yet. Start a mission.</Empty>}
        <ol className="space-y-2">
          {activity.map((a) => {
            const Icon = iconFor(a.type);
            return (
              <li key={a.id} className={`${card} flex items-start gap-3 p-3 ${a.notify ? "border-amber-300 bg-amber-50" : ""}`}>
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${a.notify ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-900">{a.text}</p>
                  <p className="font-mono text-[11px] text-slate-400">
                    {a.type} · {timeAgo(a.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
