import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="min-w-0">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-slate-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
