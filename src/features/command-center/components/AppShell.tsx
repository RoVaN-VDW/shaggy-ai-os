import type { ReactNode } from "react";
import { ProductIdentity } from "./ProductIdentity";
import { GlobalCommand } from "./GlobalCommand";
import { PrimarySidebar } from "./PrimarySidebar";
import { SystemStatus } from "./SystemStatus";
import { DreamViewport } from "./DreamViewport";
import { TrustFooter } from "./TrustFooter";
import { UtilityProfile } from "./UtilityProfile";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <DreamViewport>
      <div className="dream-shell" data-dream-region="ambient-background">
        <div className="dream-shell__identity"><ProductIdentity /></div>
        <div className="dream-shell__command"><GlobalCommand /></div>
        <div className="dream-shell__utility"><UtilityProfile /></div>
        <div className="dream-shell__sidebar"><PrimarySidebar /></div>
        <div className="dream-shell__status"><SystemStatus /></div>
        <main className="dream-shell__main">{children}</main>
        <TrustFooter />
      </div>
    </DreamViewport>
  );
}