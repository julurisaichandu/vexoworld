import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-normal leading-tight tracking-[-0.025em] text-foreground md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
