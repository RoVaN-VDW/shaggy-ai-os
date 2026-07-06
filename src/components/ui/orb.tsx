"use client";

import { useEffect, useRef } from "react";

export function AICoreOrb({ size = 120 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssSize = size;
    canvas.width = cssSize * dpr;
    canvas.height = cssSize * dpr;
    canvas.style.width = `${cssSize}px`;
    canvas.style.height = `${cssSize}px`;
    ctx.scale(dpr, dpr);

    let raf = 0;
    const center = cssSize / 2;

    const draw = () => {
      ctx.clearRect(0, 0, cssSize, cssSize);
      const time = Date.now() * 0.001;

      // Outer glow ring
      ctx.beginPath();
      ctx.arc(center, center, size * 0.42 + Math.sin(time * 2) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0, 212, 255, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Rotating inner ring
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(time * 0.6);
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.32, 0, Math.PI * 1.7);
      ctx.strokeStyle = "rgba(0, 212, 255, 0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Core gradient orb
      const gradient = ctx.createRadialGradient(
        center - size * 0.08,
        center - size * 0.08,
        size * 0.05,
        center,
        center,
        size * 0.28
      );
      gradient.addColorStop(0, "rgba(0, 255, 255, 0.95)");
      gradient.addColorStop(0.4, "rgba(0, 180, 255, 0.5)");
      gradient.addColorStop(1, "rgba(0, 212, 255, 0.05)");

      ctx.beginPath();
      ctx.arc(center, center, size * 0.22 + Math.sin(time * 3) * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Pulsing dots
      for (let i = 0; i < 6; i++) {
        const angle = time * 0.4 + (i * Math.PI) / 3;
        const radius = size * 0.34 + Math.sin(time * 2 + i) * 3;
        const x = center + Math.cos(angle) * radius;
        const y = center + Math.sin(angle) * radius;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 212, 255, ${0.4 + 0.4 * Math.sin(time + i)})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded-full"
      aria-label="SHAGGY AI Core Orb"
    />
  );
}
