// Centralized app configuration and environment flags
export const CONFIG = {
  // Vite env var should be defined as VITE_REBELS_CONTRACT_ADDRESS
  REBELS_CONTRACT_ADDRESS:
    (import.meta as any).env?.VITE_REBELS_CONTRACT_ADDRESS ||
    "0200378c53f94ff37d087205294b0622b42634afc6f0dd0b01cde0d13e15030f3121",

  // Toggle debug UI panels (do not log sensitive info)
  DEBUG_UI: ((import.meta as any).env?.VITE_DEBUG_UI || "false") === "true",

  // Prover selection: 'wallet' | custom URL
  DEFAULT_PROVER: (import.meta as any).env?.VITE_DEFAULT_PROVER || "wallet",
};
