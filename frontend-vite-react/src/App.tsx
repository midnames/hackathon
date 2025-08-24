import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MidnightMeshProvider } from "@meshsdk/midnight-react";
import * as pino from "pino";
import {
  NetworkId,
  setNetworkId,
} from "@midnight-ntwrk/midnight-js-network-id";
import { MainLayout } from "./layouts/layout";
import { Debug } from "./pages/wallet-ui";
import { Rebels } from "./pages/rebels";
import { ThemeProvider } from "./components/theme-provider";

export const logger = pino.pino({
  level: "trace",
});

// Update this network id, could be testnet or undeployed
setNetworkId(NetworkId.TestNet);

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <MidnightMeshProvider logger={logger}>
        <BrowserRouter basename="/">
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Rebels />} />
              <Route path="/debug" element={<Debug />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </MidnightMeshProvider>
    </ThemeProvider>
  );
}

export default App;
