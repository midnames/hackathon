import React, { createContext, useContext, useEffect, useState } from "react";

type AppSettingsState = {
  useCustomProofServer: boolean;
  setUseCustomProofServer: (v: boolean) => void;
};

const AppSettingsContext = createContext<AppSettingsState | undefined>(undefined);

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [useCustomProofServer, setUseCustomProofServerState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const v = localStorage.getItem("useCustomProofServer");
    return v === "true";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("useCustomProofServer", String(useCustomProofServer));
    }
  }, [useCustomProofServer]);

  const setUseCustomProofServer = (v: boolean) => setUseCustomProofServerState(v);

  return (
    <AppSettingsContext.Provider value={{ useCustomProofServer, setUseCustomProofServer }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error("useAppSettings must be used within AppSettingsProvider");
  return ctx;
}
