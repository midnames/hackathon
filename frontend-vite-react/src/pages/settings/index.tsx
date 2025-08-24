import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModeToggle } from "@/components/mode-toggle";
import { useAssets, useWallet } from "@meshsdk/midnight-react";
import { useAppSettings } from "@/contexts/app-settings";
import { useAuth } from "@/contexts/auth";
import { toast } from "sonner";
import { CONFIG } from "@/config";
import { getUserInfoFromSecretKey } from "@/lib/rebels";
import { WrappedPublicDataProvider } from "@meshsdk/midnight-core";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { logger } from "@/App";
import { Key, Wallet, SwitchCamera, Wifi, WifiOff, Server } from "lucide-react";

export function Settings() {
  const { uris, hasConnectedWallet, isProofServerOnline, walletName, address } = useAssets();
  const { connectingWallet, disconnect, setOpen, connectWallet } = useWallet();
  const { useCustomProofServer, setUseCustomProofServer } = useAppSettings();
  const { secretKey, setSecretKey, setSecretKeyUserInfo } = useAuth();

  const publicDataProvider = useMemo(() => {
    if (!uris) return undefined;
    return new WrappedPublicDataProvider(
      indexerPublicDataProvider(uris.indexerUri, uris.indexerWsUri),
      () => {},
      logger
    );
  }, [uris]);

  const loadProfile = async () => {
    if (!secretKey || secretKey.length !== 64 || !/^[0-9a-fA-F]+$/.test(secretKey)) {
      toast.error("Secret key must be 64 hex characters");
      return;
    }
    try {
      if (!publicDataProvider) throw new Error("Network not ready");
      const info = await getUserInfoFromSecretKey(publicDataProvider, CONFIG.REBELS_CONTRACT_ADDRESS, secretKey);
      setSecretKeyUserInfo(info);
      toast.success("Profile loaded");
    } catch (e: any) {
      toast.error(e?.message || "Failed to load profile");
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Identity, wallet, and network configuration</p>
        </div>
        <ModeToggle />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> Identity</CardTitle>
            <CardDescription>Secret key (in-memory) and reputation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="password"
              placeholder="Enter your secret key (64 hex characters)"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              className="font-mono"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Length: {secretKey.length}/64</span>
              <span>Valid: {secretKey.length === 64 && /^[0-9a-fA-F]+$/.test(secretKey) ? "Yes" : "No"}</span>
            </div>
            <Button onClick={loadProfile}>Load Profile</Button>
            <p className="text-xs text-muted-foreground">The key is never persisted and enables publishing and voting.</p>
          </CardContent>
        </Card>

        {/* Wallet */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Wallet</CardTitle>
            <CardDescription>Manage your session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={disconnect} className="gap-2">Disconnect</Button>
              <Button variant="outline" onClick={() => setOpen(true)} className="gap-2">Open Wallet</Button>
              <Button onClick={() => connectWallet("mnLace")} className="gap-2">Connect Lace</Button>
            </div>
            <div className="text-sm text-muted-foreground">Status: {hasConnectedWallet ? "Connected" : connectingWallet ? "Connecting..." : "Disconnected"}</div>
            <div className="text-xs font-mono bg-muted p-2 rounded">{walletName || "No wallet"}</div>
            <div className="text-xs font-mono bg-muted p-2 rounded break-all">{address || "No address"}</div>
          </CardContent>
        </Card>

        {/* Network */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Network</CardTitle>
            <CardDescription>Endpoints and proof server</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              {isProofServerOnline ? (<><Wifi className="h-4 w-4 text-green-500" /> Online</>) : (<><WifiOff className="h-4 w-4 text-red-500" /> Offline</>)}
            </div>
            <div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setUseCustomProofServer(!useCustomProofServer)}>
                <SwitchCamera className="h-4 w-4" /> {useCustomProofServer ? 'Using custom (ps.midnames.com)' : 'Using wallet default'}
              </Button>
            </div>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-start gap-2"><Server className="h-4 w-4 mt-0.5 opacity-50" /><div><div className="text-xs text-muted-foreground">Substrate Node</div><div className="truncate">{uris?.substrateNodeUri || 'Not available'}</div></div></div>
              <div className="flex items-start gap-2"><Server className="h-4 w-4 mt-0.5 opacity-50" /><div><div className="text-xs text-muted-foreground">Indexer (REST)</div><div className="truncate">{uris?.indexerUri || 'Not available'}</div></div></div>
              <div className="flex items-start gap-2"><Server className="h-4 w-4 mt-0.5 opacity-50" /><div><div className="text-xs text-muted-foreground">Indexer (WebSocket)</div><div className="truncate">{uris?.indexerWsUri || 'Not available'}</div></div></div>
              <div className="flex items-start gap-2"><Server className="h-4 w-4 mt-0.5 opacity-50" /><div><div className="text-xs text-muted-foreground">Proof Server</div><div className="truncate">{useCustomProofServer ? 'https://ps.midnames.com' : (uris?.proverServerUri || 'Not available')}</div></div></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Settings;