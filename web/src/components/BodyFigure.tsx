import { useState } from "react";
import type { Status } from "../lib/types";
import { StatusPill } from "./ui";

export type RegionId = "upper" | "core" | "hips" | "thighs" | "calves";

interface RegionInfo {
  id: RegionId;
  name: string;
  why: string;
  spaceflight: string;
  countermeasure: string;
}

// General educational text. Paraphrased background, not clinical guidance. See the Sources page.
export const REGIONS: RegionInfo[] = [
  {
    id: "upper",
    name: "Shoulders and arms",
    why: "Lift, push and pull. Needed for handling equipment and for exercise.",
    spaceflight: "In microgravity these muscles carry less everyday load than on Earth, so strength can decline without training.",
    countermeasure: "Resistive exercise with bands or a resistive device.",
  },
  {
    id: "core",
    name: "Core and spine",
    why: "Supports posture and protects the spine.",
    spaceflight: "Without gravity compressing the spine, posture muscles work differently and back discomfort is possible.",
    countermeasure: "Core-focused strength work and stretching.",
  },
  {
    id: "hips",
    name: "Hips and pelvis",
    why: "Large weight-bearing bones and the power centre for walking and lifting.",
    spaceflight: "Weight-bearing bones are unloaded in space, a key reason bone health is monitored on long missions.",
    countermeasure: "Loaded exercise such as squats and deadlifts on a resistive device.",
  },
  {
    id: "thighs",
    name: "Thighs",
    why: "The largest muscle group, used for standing, walking and stairs.",
    spaceflight: "Leg muscles that fight gravity on Earth are used much less in orbit, so they are a main focus of exercise routines.",
    countermeasure: "Resistive squats plus treadmill running with restraint.",
  },
  {
    id: "calves",
    name: "Calves and feet",
    why: "Provide balance and push-off, and help blood return from the legs.",
    spaceflight: "Calf muscles and the bones of the lower leg are unloaded without gravity.",
    countermeasure: "Calf raises, treadmill running and cycling.",
  },
];

const FILL: Record<Status, string> = { nominal: "#34d399", watch: "#fbbf24", review: "#fb7185" };

export function BodyFigure({ statuses }: { statuses: Record<RegionId, Status> }) {
  const [sel, setSel] = useState<RegionId>("thighs");
  const info = REGIONS.find((r) => r.id === sel)!;

  const region = (id: RegionId, label: string, children: React.ReactNode) => (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${label}, status ${statuses[id]}. Press to show details.`}
      aria-pressed={sel === id}
      onClick={() => setSel(id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setSel(id);
        }
      }}
      fill={FILL[statuses[id]]}
      fillOpacity={sel === id ? 0.95 : 0.55}
      stroke={sel === id ? "#ffffff" : "#0a1230"}
      strokeWidth={sel === id ? 2.5 : 1.5}
      style={{ cursor: "pointer" }}
    >
      {children}
    </g>
  );

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <svg viewBox="0 0 200 420" className="mx-auto h-[360px] w-auto" role="group" aria-label="Clickable body figure showing illustrative muscle and bone status">
        <circle cx="100" cy="38" r="24" fill="#1a2656" stroke="#2a3a78" strokeWidth="2" />
        {region("upper", "Shoulders and arms", (
          <>
            <rect x="38" y="72" width="124" height="30" rx="15" />
            <rect x="28" y="96" width="26" height="100" rx="13" />
            <rect x="146" y="96" width="26" height="100" rx="13" />
          </>
        ))}
        {region("core", "Core and spine", <rect x="66" y="100" width="68" height="86" rx="18" />)}
        {region("hips", "Hips and pelvis", <rect x="62" y="186" width="76" height="40" rx="18" />)}
        {region("thighs", "Thighs", (
          <>
            <rect x="62" y="226" width="34" height="86" rx="15" />
            <rect x="104" y="226" width="34" height="86" rx="15" />
          </>
        ))}
        {region("calves", "Calves and feet", (
          <>
            <rect x="64" y="318" width="30" height="80" rx="13" />
            <rect x="106" y="318" width="30" height="80" rx="13" />
          </>
        ))}
      </svg>
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-semibold text-white">{info.name}</h3>
          <StatusPill status={statuses[sel]} />
        </div>
        <dl className="mt-3 space-y-3 text-sm text-slate-300">
          <div>
            <dt className="font-medium text-aegis-cyan">What it does</dt>
            <dd>{info.why}</dd>
          </div>
          <div>
            <dt className="font-medium text-aegis-cyan">What spaceflight changes</dt>
            <dd>{info.spaceflight}</dd>
          </div>
          <div>
            <dt className="font-medium text-aegis-cyan">What helps</dt>
            <dd>{info.countermeasure}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-slate-400">Colours are illustrative prototype data derived from your logged exercise, not a body scan or measurement.</p>
      </div>
    </div>
  );
}
