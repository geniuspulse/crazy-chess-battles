"use client";

import { useEffect, useRef } from "react";

interface FireworksCanvasProps {
  active: boolean;
  colorTheme?: "win" | "draw";
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

const WIN_COLORS = ["#8b5cf6", "#f59e0b", "#22d3ee", "#f472b6", "#a3e635", "#fbbf24"];
const DRAW_COLORS = ["#94a3b8", "#8b5cf6", "#64748b"];

export default function FireworksCanvas({ active, colorTheme = "win" }: FireworksCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const launchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const colors = colorTheme === "win" ? WIN_COLORS : DRAW_COLORS;

    const resize = () => {
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
    };
    resize();
    window.addEventListener("resize", resize);

    const launchFirework = () => {
      const w = canvas.width;
      const h = canvas.height;
      const x = w * (0.15 + Math.random() * 0.7);
      const y = h * (0.15 + Math.random() * 0.45);
      const color = colors[Math.floor(Math.random() * colors.length)];
      const count = colorTheme === "win" ? 40 : 22;

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
        const speed = (1.5 + Math.random() * 2.5) * devicePixelRatio;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: 50 + Math.random() * 30,
          color,
          size: (1.5 + Math.random() * 1.5) * devicePixelRatio,
        });
      }
    };

    // Launch bursts periodically
    launchFirework();
    launchTimerRef.current = setInterval(
      launchFirework,
      colorTheme === "win" ? 900 : 1800
    );

    const gravity = 0.035 * devicePixelRatio;

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current = particlesRef.current.filter((p) => p.life < p.maxLife);

      for (const p of particlesRef.current) {
        p.life += 1;
        p.vy += gravity;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;

        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (launchTimerRef.current) clearInterval(launchTimerRef.current);
      particlesRef.current = [];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [active, colorTheme]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}
