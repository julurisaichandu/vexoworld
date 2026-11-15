import { AgentAvatar } from "@/components/agent-avatar";
import type { CollabStatus, MissionKind, MissionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONES = {
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
};
export type Tone = keyof typeof TONES;

const MISSION: Record<MissionStatus, [string, Tone]> = {
  planning: ["Planning", "sky"],
  discovering: ["Discovering", "sky"],
  collaborating: ["Collaborating", "indigo"],
  awaiting_human: ["Awaiting you", "amber"],
  completed: ["Completed", "emerald"],
  failed: ["Failed", "rose"],
  cancelled: ["Cancelled", "slate"],
};
const COLLAB: Record<CollabStatus, [string, Tone]> = {
  requested: ["Requested", "sky"],
  awaiting_human: ["Asking their human", "amber"],
  negotiating: ["Negotiating", "indigo"],
  awaiting_intro: ["Awaiting intro approval", "amber"],
  introduced: ["Introduced", "emerald"],
  answered: ["Answered", "emerald"],
  declined: ["Declined", "rose"],
  expired: ["Expired", "slate"],
  failed: ["Failed", "rose"],
};

export function Pill({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", TONES[tone], className)}>
      {children}
    </span>
  );
}

export const MissionStatusPill = ({ status }: { status: MissionStatus }) => <Pill tone={MISSION[status][1]}>{MISSION[status][0]}</Pill>;
export const CollabStatusPill = ({ status }: { status: CollabStatus }) => <Pill tone={COLLAB[status][1]}>{COLLAB[status][0]}</Pill>;

const KIND: Record<MissionKind, [string, Tone]> = { match: ["Match", "indigo"], observation: ["Observation", "sky"], discovery: ["Discovery", "amber"] };
export const KindChip = ({ kind }: { kind: MissionKind }) => <Pill tone={KIND[kind][1]}>{KIND[kind][0]}</Pill>;

type Av = { id: string; name: string; color: string; avatarSeed: string };
export function AvatarStack({ agents, size = "sm" }: { agents: Av[]; size?: "xs" | "sm" | "md" }) {
  return (
    <div className="flex -space-x-2">
      {agents.map((a) => (
        <span key={a.id} className="rounded-full ring-2 ring-white">
          <AgentAvatar agent={a} size={size} />
        </span>
      ))}
    </div>
  );
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const card = "rounded-2xl border border-slate-200 bg-white shadow-sm";
export const enter = "animate-in fade-in slide-in-from-bottom-2 duration-500";

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">{children}</div>;
}
