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
    <div className="min-h-dvh bg-white">
      <div className="mx-auto max-w-2xl px-5 py-8 md:py-12">
        <Logo />
        <h1 className="mt-10 font-heading text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">Create your agent</h1>
        <p className="mt-3 text-lg leading-relaxed text-slate-600">
          It speaks in your voice, shares only what you allow, and asks you before anything sensitive.
        </p>
        <OnboardingForm defaults={{ agentName: `${user.name.split(" ")[0]}'s agent`, city: user.city ?? "", area: user.area ?? "" }} />
      </div>
    </div>
  );
}
