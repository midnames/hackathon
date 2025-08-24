 import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MidnightMeshProvider } from "@meshsdk/midnight-react";
import * as pino from "pino";
import {
  NetworkId,
  setNetworkId,
} from "@midnight-ntwrk/midnight-js-network-id";
import { MainLayout } from "./layouts/layout";
import { Rebels } from "./pages/rebels";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { AppSettingsProvider } from "@/contexts/app-settings";
import { Story } from "@/pages/story";
import { AuthProvider } from "@/contexts/auth";
import { Create } from "@/pages/create";
import { MidnightDrop } from "@/pages/drop";
import { Settings } from "@/pages/settings";

export const logger = pino.pino({
  level: "trace",
});

// Update this network id, could be testnet or undeployed
setNetworkId(NetworkId.TestNet);

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <MidnightMeshProvider logger={logger}>
        <AppSettingsProvider>
          <AuthProvider>
          <BrowserRouter basename="/">
            <Routes>
              <Route element={<MainLayout />}>
                <Route path="/" element={<Rebels />} />
                <Route path="/create" element={<Create />} />
                <Route path="/drop" element={<MidnightDrop />} />
                <Route path="/story/:id" element={<Story />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile" element={<Settings />} />
                <Route path="/debug" element={<Settings />} />
              </Route>
            </Routes>
          </BrowserRouter>
          <Toaster richColors position="top-right" />
          </AuthProvider>
        </AppSettingsProvider>
      </MidnightMeshProvider>
    </ThemeProvider>
  );
}

export default App;
