"use client";

import { motion, useReducedMotion } from "framer-motion";

export function CommandPulse({ eventKey, tone = "active" }: { eventKey: string | null; tone?: "active" | "success" | "error" }) {
  const reducedMotion = useReducedMotion();
  if (!eventKey) return null;
  const color = tone === "error" ? "#ff6d7d" : tone === "success" ? "#5df2ba" : "#55e9ff";
  return (
    <svg className="dream-command-pulse" viewBox="0 0 1287 836" aria-hidden="true" key={eventKey}>
      <motion.path d="M 642 398 C 760 366 836 330 958 270" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" initial={reducedMotion ? { opacity: 0.32 } : { pathLength: 0, opacity: 0 }} animate={reducedMotion ? { opacity: 0.32 } : { pathLength: [0, 1, 1], opacity: [0, 0.9, 0] }} transition={reducedMotion ? { duration: 0 } : { duration: 1.15, times: [0, 0.7, 1], ease: "easeOut" }} />
    </svg>
  );
}
