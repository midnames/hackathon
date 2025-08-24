import React, { createContext, useContext, useMemo, useState } from "react";
import type { UserInfo } from "@/lib/rebels";

type AuthState = {
  secretKey: string;
  setSecretKey: (v: string) => void;
  secretKeyUserInfo: UserInfo | null;
  setSecretKeyUserInfo: (v: UserInfo | null) => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Keep secret key in memory only (do not persist to storage)
  const [secretKey, setSecretKey] = useState("");
  const [secretKeyUserInfo, setSecretKeyUserInfo] = useState<UserInfo | null>(
    null
  );

  const value = useMemo(
    () => ({ secretKey, setSecretKey, secretKeyUserInfo, setSecretKeyUserInfo }),
    [secretKey, secretKeyUserInfo]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
