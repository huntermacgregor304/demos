import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
  warm: boolean;
};

function makeStars(count: number): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() < 0.08 ? 1.7 : 0.7 + Math.random() * 0.5,
    phase: Math.random() * Math.PI * 2,
    speed: 0.006 + Math.random() * 0.018,
    warm: Math.random() > 0.72,
  }));
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const stars = makeStars(150);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, width, height);
      for (const star of stars) {
        if (!reduced) {
          star.y -= star.speed * dt;
          if (star.y < 0) star.y += 1;
        }
        const twinkle = reduced ? 0.85 : 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(now / 800 + star.phase));
        ctx.fillStyle = star.warm ? `rgba(255, 226, 170, ${twinkle})` : `rgba(236, 244, 255, ${twinkle})`;
        ctx.fillRect(star.x * width, star.y * height, star.r, star.r);
      }
      if (!reduced) frame = requestAnimationFrame(draw);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />;
}
