import { lazy, Suspense, type ReactNode } from "react";
import Dashboard from "./Dashboard";

const LiveMission = lazy(() => import("./LiveMission"));
const Console = lazy(() => import("./Console"));
const Mental = lazy(() => import("./Mental"));
const Musculoskeletal = lazy(() => import("./Musculoskeletal"));
const Cardiovascular = lazy(() => import("./Cardiovascular"));
const Profile = lazy(() => import("./Profile"));
const Sources = lazy(() => import("./Sources"));

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <details id={id} open className="glass mt-6 scroll-mt-20 p-4">
      <summary className="cursor-pointer text-lg font-bold text-white">{title}</summary>
      <div className="mt-4"><Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>{children}</Suspense></div>
    </details>
  );
}

/** One page: everything that used to be a separate menu item is a section here. */
export default function Home() {
  return (
    <div>
      <Dashboard />
      <Section id="live" title="Live orbit and Earth events"><LiveMission /></Section>
      <Section id="console" title="Habitat console"><Console /></Section>
      <Section id="mental" title="Mental wellbeing"><Mental /></Section>
      <Section id="musculoskeletal" title="Muscle and bone"><Musculoskeletal /></Section>
      <Section id="cardiovascular" title="Cardiovascular"><Cardiovascular /></Section>
      <Section id="profile" title="Profile and health history"><Profile /></Section>
      <Section id="sources" title="Sources"><Sources /></Section>
    </div>
  );
}
