"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  computeDreamViewportTransform,
  type DreamViewportTransform,
} from "../layout-contract";

const SAME_LAYOUT_EPSILON = 0.0001;

function isSameTransform(
  previous: DreamViewportTransform | null,
  next: DreamViewportTransform,
) {
  return previous !== null
    && previous.layout === next.layout
    && Math.abs(previous.scale - next.scale) < SAME_LAYOUT_EPSILON
    && Math.abs(previous.offsetX - next.offsetX) < SAME_LAYOUT_EPSILON
    && Math.abs(previous.offsetY - next.offsetY) < SAME_LAYOUT_EPSILON;
}

export function DreamViewport({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<DreamViewportTransform | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const update = (width: number, height: number) => {
      if (width <= 0 || height <= 0) return;
      const next = computeDreamViewportTransform({ width, height });
      setTransform((previous) => isSameTransform(previous, next) ? previous : next);
    };

    const initial = viewport.getBoundingClientRect();
    update(initial.width, initial.height);

    const observer = new ResizeObserver(([entry]) => {
      update(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(viewport);

    return () => observer.disconnect();
  }, []);

  const style = transform ? {
    left: `${transform.offsetX}px`,
    top: `${transform.offsetY}px`,
    width: `${transform.canonicalWidth}px`,
    height: `${transform.canonicalHeight}px`,
    transform: `scale(${transform.scale})`,
  } satisfies CSSProperties : undefined;

  return (
    <div ref={viewportRef} className="dream-viewport">
      <div
        className="dream-viewport__canvas"
        data-layout={transform?.layout ?? "standard"}
        data-ready={transform ? "true" : "false"}
        style={style}
      >
        {children}
      </div>
    </div>
  );
}
