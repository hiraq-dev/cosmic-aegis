import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Send, Sparkles, Square, Volume2, VolumeX, X } from "lucide-react";
import { CRISIS_RE, aiAvailable, askAI } from "../lib/llm";
import { speakLines, speechSupported, stopSpeech } from "../lib/speech";
import { useStore } from "../lib/store";
import { START_CHIPS, reply, type BotReply } from "../lib/assistant";

interface Msg {
  from: "bot" | "me";
  text: string;
  go?: BotReply["go"];
  chips?: string[];
  speak?: string[];
  ai?: boolean;
}

export default function Assistant() {
  const { data } = useStore();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: "bot", text: `Hi ${data.profile.name.split(" ")[0] || "there"}, I am the AEGIS assistant. I explain your own logged demo data. I am not a doctor. Where AI mode is on, a language model writes my answers from a short anonymous summary of your demo readings; otherwise I am a scripted helper.`, chips: START_CHIPS },
  ]);
  const end = useRef<HTMLDivElement>(null);
  const [voice, setVoice] = useState(false);
  const [talking, setTalking] = useState(false);
  const [aiOk, setAiOk] = useState(false);
  const [ai, setAi] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { aiAvailable().then(setAiOk); }, []);
  const say = (lines: string[]) => {
    setTalking(true);
    speakLines(lines, undefined, () => setTalking(false));
  };
  const hush = () => {
    stopSpeech();
    setTalking(false);
  };
  useEffect(() => () => stopSpeech(), []);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, open]);

  const send = async (t: string) => {
    const text = t.trim();
    if (!text || busy) return;
    setInput("");
    const scripted = reply(text, data);
    const useAi = aiOk && ai && !CRISIS_RE.test(text) && !scripted.speak; // crisis and the spoken-guidance plan stay deterministic
    if (!useAi) {
      setMsgs((m) => [...m, { from: "me", text }, { from: "bot", ...scripted }]);
      if (scripted.speak) say(scripted.speak);
      else if (voice) say([scripted.text]);
      return;
    }
    setMsgs((m) => [...m, { from: "me", text }]);
    setBusy(true);
    try {
      const hist = [...msgs.filter((m) => m.from === "me" || m.from === "bot").map((m) => ({ role: m.from === "me" ? ("user" as const) : ("assistant" as const), content: m.text })), { role: "user" as const, content: text }].filter((m, i, arr) => !(i === 0 && m.role === "assistant") || arr.length === 0);
      const r = await askAI(hist, data);
      setMsgs((m) => [...m, { from: "bot", text: r.text, go: scripted.go, ai: !r.safety }]);
      if (voice) say([r.text]);
    } catch {
      setMsgs((m) => [...m, { from: "bot", ...scripted, text: scripted.text + "\n\n(AI mode is unavailable right now, so this is the scripted answer.)" }]);
    } finally {
      setBusy(false);
    }
  };

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open AEGIS assistant"
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-aegis-cyan px-4 py-3 text-sm font-semibold text-space-950 shadow-lg shadow-cyan-500/30 hover:bg-cyan-300"
      >
        <Bot size={18} aria-hidden="true" /> Assistant
      </button>
    );

  return (
    <section role="dialog" aria-label="AEGIS assistant" className="fixed inset-x-2 bottom-2 z-50 flex max-h-[80vh] flex-col rounded-2xl border border-white/15 bg-space-950/95 shadow-2xl backdrop-blur sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Bot size={16} className="text-aegis-cyan" aria-hidden="true" /> AEGIS Assistant
          </h2>
          <p className="text-[11px] text-slate-400">{aiOk && ai ? "AI mode (Claude). Not medical advice." : "Scripted demo helper. Not medical advice."}</p>
        </div>
        <div className="flex items-center gap-1">
          {aiOk && (
            <button onClick={() => setAi((v) => !v)} aria-pressed={ai} aria-label={ai ? "Turn AI mode off" : "Turn AI mode on"} title="AI mode sends a short anonymous summary of your demo readings to the language model" className={`rounded p-1.5 hover:bg-white/10 ${ai ? "text-hud-emerald" : "text-slate-400"}`}>
              <Sparkles size={18} />
            </button>
          )}
          {speechSupported && (
            <button onClick={() => { if (voice) hush(); setVoice((v) => !v); }} aria-pressed={voice} aria-label={voice ? "Turn voice replies off" : "Turn voice replies on"} title="Read replies aloud" className={`rounded p-1.5 hover:bg-white/10 ${voice ? "text-aegis-cyan" : "text-slate-400"}`}>
              {voice ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          )}
          {talking && (
            <button onClick={hush} aria-label="Stop speaking" className="rounded p-1.5 text-hud-crimson hover:bg-white/10"><Square size={16} /></button>
          )}
        <button onClick={() => { hush(); setOpen(false); }} aria-label="Close assistant" className="rounded p-1 text-slate-300 hover:bg-white/10">
          <X size={18} />
        </button>
        </div>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={m.from === "me" ? "text-right" : ""}>
            <p className={`inline-block max-w-[90%] whitespace-pre-line rounded-2xl px-3 py-2 text-left text-sm ${m.from === "me" ? "bg-aegis-cyan/20 text-white" : "bg-white/8 bg-white/10 text-slate-100"}`}>{m.text}</p>
            {m.ai && <div className="hud-mono mt-0.5 text-[9px] tracking-widest text-hud-emerald">AI-GENERATED. NOT MEDICAL ADVICE.</div>}
            {m.go && (
              <div className="mt-1">
                <button
                  className="text-xs text-aegis-cyan underline"
                  onClick={() => {
                    nav(m.go!.to);
                    setOpen(false);
                  }}
                >
                  {m.go.label} &rarr;
                </button>
              </div>
            )}
            {m.chips && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {m.chips.map((c) => (
                  <button key={c} onClick={() => send(c)} className="rounded-full border border-white/20 px-2.5 py-1 text-xs text-slate-200 hover:bg-white/10">
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <p className="inline-block rounded-2xl bg-white/10 px-3 py-2 text-sm text-slate-300" role="status">Thinking...</p>}
        <div ref={end} />
      </div>
      <form
        className="flex gap-2 border-t border-white/10 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label htmlFor="assistant-input" className="sr-only">
          Message the assistant
        </label>
        <input id="assistant-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your sleep, heart, stress..." className="min-w-0 flex-1 rounded-lg border border-white/15 bg-space-900/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-aegis-cyan focus:outline-none" />
        <button type="submit" aria-label="Send" className="rounded-lg bg-aegis-cyan px-3 text-space-950">
          <Send size={16} />
        </button>
      </form>
    </section>
  );
}
