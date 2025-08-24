import { MidnightWallet } from "@/modules/midnight/wallet-widget";
import { useAssets, useWallet } from "@meshsdk/midnight-react";
import { ModeToggle } from "@/components/mode-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link2, Server, Wifi, WifiOff, Wallet, Key, SwitchCamera } from "lucide-react";
import { useAppSettings } from "@/contexts/app-settings";

export function Debug() {
  const {
    address,
    coinPublicKey,
    encryptionPublicKey,
    hasConnectedWallet,
    isProofServerOnline,
    uris,
    walletName,
  } = useAssets();
  const { connectingWallet, disconnect, setOpen, connectWallet } = useWallet();
  const { useCustomProofServer, setUseCustomProofServer } = useAppSettings();

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Debug Dashboard</h1>
          <p className="text-muted-foreground">Manage your wallet and view connection details</p>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Wallet Widget
              </CardTitle>
              <CardDescription>Interact with your wallet</CardDescription>
            </CardHeader>
            <CardContent>
              <MidnightWallet />
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle>Wallet Actions</CardTitle>
              <CardDescription>Manage your wallet connection</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button 
                  variant="outline" 
                  onClick={disconnect}
                  className="gap-2"
                >
                  <Link2 className="h-4 w-4" />
                  Disconnect
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setOpen(true)}
                  className="gap-2"
                >
                  <Wallet className="h-4 w-4" />
                  Open Wallet
                </Button>
                <Button 
                  onClick={() => connectWallet("mnLace")}
                  className="gap-2"
                >
                  <Wallet className="h-4 w-4" />
                  Connect Lace
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <Card className="border-border h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Connection Details
            </CardTitle>
            <CardDescription>Your wallet and network information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Proof Server</h3>
              <div className="flex items-center gap-2 text-sm">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setUseCustomProofServer(!useCustomProofServer)}>
                  <SwitchCamera className="h-4 w-4" />
                  {useCustomProofServer ? 'Using custom (ps.midnames.com)' : 'Using wallet default'}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Wallet Status</h3>
              <div className="flex items-center gap-2 text-sm">
                <div className={`h-2 w-2 rounded-full ${hasConnectedWallet ? 'bg-green-500' : 'bg-gray-500'}`} />
                {hasConnectedWallet ? 'Connected' : 'Disconnected'}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Proof Server</h3>
              <div className="flex items-center gap-2 text-sm">
                {isProofServerOnline ? (
                  <>
                    <Wifi className="h-4 w-4 text-green-500" />
                    <span>Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-red-500" />
                    <span>Offline</span>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Wallet Name</h3>
              <div className="bg-muted px-3 py-2 rounded-md text-sm font-mono">
                {walletName || 'Not connected'}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Address</h3>
              <div className="bg-muted px-3 py-2 rounded-md text-sm font-mono break-all">
                {address || 'Not connected'}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Connection Status</h3>
              <div className="flex items-center gap-2 text-sm">
                <div className={`h-2 w-2 rounded-full ${connectingWallet ? 'bg-yellow-500' : 'bg-gray-500'}`} />
                {connectingWallet ? 'Connecting...' : 'Idle'}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Coin Public Key</h3>
              <div className="bg-muted px-3 py-2 rounded-md text-sm font-mono break-all">
                {coinPublicKey || 'Not connected'}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Encryption Public Key</h3>
              <div className="bg-muted px-3 py-2 rounded-md text-sm font-mono break-all">
                {encryptionPublicKey || 'Not connected'}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Network Endpoints</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <Server className="h-4 w-4 mt-0.5 flex-shrink-0 opacity-50" />
                  <div>
                    <div className="text-xs text-muted-foreground">Substrate Node</div>
                    <div className="truncate">{uris?.substrateNodeUri || 'Not available'}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Server className="h-4 w-4 mt-0.5 flex-shrink-0 opacity-50" />
                  <div>
                    <div className="text-xs text-muted-foreground">Indexer (REST)</div>
                    <div className="truncate">{uris?.indexerUri || 'Not available'}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Server className="h-4 w-4 mt-0.5 flex-shrink-0 opacity-50" />
                  <div>
                    <div className="text-xs text-muted-foreground">Indexer (WebSocket)</div>
                    <div className="truncate">{uris?.indexerWsUri || 'Not available'}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Server className="h-4 w-4 mt-0.5 flex-shrink-0 opacity-50" />
                  <div>
                    <div className="text-xs text-muted-foreground">Proof Server</div>
                    <div className="truncate">{useCustomProofServer ? 'https://ps.midnames.com' : (uris?.proverServerUri || 'Not available')}</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
