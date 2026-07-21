"use client";

import { useEffect, useRef } from "react";

import { NeuralEntityCanvas } from "@/features/command-center/components/NeuralEntityCanvas";
import {
  mapEntityStateToLegacy,
  resolveEntityRenderer,
} from "@/features/entity/core/feature-flags";
import { createAnimationConductor } from "@/features/entity/core/animation-conductor";
import type { EntityState } from "@/features/entity/core/entity-state";
import type { GazePoint } from "@/features/entity/core/gaze";
import { createCanvasRenderer } from "@/features/entity/render/canvas-renderer";
import { createFaceGeometry } from "@/features/entity/render/geometry";
import { applyRendererPolicy } from "@/features/entity/render/perf";
import { createRafLifecycle } from "@/features/entity/render/raf-lifecycle";
import { createFaceTopology } from "@/features/entity/render/topology";

function StaticEntityFallback({ state }: { state: EntityState }) {
  const critical = state === "error" || state === "warning";
  const right = critical ? "#ff5a63" : "#42e9ff";
  return (
    <svg
      aria-hidden="true"
      className="neural-entity-v2__fallback"
      viewBox="0 0 572 498"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <radialGradient id="entity-fallback-aura">
          <stop offset="0" stopColor={critical ? "#ff4d45" : "#00d4ff"} stopOpacity=".14" />
          <stop offset="1" stopColor="#03080b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="entity-fallback-face" x1="0" x2="1">
          <stop offset="0" stopColor="#ffd36a" />
          <stop offset=".5" stopColor="#e1f8ff" stopOpacity=".45" />
          <stop offset="1" stopColor={right} />
        </linearGradient>
      </defs>
      <circle cx="286" cy="214" r="205" fill="url(#entity-fallback-aura)" />
      <path d="M286 35C210 40 159 111 165 215c4 84 48 157 121 190 73-33 117-106 121-190 6-104-45-175-121-180Z" fill="none" stroke="url(#entity-fallback-face)" strokeWidth="1.6" />
      <path d="M182 193Q221 169 258 195M314 195q37-26 76-2" fill="none" stroke="url(#entity-fallback-face)" strokeWidth="2" />
      <ellipse cx="222" cy="196" rx="32" ry="14" fill="#030c12" stroke="#ffd36a" />
      <ellipse cx="350" cy="196" rx="32" ry="14" fill="#030c12" stroke={right} />
      <circle cx="222" cy="196" r="8" fill="#ffd36a" /><circle cx="222" cy="196" r="3" fill="#02060a" />
      <circle cx="350" cy="196" r="8" fill={right} /><circle cx="350" cy="196" r="3" fill="#02060a" />
      <path d="M286 203 271 280 286 290 301 280" fill="none" stroke="url(#entity-fallback-face)" strokeOpacity=".7" />
      <path d="M231 319Q286 300 341 319 286 346 231 319Z" fill="none" stroke="url(#entity-fallback-face)" />
      <path d="M205 335Q228 394 286 414q58-20 81-79" fill="none" stroke="url(#entity-fallback-face)" strokeOpacity=".62" />
      {Array.from({ length: 28 }, (_, index) => {
        const column = index % 7;
        const row = Math.floor(index / 7);
        const x = 196 + column * 30 + (row % 2) * 9;
        const y = 122 + row * 67;
        return <circle key={index} cx={x} cy={y} r={index % 6 === 0 ? 2.3 : 1.3} fill={x < 286 ? "#ffd36a" : right} opacity=".5" />;
      })}
    </svg>
  );
}

function viewportPointToGaze(host: HTMLElement, x: number, y: number): GazePoint {
  const bounds = host.getBoundingClientRect();
  return {
    x: (x - (bounds.left + bounds.width / 2)) / Math.max(bounds.width, 1),
    y: (y - (bounds.top + bounds.height / 2)) / Math.max(bounds.height, 1),
  };
}

export function NeuralEntity({ state = "idle" }: { state?: EntityState }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererMode = resolveEntityRenderer(process.env.NEXT_PUBLIC_ENTITY_V2);

  useEffect(() => {
    if (rendererMode !== "v2") return;
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const geometry = createFaceGeometry({ seed: 4242, neuralPointCount: 118 });
    const topology = createFaceTopology(geometry);
    const renderer = createCanvasRenderer({ canvas, geometry, topology });
    host.dataset.renderer = renderer.mode;
    if (renderer.mode === "fallback") return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const motion = reducedMotion ? "reduced" : "full";
    const conductor = createAnimationConductor({ seed: 4242 });
    let pointerTarget: GazePoint | null = null;
    let focusTarget: GazePoint | null = null;
    const lifecycle = createRafLifecycle({
      requestFrame: (callback) => window.requestAnimationFrame(callback),
      cancelFrame: (id) => window.cancelAnimationFrame(id),
      render: (timestamp) => {
        const frame = conductor.sample({
          at: timestamp,
          state,
          motion,
          pointer: pointerTarget,
          focus: focusTarget,
        });
        renderer.render({
          width: host.clientWidth,
          height: host.clientHeight,
          dpr: window.devicePixelRatio || 1,
          pose: frame.pose,
          state,
          time: reducedMotion ? 0 : timestamp / 1000,
        });
        host.dataset.renderer = "canvas";
        host.dataset.gazeSource = frame.gazeSource;
        host.style.setProperty("--entity-gaze-x", `${frame.pose.gazeX}`);
        host.style.setProperty("--entity-gaze-y", `${frame.pose.gazeY}`);
      },
    });

    const requestInteractionRender = () => lifecycle.renderOnce();
    const handlePointerMove = (event: PointerEvent) => {
      pointerTarget = viewportPointToGaze(host, event.clientX, event.clientY);
      requestInteractionRender();
    };
    const handlePointerOut = (event: PointerEvent) => {
      if (event.relatedTarget !== null) return;
      pointerTarget = null;
      requestInteractionRender();
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      const bounds = event.target.getBoundingClientRect();
      focusTarget = viewportPointToGaze(
        host,
        bounds.left + bounds.width / 2,
        bounds.top + bounds.height / 2,
      );
      requestInteractionRender();
    };
    const handleFocusOut = () => {
      focusTarget = null;
      requestInteractionRender();
    };
    const syncPolicy = () => applyRendererPolicy(lifecycle, {
      visible: document.visibilityState === "visible",
      motion,
    });
    const observer = new ResizeObserver(syncPolicy);
    observer.observe(host);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerout", handlePointerOut, { passive: true });
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    document.addEventListener("visibilitychange", syncPolicy);
    syncPolicy();

    return () => {
      lifecycle.stop();
      observer.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerout", handlePointerOut);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      document.removeEventListener("visibilitychange", syncPolicy);
    };
  }, [rendererMode, state]);

  if (rendererMode === "legacy") {
    return <NeuralEntityCanvas state={mapEntityStateToLegacy(state)} />;
  }

  return (
    <div
      ref={hostRef}
      className="neural-entity-v2"
      data-renderer="fallback"
      data-state={state}
      role="img"
      aria-label={`SHAGGY cinematic human neural entity, ${state}`}
    >
      <span className="neural-entity-v2__portrait" aria-hidden="true" />
      <StaticEntityFallback state={state} />
      <canvas ref={canvasRef} className="neural-entity-v2__canvas" aria-hidden="true" />
    </div>
  );
}
