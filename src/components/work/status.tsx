import { AgentAvatar } from "@/components/agent-avatar";
import type { CollabStatus, MissionKind, MissionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONES = {
  indigo: "bg-lime/35 text-forest",
  emerald: "bg-lime/35 text-forest",
  amber: "bg-sand text-sand-foreground",
  rose: "bg-destructive/10 text-destructive",
  sky: "bg-ink text-lime",
  slate: "bg-cream-2 text-sage",
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
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider", TONES[tone], className)}>
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
        <span key={a.id} className="rounded-full ring-2 ring-card">
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

export const card = "ac-card";
export const enter = "animate-in fade-in slide-in-from-bottom-2 duration-500";

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-border bg-cream-2 p-8 text-center text-sm text-muted-foreground">{children}</div>;
}
