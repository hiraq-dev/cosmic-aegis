// Voice-over using the browser's built-in speech synthesis. No audio is sent anywhere.
export const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

export function stopSpeech() {
  if (speechSupported) window.speechSynthesis.cancel();
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const v = window.speechSynthesis.getVoices();
  return v.find((x) => /en[-_](US|GB)/i.test(x.lang) && /natural|google|samantha|zira|aria|jenny/i.test(x.name)) ?? v.find((x) => /^en/i.test(x.lang)) ?? v[0];
}

// Speaks the lines one after another. Calls onLine(index) as each starts and onEnd when finished or stopped.
export function speakLines(lines: string[], onLine?: (i: number) => void, onEnd?: () => void) {
  if (!speechSupported || !lines.length) {
    onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  let done = false;
  const finish = () => {
    if (!done) {
      done = true;
      onEnd?.();
    }
  };
  lines.forEach((text, i) => {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1;
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.onstart = () => onLine?.(i);
    if (i === lines.length - 1) {
      u.onend = finish;
    }
    u.onerror = finish;
    synth.speak(u);
  });
}
