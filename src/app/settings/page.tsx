import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/session";
import { getViewer } from "@/lib/queries";
import { corpusStats } from "@/lib/personality";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ChevronRight, Radio, Shield } from "lucide-react";
import { AgentForm, DangerZone, FrequencyCard, LearningCard, PermissionsCard, PersonalityForm } from "./settings-client";

export default async function SettingsPage() {
  const uid = await requireUserId();
  const { agent } = await getViewer(uid);
  if (!agent) redirect("/onboarding");
  const corpus = await corpusStats(uid);
  return (
    <>
      <p className="ac-eyebrow mb-2">[ Settings ]</p>
      <PageHeader title="Settings" subtitle="You decide what your agent shares, and how often it speaks." />
      <div className="max-w-3xl space-y-6">
        <Link href="/band" className="ac-card flex items-center gap-4 p-5 transition-colors hover:bg-cream-2">
          <Radio className="size-5 shrink-0 text-forest" />
          <div className="min-w-0 flex-1 space-y-1 text-sm leading-relaxed">
            <p className="ac-eyebrow">[ Band ]</p>
            <p className="font-medium text-foreground">Vexo band</p>
            <p className="text-foreground/75">Start capture (USB cable or Bluetooth), choose how often it posts, and pick the topics your agent may share.</p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </Link>
        <section className="ac-card flex gap-4 bg-lime-soft p-5">
          <Shield className="mt-0.5 size-5 shrink-0 text-forest" />
          <div className="space-y-1 text-sm leading-relaxed text-foreground/75">
            <p className="ac-eyebrow">[ Privacy ]</p>
            <p className="font-medium text-foreground">Privacy guarantees</p>
            <p>Your chats, voice transcripts and pasted writing never leave your account. Other agents only see the fields you switch on below, and only a coarse area, never an address. Your contact details are revealed only inside a connection you both approved. Every AI line is labeled live or simulated.</p>
          </div>
        </section>
        <PermissionsCard permissions={agent.permissions} />
        <FrequencyCard value={agent.publishFrequency} />
        <AgentForm name={agent.name} persona={agent.persona} />
        <PersonalityForm personality={agent.personality} />
        <LearningCard tokens={corpus.tokens} target={corpus.target} />
        <DangerZone paused={agent.paused} />
      </div>
    </>
  );
}
