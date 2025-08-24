// Centralized app configuration and environment flags
export const CONFIG = {
  // Vite env var should be defined as VITE_REBELS_CONTRACT_ADDRESS
  REBELS_CONTRACT_ADDRESS:
    (import.meta as any).env?.VITE_REBELS_CONTRACT_ADDRESS ||
    "0200754c63438c4c805ba8a639d3ef876ac4ee95aed7d9afdde62ba8b9c60581805d",

  // Toggle debug UI panels (do not log sensitive info)
  DEBUG_UI: ((import.meta as any).env?.VITE_DEBUG_UI || "false") === "true",

  // Prover selection: 'wallet' | custom URL
  DEFAULT_PROVER: (import.meta as any).env?.VITE_DEFAULT_PROVER || "wallet",
};
