const SIZES = { xs: 24, sm: 32, md: 44, lg: 80 } as const;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function AgentAvatar({
  agent,
  size = "md",
  className,
}: {
  agent: { name: string; color: string; avatarSeed: string };
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const h = hash(agent.avatarSeed);
  const px = SIZES[size];
  const id = `orb-${h}`;
  const angle = h % 360;
  const eyeY = 52 + (h % 5);
  const gap = 13 + ((h >> 3) % 5);
  const ring = (h >> 6) % 180;
  const blink = (h >> 9) % 2 === 0 ? 4.2 : 3.6;
  return (
    <svg
      viewBox="0 0 100 100"
      width={px}
      height={px}
      role="img"
      aria-label={agent.name}
      className={`shrink-0 ${className ?? ""}`}
    >
      <defs>
        <linearGradient id={id} gradientTransform={`rotate(${angle} .5 .5)`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="0.45" stopColor={agent.color} />
          <stop offset="1" stopColor={agent.color} stopOpacity="0.72" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="40" fill={`url(#${id})`} />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#0f172a" strokeOpacity="0.08" strokeWidth="1.5" />
      <ellipse
        cx="50"
        cy="50"
        rx="47"
        ry="15"
        fill="none"
        stroke={agent.color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="70 200"
        transform={`rotate(${ring} 50 50)`}
      />
      <circle cx={50 - gap} cy={eyeY} r={blink} fill="#0f172a" />
      <circle cx={50 + gap} cy={eyeY} r={blink} fill="#0f172a" />
      <path d={`M ${50 - 7} ${eyeY + 14} Q 50 ${eyeY + 19} ${50 + 7} ${eyeY + 14}`} fill="none" stroke="#0f172a" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
