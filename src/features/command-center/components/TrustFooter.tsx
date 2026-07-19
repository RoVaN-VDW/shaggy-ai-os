import Link from "next/link";
import { ArrowRight, Clock3, ShieldCheck } from "lucide-react";

export function TrustFooter() {
  return (
    <footer className="dream-footer" aria-label="Command and trust status">
      <div data-dream-region="command-mode-footer">
        <Clock3 />
        <span><b>Command mode</b><small>Manual · approval-gated</small></span>
      </div>
      <div data-dream-region="trust-status-footer">
        <ShieldCheck />
        <span><b>Private by design</b><small>Authenticated session · truthful telemetry</small></span>
      </div>
      <Link href="/settings" data-dream-region="brand-promise">
        <span><b>Strategic Hybrid Agentic</b><small>Governance & Growth Yield</small></span>
        <ArrowRight />
      </Link>
    </footer>
  );
}
