export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden>
        <circle cx="16" cy="16" r="9" fill="#4f46e5" />
        <ellipse cx="16" cy="16" rx="14" ry="5.5" fill="none" stroke="#f43f5e" strokeWidth="2.2" transform="rotate(-25 16 16)" />
        <circle cx="27.2" cy="9.4" r="2.4" fill="#10b981" />
        <circle cx="13" cy="14" r="1.4" fill="#fff" />
        <circle cx="19" cy="14" r="1.4" fill="#fff" />
      </svg>
      <span className="font-heading text-xl font-semibold tracking-tight text-slate-900">Agent Connect</span>
    </span>
  );
}
