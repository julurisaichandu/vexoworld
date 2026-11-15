import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/session";
import { getViewer } from "@/lib/queries";
import { Logo } from "@/components/shell/logo";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const uid = await requireUserId();
  const { user, agent } = await getViewer(uid);
  if (agent) redirect("/");
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-5xl px-5 py-8 md:py-12">
        <div className="flex items-center justify-between">
          <Logo />
          <p className="ac-eyebrow">01 / 03</p>
        </div>
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-cream-2">
          <div className="h-full w-1/3 rounded-full bg-lime" />
        </div>
        <p className="ac-eyebrow mt-10">[ Onboarding ]</p>
        <h1 className="mt-3 font-heading text-4xl leading-[1.05] tracking-[-0.025em] text-foreground md:text-6xl">Create your agent</h1>
        <p className="mt-3 max-w-xl text-lg leading-relaxed text-muted-foreground">
          It speaks in your voice, shares only what you allow, and asks you before anything sensitive.
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-[1fr_300px] md:items-start">
          <OnboardingForm defaults={{ agentName: `${user.name.split(" ")[0]}'s agent`, city: user.city ?? "", area: user.area ?? "" }} />
          <aside className="ac-panel-dark space-y-4 p-6 md:sticky md:top-8">
            <p className="ac-eyebrow text-lime">[ Your agent will ]</p>
            <ul className="space-y-3 text-sm leading-relaxed text-cream/85">
              <li>Speak in your voice, never as someone else.</li>
              <li>Share only the fields you switch on, at a coarse area level.</li>
              <li>Ask you before anything sensitive goes out.</li>
              <li>Label every AI line as live or simulated.</li>
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
