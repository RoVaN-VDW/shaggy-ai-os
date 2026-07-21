"use client";

import { useEffect, useRef } from "react";

import { createRafLifecycle } from "@/features/entity/render/raf-lifecycle";

type EntityState = "idle" | "thinking" | "warning";

function seeded(index: number) {
  const value = Math.sin(index * 9283.31) * 43758.5453;
  return value - Math.floor(value);
}

export function NeuralEntityCanvas({ state = "idle" }: { state?: EntityState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;

    const draw = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      const cx = width * 0.5;
      const cy = height * 0.46;
      const scale = Math.min(width / 570, height / 500);
      const time = reduced ? 0 : frame * 0.012;
      const pulse = 1 + Math.sin(time * (state === "thinking" ? 2.5 : 1.2)) * 0.025;

      const aura = context.createRadialGradient(cx, cy, 12, cx, cy, 220 * scale);
      aura.addColorStop(0, state === "warning" ? "rgba(255,77,69,.12)" : "rgba(0,212,255,.12)");
      aura.addColorStop(0.48, "rgba(0,212,255,.035)");
      aura.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = aura;
      context.fillRect(0, 0, width, height);

      for (let ring = 0; ring < 4; ring += 1) {
        context.beginPath();
        context.ellipse(cx, cy + 176 * scale, (125 + ring * 28) * scale * pulse, (18 + ring * 4) * scale, 0, 0, Math.PI * 2);
        context.strokeStyle = ring % 2 ? "rgba(240,180,41,.10)" : "rgba(0,212,255,.13)";
        context.lineWidth = 1;
        context.stroke();
      }

      const faceWidth = 112 * scale;
      const faceHeight = 165 * scale;
      context.save();
      context.translate(cx, cy);
      context.scale(pulse, pulse);

      for (let side = -1; side <= 1; side += 2) {
        const color = side < 0 ? "240,180,41" : "0,212,255";
        context.beginPath();
        context.moveTo(0, -faceHeight * 0.96);
        context.bezierCurveTo(side * faceWidth * 0.82, -faceHeight, side * faceWidth, -faceHeight * 0.25, side * faceWidth * 0.78, faceHeight * 0.48);
        context.bezierCurveTo(side * faceWidth * 0.58, faceHeight * 0.86, side * faceWidth * 0.22, faceHeight, 0, faceHeight * 1.08);
        context.strokeStyle = `rgba(${color},.68)`;
        context.shadowColor = `rgba(${color},.55)`;
        context.shadowBlur = 14;
        context.lineWidth = 1.4;
        context.stroke();
      }

      context.shadowBlur = 0;
      const nodes: { x: number; y: number; side: number }[] = [];
      for (let index = 0; index < 118; index += 1) {
        const y = (seeded(index) * 2 - 1) * faceHeight * 0.92;
        const envelope = Math.sqrt(Math.max(0, 1 - (y / faceHeight) ** 2));
        const x = (seeded(index + 220) * 2 - 1) * faceWidth * envelope;
        nodes.push({ x, y, side: x < 0 ? -1 : 1 });
      }

      for (let index = 0; index < nodes.length; index += 1) {
        const node = nodes[index];
        const next = nodes[(index * 17 + 31) % nodes.length];
        if (node.side === next.side && Math.hypot(node.x - next.x, node.y - next.y) < 72 * scale) {
          context.beginPath();
          context.moveTo(node.x, node.y);
          context.lineTo(next.x, next.y);
          context.strokeStyle = node.side < 0 ? "rgba(240,180,41,.16)" : "rgba(0,212,255,.17)";
          context.lineWidth = 0.6;
          context.stroke();
        }
      }
      for (let index = 0; index < nodes.length; index += 1) {
        const node = nodes[index];
        const shimmer = 0.4 + Math.sin(time * 2 + index) * 0.16;
        context.beginPath();
        context.arc(node.x, node.y, (index % 11 === 0 ? 2.2 : 1.15) * scale, 0, Math.PI * 2);
        context.fillStyle = node.side < 0 ? `rgba(255,211,106,${shimmer})` : `rgba(66,233,255,${shimmer})`;
        context.fill();
      }

      context.beginPath();
      context.moveTo(-42 * scale, 2);
      context.quadraticCurveTo(-26 * scale, -9 * scale, -11 * scale, 1);
      context.moveTo(11 * scale, 1);
      context.quadraticCurveTo(26 * scale, -9 * scale, 42 * scale, 2);
      context.strokeStyle = "rgba(225,248,255,.55)";
      context.lineWidth = 1;
      context.stroke();
      context.restore();

      const satellites = [[-185, -112], [185, -112], [-192, 122], [192, 122]];
      satellites.forEach(([dx, dy], index) => {
        const x = cx + dx * scale;
        const y = cy + dy * scale + Math.sin(time + index) * 4;
        context.beginPath();
        context.arc(x, y, 15 * scale, 0, Math.PI * 2);
        context.strokeStyle = index % 2 ? "rgba(0,212,255,.42)" : "rgba(240,180,41,.38)";
        context.fillStyle = "rgba(5,15,23,.78)";
        context.fill(); context.stroke();
        context.beginPath();
        context.arc(x, y, 3 * scale, 0, Math.PI * 2);
        context.fillStyle = index % 2 ? "#42e9ff" : "#ffd36a";
        context.fill();
      });

      frame += 1;
    };

    const lifecycle = createRafLifecycle({
      requestFrame: (callback) => window.requestAnimationFrame(callback),
      cancelFrame: (id) => window.cancelAnimationFrame(id),
      render: draw,
    });
    if (reduced) lifecycle.renderOnce();
    else lifecycle.start();

    const observer = new ResizeObserver(() => lifecycle.renderOnce());
    observer.observe(host);
    return () => {
      lifecycle.stop();
      observer.disconnect();
    };
  }, [state]);

  return <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-label={`SHAGGY dual neural entity, ${state}`} role="img" />;
}