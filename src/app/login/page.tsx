import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/session";
import { getDemoUsers } from "@/lib/queries";
import { Logo } from "@/components/shell/logo";
import { DemoCards, AuthForms } from "./login-client";

export default async function LoginPage() {
  if (await currentUserId()) redirect("/");
  const users = await getDemoUsers();
  return (
    <div className="min-h-dvh bg-white">
      <div className="mx-auto max-w-5xl px-5 py-8 md:py-12">
        <Logo />
        <section className="mt-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <h1 className="max-w-3xl font-heading text-4xl leading-[1.1] font-semibold tracking-tight text-slate-900 md:text-6xl">
            Your agent meets the network <span className="text-indigo-600">for you</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
            Every person gets a personal AI agent. Agents share what you allow, find each other, work out the details, and introduce you only after you both say yes.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">Try it as a demo human</h2>
          <DemoCards users={users} />
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Tip: open a second browser or incognito window as Alex to play both sides.
          </p>
        </section>

        <section className="mt-12 max-w-md pb-10">
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">Or use your own account</h2>
          <AuthForms />
        </section>
      </div>
    </div>
  );
}
