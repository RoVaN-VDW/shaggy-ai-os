"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AuthBoundaryStatus } from "@/lib/auth/auth-boundary";

export type AuthBoundarySnapshot = {
  status: AuthBoundaryStatus;
  hasSession: boolean;
  checkedAt: string | null;
  error: string | null;
};

const AuthBoundaryContext = createContext<AuthBoundarySnapshot | null>(null);

export function AuthBoundaryProvider({
  value,
  children,
}: {
  value: AuthBoundarySnapshot;
  children: ReactNode;
}) {
  return (
    <AuthBoundaryContext.Provider value={value}>
      {children}
    </AuthBoundaryContext.Provider>
  );
}

export function useAuthBoundary(): AuthBoundarySnapshot {
  const value = useContext(AuthBoundaryContext);
  if (!value) {
    throw new Error("useAuthBoundary must be used inside AuthBoundaryProvider");
  }
  return value;
}
