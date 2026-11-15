// Original vector illustration drawn for this project in code. It is AI-assisted artwork and is labelled as such.
// It intentionally uses no agency logos, flags, patches or insignia.
export function AstronautArt({ className = "" }: { className?: string }) {
  return (
    <figure className={className}>
      <svg viewBox="0 0 360 300" role="img" aria-label="Illustration of an astronaut floating above a blue planet, looking back at a small distant Earth" className="h-auto w-full">
        <defs>
          <radialGradient id="planet" cx="50%" cy="0%" r="90%">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="60%" stopColor="#0b1d5c" />
            <stop offset="100%" stopColor="#060b1f" />
          </radialGradient>
          <radialGradient id="visor" cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </radialGradient>
        </defs>
        <rect width="360" height="300" fill="#060b1f" rx="16" />
        {[[30, 40], [80, 90], [150, 30], [240, 60], [310, 30], [330, 110], [60, 200], [20, 140], [280, 150]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.8 : 1.1} fill="#fff" opacity="0.7" />
        ))}
        <ellipse cx="180" cy="340" rx="260" ry="110" fill="url(#planet)" stroke="#22d3ee" strokeOpacity="0.5" />
        <circle cx="300" cy="62" r="9" fill="#3b82f6" />
        <circle cx="297" cy="59" r="3" fill="#93c5fd" opacity="0.7" />
        <g transform="translate(150 70) rotate(12 40 80)">
          <rect x="-8" y="48" width="96" height="86" rx="22" fill="#cbd5e1" />
          <rect x="6" y="64" width="68" height="46" rx="12" fill="#94a3b8" />
          <circle cx="40" cy="30" r="32" fill="#e2e8f0" />
          <ellipse cx="42" cy="32" rx="22" ry="18" fill="url(#visor)" />
          <ellipse cx="34" cy="26" rx="7" ry="4" fill="#fff" opacity="0.5" />
          <rect x="-30" y="58" width="30" height="16" rx="8" fill="#cbd5e1" transform="rotate(-25 -15 66)" />
          <rect x="88" y="50" width="30" height="16" rx="8" fill="#cbd5e1" transform="rotate(35 100 58)" />
          <rect x="6" y="128" width="26" height="44" rx="12" fill="#cbd5e1" transform="rotate(8 19 150)" />
          <rect x="48" y="128" width="26" height="44" rx="12" fill="#cbd5e1" transform="rotate(-10 61 150)" />
          <circle cx="40" cy="88" r="5" fill="#22d3ee" />
        </g>
        <path d="M232 112 Q 262 92 290 68" stroke="#8b5cf6" strokeWidth="1.5" fill="none" strokeDasharray="3 4" opacity="0.8" />
      </svg>
      <figcaption className="mt-1 text-center text-[11px] text-slate-400">AI-generated illustration (original artwork, no agency insignia)</figcaption>
    </figure>
  );
}
