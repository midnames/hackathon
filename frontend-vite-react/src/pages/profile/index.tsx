import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trophy, User } from "lucide-react";
import { getUserInfoFromSecretKey } from "@/lib/rebels";
import { toast } from "sonner";
import { CONFIG } from "@/config";
import { useAuth } from "@/contexts/auth";
import { useAssets } from "@meshsdk/midnight-react";
import { WrappedPublicDataProvider } from "@meshsdk/midnight-core";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { logger } from "@/App";

export function Profile() {
  const { secretKey, setSecretKey, setSecretKeyUserInfo } = useAuth();
  const { uris } = useAssets();
  const [alias, setAlias] = useState<string | undefined>(undefined);
  const [reputation, setReputation] = useState<number | undefined>(undefined);

  const publicDataProvider = useMemo(() => {
    if (!uris) return undefined;
    return new WrappedPublicDataProvider(
  indexerPublicDataProvider(uris.indexerUri, uris.indexerWsUri),
  () => {},
  logger
    );
  }, [uris]);

  useEffect(() => {
    // Clear on mount
    setAlias(undefined);
    setReputation(undefined);
  }, []);

  const loadProfile = async () => {
    if (!secretKey || secretKey.length !== 64 || !/^[0-9a-fA-F]+$/.test(secretKey)) {
      toast.error("Secret key must be 64 hex characters");
      return;
    }
    try {
      if (!publicDataProvider) throw new Error("Network not ready");
      const info = await getUserInfoFromSecretKey(
        publicDataProvider,
        CONFIG.REBELS_CONTRACT_ADDRESS,
        secretKey
      );
      setAlias(info.alias);
      setReputation(info.reputation);
      setSecretKeyUserInfo(info);
      toast.success("Profile loaded");
    } catch (e: any) {
      toast.error(e?.message || "Failed to load profile");
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-headline text-3xl">Your Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your identity and view reputation</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Secret Key</CardTitle>
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
          <p className="text-xs text-muted-foreground">This key stays on-device and is used to publish and vote. After loading, you can publish from Headlines.</p>
        </CardContent>
      </Card>

      {(alias || reputation !== undefined) && (
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-blue-600">
                <User className="w-4 h-4" />
                <span>{alias || "No alias"}</span>
              </div>
              <div className="flex items-center gap-2 text-green-600">
                <Trophy className="w-4 h-4" />
                <span>Reputation: {reputation}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
