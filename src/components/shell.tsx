import { ReactNode } from "react";
import { NavRail } from "./nav-rail";
import { TopBar } from "./top-bar";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="shaggy-screen flex text-[#f1f5f9]">
      <NavRail />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-hidden p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
