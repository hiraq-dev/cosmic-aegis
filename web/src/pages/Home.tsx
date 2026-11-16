import { lazy, Suspense, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Brain, Play } from "lucide-react";
import ScanSession from "../components/ScanSession";
import CrewConsole from "../components/CrewConsole";
import NasaContext from "../components/NasaContext";
import { MoodCheckIn } from "../components/forms";
import { Disclaimer, Panel } from "../components/ui";
import { SOURCES } from "../lib/team";

const Intro3D = lazy(() => import("../components/Intro3D"));
const webgl = (() => { try { return !!document.createElement("canvas").getContext("webgl2") && !window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } })();
const seen = () => { try { return sessionStorage.getItem("aegis-intro-seen") === "1"; } catch { return false; } };

/** One page, only what the idea needs: 3D intro, body scan, heart-rate sensor + 3D crew + ASTRA, check-in, NASA context. */
export default function Home() {
  const [intro, setIntro] = useState(webgl && !seen());
  const done = useCallback(() => { try { sessionStorage.setItem("aegis-intro-seen", "1"); } catch { /* ignore */ } setIntro(false); }, []);
  return (
    <div className="space-y-6">
      {intro && createPortal(<Suspense fallback={<div className="fixed inset-0 z-[100] grid place-items-center bg-[#02040c] text-cyan-300">Loading 3D intro…</div>}><Intro3D onDone={done} /></Suspense>, document.body)}
      <div className="flex justify-end">{webgl && <button className="inline-flex items-center gap-1 rounded border border-white/15 px-3 py-1 text-xs text-slate-200 hover:bg-white/10" onClick={() => setIntro(true)}><Play size={12} /> Replay 3D intro</button>}</div>
      <ScanSession />
      <CrewConsole />
      <Panel title="Daily check-in" icon={<Brain size={16} aria-hidden="true" />}><MoodCheckIn compact /></Panel>
      <NasaContext />
      <Panel title="Sources">
        <ul className="grid gap-1 text-xs text-slate-300 sm:grid-cols-2">{SOURCES.map(s => <li key={s.name}><a className="underline hover:text-cyan-300" href={s.url} target="_blank" rel="noreferrer">{s.name}</a></li>)}</ul>
      </Panel>
      <Disclaimer />
    </div>
  );
}
