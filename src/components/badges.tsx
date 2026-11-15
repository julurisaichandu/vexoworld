import type { Provenance, Source } from "@/lib/types";

const PROVENANCE: Record<Provenance, { label: string; cls: string }> = {
  human_verified: { label: "Verified by human", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  ai_generated: { label: "AI-generated", cls: "bg-indigo-50 text-indigo-800 ring-indigo-200" },
  profile: { label: "From profile", cls: "bg-slate-100 text-slate-700 ring-slate-200" },
  simulated: { label: "Simulated", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
};

const chip = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap";

export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const p = PROVENANCE[provenance];
  return <span className={`${chip} ${p.cls}`}>{p.label}</span>;
}

export function SourceBadge({ source }: { source: Source }) {
  const live = source === "live";
  return (
    <span className={`${chip} ${live ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}>
      <span className={`size-1.5 rounded-full ${live ? "bg-emerald-500" : "bg-amber-500"}`} />
      {live ? "Live" : "Simulated"}
    </span>
  );
}
