import { useEffect, useRef } from "react";

// Decorative animated starfield (canvas). Pauses for users who prefer reduced motion.
export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    const stars = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random() * 0.8 + 0.2, t: Math.random() * 6 }));
    const resize = () => {
      w = c.width = window.innerWidth;
      h = c.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.t += 0.02;
        if (!reduce) s.y = (s.y + 0.00012 * s.z) % 1;
        ctx.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(s.t * s.z));
        ctx.fillStyle = s.z > 0.8 ? "#9fe9ff" : "#ffffff";
        ctx.fillRect(s.x * w, s.y * h, s.z * 1.8, s.z * 1.8);
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 h-full w-full" />;
}
