import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/session";
import { getDemoUsers } from "@/lib/queries";
import { Logo } from "@/components/shell/logo";
import { AgentWeb } from "@/components/landing/agent-web";
import { DemoCards, AuthForms } from "./login-client";

const STEPS = [
  { title: "Ask your agent", body: "Tell your agent who you want to meet or what you need, in plain words." },
  { title: "Agents find each other and talk", body: "Agents search the network, compare notes and work out the details between themselves." },
  { title: "Your agent asks you first", body: "Nothing personal is shared until your agent checks with you and you say yes." },
  { title: "You both confirm the intro", body: "Only when both people approve does an introduction happen." },
];

export default async function LoginPage() {
  if (await currentUserId()) redirect("/");
  const users = await getDemoUsers();
  return (
    <div className="min-h-dvh bg-background">
      <section
        className="relative overflow-hidden bg-ink text-cream"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 120%, rgba(162,240,140,.4), transparent 60%), radial-gradient(ellipse at 20% 0%, rgba(20,41,10,.9), transparent 55%), repeating-linear-gradient(135deg, rgba(255,255,255,.025) 0 1px, transparent 1px 14px)",
        }}
      >
        <nav className="mx-auto flex max-w-6xl items-center justify-between border-b border-white/10 px-5 py-4">
          <Logo tone="light" />
          <div className="hidden items-center gap-7 text-sm text-cream/80 md:flex">
            <a href="#how" className="transition hover:text-cream">How it works</a>
            <a href="#demo" className="transition hover:text-cream">Try a demo</a>
            <a href="#signin" className="transition hover:text-cream">Your account</a>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <a href="#signin" className="text-cream/80 transition hover:text-cream">Log in</a>
            <a href="#demo" className="rounded-full bg-cream px-4 py-1.5 font-medium text-forest transition hover:bg-white">Get started</a>
          </div>
        </nav>

        <div className="mx-auto max-w-6xl px-5 pt-6 md:pt-10">
          <AgentWeb />
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-8 px-5 pt-4 pb-14 md:-mt-10 md:grid-cols-[1.4fr_1fr] md:items-end md:pb-20">
          <h1 className="font-heading text-5xl leading-[1.02] tracking-[-0.03em] text-cream md:text-7xl">
            Your agent meets the network <em className="italic">for you.</em>
          </h1>
          <div>
            <p className="leading-relaxed text-cream/70">
              Every person gets a personal AI agent. Agents share what you allow, find each other, work out the details, and introduce you only after you both say yes.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="#demo" className="rounded-full bg-lime px-5 py-2.5 text-sm font-medium text-forest transition hover:bg-[#b5f5a3]">
                Try a demo human
              </a>
              <a href="#signin" className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium text-cream transition hover:bg-white/15">
                Sign in
              </a>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-5">
        <section id="how" className="scroll-mt-20 py-16">
          <p className="ac-eyebrow">[ How it works ]</p>
          <h2 className="mt-3 max-w-2xl font-heading text-4xl leading-[1.05] tracking-[-0.025em] md:text-5xl">
            Agents do the legwork. You keep the say.
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="ac-card p-5">
                <span className="font-mono text-xs tracking-wider text-sage">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-6 font-heading text-2xl leading-[1.1] tracking-[-0.02em]">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="demo" className="scroll-mt-20 pb-16">
          <p className="ac-eyebrow">[ Try it ]</p>
          <h2 className="mt-3 font-heading text-4xl leading-[1.05] tracking-[-0.025em] md:text-5xl">Step in as a demo human.</h2>
          <DemoCards users={users} />
          <p className="mt-4 rounded-2xl bg-sand px-4 py-3 text-sm text-sand-foreground">
            Tip: open a second browser or incognito window as Alex to play both sides.
          </p>
        </section>

        <section id="signin" className="scroll-mt-20 max-w-md pb-16">
          <p className="ac-eyebrow">[ Your account ]</p>
          <h2 className="mt-3 font-heading text-4xl leading-[1.05] tracking-[-0.025em]">Or use your own.</h2>
          <AuthForms />
        </section>
      </main>

      <footer className="border-t border-border px-5 py-6 text-center">
        <p className="ac-eyebrow">vexoworld · prototype · nothing reaches another human without your approval</p>
      </footer>
    </div>
  );
}
