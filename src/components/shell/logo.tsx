/** `tone="light"` for dark backgrounds (landing hero). */
export function Logo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const ink = tone === "light" ? "#fcfaee" : "#0e1711";
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 28 28" width="26" height="26" aria-hidden>
        <path d="M14 3 25 14 14 25 3 14Z" fill="none" stroke={ink} strokeOpacity=".3" strokeWidth="1.2" />
        <path d="M14 3v22M3 14h22" stroke={ink} strokeWidth="1.6" />
        <circle cx="14" cy="3" r="2.3" fill={ink} />
        <circle cx="25" cy="14" r="2.3" fill={ink} />
        <circle cx="14" cy="25" r="2.3" fill={ink} />
        <circle cx="3" cy="14" r="2.3" fill={ink} />
        <circle cx="14" cy="14" r="4" fill="#a2f08c" stroke={ink} strokeWidth="1.6" />
      </svg>
      <span className={`font-sans text-[21px] font-medium tracking-[-0.045em] ${tone === "light" ? "text-cream" : "text-ink"}`}>
        vexoworld
      </span>
    </span>
  );
}
