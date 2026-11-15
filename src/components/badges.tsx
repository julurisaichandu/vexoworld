import type { Provenance, Source } from "@/lib/types";

const PROVENANCE: Record<Provenance, { label: string; cls: string }> = {
  human_verified: { label: "Verified by human", cls: "bg-lime/35 text-forest" },
  ai_generated: { label: "AI-generated", cls: "bg-ink text-lime" },
  profile: { label: "From profile", cls: "bg-cream-2 text-sage" },
  simulated: { label: "Simulated", cls: "bg-sand text-sand-foreground" },
};

const chip = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider whitespace-nowrap";

export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const p = PROVENANCE[provenance];
  return <span className={`${chip} ${p.cls}`}>{p.label}</span>;
}

export function SourceBadge({ source }: { source: Source }) {
  const live = source === "live";
  return (
    <span className={`${chip} ${live ? "bg-lime/35 text-forest" : "bg-sand text-sand-foreground"}`}>
      <span className={`size-1.5 rounded-full ${live ? "bg-forest" : "bg-sand-foreground"}`} />
      {live ? "Live" : "Simulated"}
    </span>
  );
}
