import { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FlowStatus } from "@/components/flow-status";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { CONFIG } from "@/config";
import { useAuth } from "@/contexts/auth";
import { useAppSettings } from "@/contexts/app-settings";
import { useAssets, useWallet } from "@meshsdk/midnight-react";
import { logger } from "@/App";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import {
  WrappedPublicDataProvider,
  WrappedPrivateStateProvider,
  CachedFetchZkConfigProvider,
  noopProofClient,
  proofClient,
  ProviderCallbackAction,
} from "@meshsdk/midnight-core";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import type {
  BalancedTransaction,
  PrivateStateProvider,
  UnbalancedTransaction,
  WalletProvider,
  MidnightProvider,
  PublicDataProvider,
  MidnightProviders,
} from "@midnight-ntwrk/midnight-js-types";
import { createBalancedTx } from "@midnight-ntwrk/midnight-js-types";
import type { CoinInfo, TransactionId } from "@midnight-ntwrk/ledger";
import { Transaction as ZswapTransaction } from "@midnight-ntwrk/zswap";
import { Transaction } from "@midnight-ntwrk/ledger";
import { getLedgerNetworkId, getZswapNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { publishPost } from "@/lib/rebels";

const MAX_CONTENT = 2000;

export function Create() {
  const [postTitle, setPostTitle] = useState("");
  const [postSummary, setPostSummary] = useState("");
  const [postImageUrl, setPostImageUrl] = useState("");
  const [postBody, setPostBody] = useState("");
  const [postTags, setPostTags] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [flowMessage, setFlowMessage] = useState<string | undefined>(undefined);

  const { secretKey, secretKeyUserInfo } = useAuth();
  const { useCustomProofServer } = useAppSettings();
  const [contractAddress] = useState(CONFIG.REBELS_CONTRACT_ADDRESS);

  const { hasConnectedWallet, uris, coinPublicKey, encryptionPublicKey } = useAssets();
  const { midnightBrowserWalletInstance } = useWallet();

  const providerCallback = useCallback((action: ProviderCallbackAction): void => {
    const msg: Record<ProviderCallbackAction, string | undefined> = {
      proveTxStarted: "Proving transaction...",
      proveTxDone: undefined,
      balanceTxStarted: "Signing the transaction with Midnight Lace wallet...",
      balanceTxDone: undefined,
      downloadProverStarted: "Downloading prover key...",
      downloadProverDone: undefined,
      submitTxStarted: "Submitting transaction...",
      submitTxDone: undefined,
      watchForTxDataStarted: "Waiting for transaction finalization on blockchain...",
      watchForTxDataDone: undefined,
    };
    setFlowMessage(msg[action]);
  }, []);

  const privateStateProvider: PrivateStateProvider<any, any> = useMemo(
    () => new WrappedPrivateStateProvider(
      levelPrivateStateProvider({ privateStateStoreName: "rebels-private-state" }),
      logger
    ),
    []
  );

  const publicDataProvider: PublicDataProvider | undefined = useMemo(
    () => (uris ? new WrappedPublicDataProvider(
      indexerPublicDataProvider(uris.indexerUri, uris.indexerWsUri),
      providerCallback,
      logger
    ) : undefined),
    [uris, providerCallback]
  );

  const zkConfigProvider = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return new CachedFetchZkConfigProvider(
      `${window.location.origin}/midnight/rebels`,
      fetch.bind(window),
      () => {}
    );
  }, []);

  const proofProvider = useMemo(() => {
    if (useCustomProofServer) return httpClientProofProvider("https://ps.midnames.com");
    if (uris) return proofClient(uris.proverServerUri, providerCallback);
    return noopProofClient();
  }, [uris, providerCallback, useCustomProofServer]);

  const walletProvider: WalletProvider = useMemo(
    () => (midnightBrowserWalletInstance ? {
      coinPublicKey: coinPublicKey!,
      encryptionPublicKey: encryptionPublicKey!,
      balanceTx: (tx: UnbalancedTransaction, newCoins: CoinInfo[]): Promise<BalancedTransaction> => {
        providerCallback("balanceTxStarted");
        return midnightBrowserWalletInstance
          ._walletInstance!.balanceAndProveTransaction(
            ZswapTransaction.deserialize(tx.serialize(getLedgerNetworkId()), getZswapNetworkId()),
            newCoins
          )
          .then((zswapTx: any) => Transaction.deserialize(zswapTx.serialize(getZswapNetworkId()), getLedgerNetworkId()))
          .then(createBalancedTx)
          .finally(() => providerCallback("balanceTxDone"));
      },
    } : { coinPublicKey: "", encryptionPublicKey: "", balanceTx: () => Promise.reject(new Error("readonly")) }),
    [midnightBrowserWalletInstance, coinPublicKey, encryptionPublicKey, providerCallback]
  );

  const midnightProvider: MidnightProvider = useMemo(
    () => (midnightBrowserWalletInstance ? {
      submitTx: (tx: BalancedTransaction): Promise<TransactionId> => {
        providerCallback("submitTxStarted");
        return midnightBrowserWalletInstance
          ._walletInstance!.submitTransaction(tx)
          .finally(() => providerCallback("submitTxDone"));
      },
    } : { submitTx: () => Promise.reject(new Error("readonly")) as any }),
    [midnightBrowserWalletInstance, providerCallback]
  );

  const fullProviders: MidnightProviders<any, any, any> | undefined = useMemo(() => {
    return publicDataProvider && zkConfigProvider && hasConnectedWallet
      ? {
          privateStateProvider,
          publicDataProvider,
          zkConfigProvider: zkConfigProvider as any,
          proofProvider,
          walletProvider,
          midnightProvider,
        }
      : undefined;
  }, [publicDataProvider, zkConfigProvider, hasConnectedWallet, privateStateProvider, proofProvider, walletProvider, midnightProvider]);

  const composePostContent = () => {
    const parts: string[] = [];
    if (postTitle.trim()) parts.push(`# ${postTitle.trim()}`);
    if (postImageUrl.trim()) parts.push(`![image](${postImageUrl.trim()})`);
    if (postSummary.trim()) parts.push(`> ${postSummary.trim()}`);
  if (postTags.trim()) parts.push(`tags: ${postTags.trim()}`);
    if (postBody.trim()) parts.push(postBody.trim());
    return parts.join("\n\n");
  };
  const composedContent = composePostContent();

  const handlePublishPost = async () => {
    if (!fullProviders || !contractAddress || !composedContent.trim() || !secretKey) return;
    setIsPublishing(true);
    try {
      const result = await publishPost(fullProviders, contractAddress, composedContent.trim(), secretKey);
      if (result.success) {
        toast.success("Post published successfully", {
          description: result.transactionId ? `Tx: ${result.transactionId.slice(0, 8)}...${result.transactionId.slice(-8)}` : undefined,
        });
        setPostTitle("");
        setPostSummary("");
        setPostImageUrl("");
        setPostBody("");
      } else {
        toast.error(result.error || "Failed to publish post");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to publish post");
    } finally {
      setIsPublishing(false);
      setFlowMessage(undefined);
    }
  };

  return (
    <div className="min-h-screen bg-background py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="font-headline text-3xl">Create a new story</h1>
          <p className="text-sm text-muted-foreground">Compose your story with an optional image and summary. Contract: <span className="font-mono">{contractAddress.slice(0,8)}...{contractAddress.slice(-8)}</span></p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Editor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Title" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} disabled={isPublishing} className="font-headline text-lg" />
            <Input placeholder="Image URL (optional)" value={postImageUrl} onChange={(e) => setPostImageUrl(e.target.value)} disabled={isPublishing} />
            <Input placeholder="One-line summary (optional)" value={postSummary} onChange={(e) => setPostSummary(e.target.value)} disabled={isPublishing} />
            <Input placeholder="Topics/tags (comma-separated, e.g. drop, politics)" value={postTags} onChange={(e) => setPostTags(e.target.value)} disabled={isPublishing} />
            <Textarea placeholder="Write your story..." value={postBody} onChange={(e) => setPostBody(e.target.value)} className="min-h-[180px]" disabled={isPublishing} />
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                <div>{composedContent.length}/{MAX_CONTENT} characters</div>
                <div className={secretKeyUserInfo ? "text-green-600" : "text-red-500"}>
                  {secretKeyUserInfo ? "Secret key authenticated ✓" : "Secret key required (set in Profile) ✗"}
                </div>
              </div>
              <Button onClick={handlePublishPost} disabled={!postTitle.trim() || !postBody.trim() || composedContent.length > MAX_CONTENT || isPublishing || !secretKeyUserInfo}>
                {isPublishing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Publish
                  </>
                )}
              </Button>
            </div>
            {composedContent && (
              <div className="mt-2 p-3 border rounded-md bg-muted/30">
                <div className="text-xs text-muted-foreground mb-2">Preview</div>
                <Preview content={composedContent} />
              </div>
            )}
          </CardContent>
        </Card>

        <FlowStatus message={flowMessage} />
      </div>
    </div>
  );
}

function Preview({ content }: { content: string }) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  let title: string | undefined;
  let summary: string | undefined;
  let imageUrl: string | undefined;
  let tags: string[] = [];
  const body: string[] = [];

  for (const line of lines) {
    if (!title && line.startsWith("# ")) { title = line.slice(2).trim(); continue; }
    if (!imageUrl && line.startsWith("![image](") && line.endsWith(")")) { imageUrl = line.slice(9, -1); continue; }
    if (!summary && line.startsWith("> ")) { summary = line.slice(2).trim(); continue; }
    if (line.toLowerCase().startsWith("tags:")) { 
      const raw = line.slice(5).trim();
      tags = raw.split(/[,\s]+/).filter(Boolean);
      continue;
    }
    body.push(line);
  }

  return (
    <div className="space-y-3">
      {title && <h2 className="font-headline text-2xl leading-snug">{title}</h2>}
      {summary && <p className="text-sm text-muted-foreground border-l-2 pl-3">{summary}</p>}
      {imageUrl && (
        <div className="rounded-md overflow-hidden border bg-muted/30">
          <img src={imageUrl} alt="post image" className="w-full h-auto object-cover" />
        </div>
      )}
      {body.length > 0 && (
        <div className="prose prose-sm max-w-none">
          <p className="whitespace-pre-wrap">{body.join("\n")}</p>
        </div>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {tags.map((t) => (
            <span key={t} className="px-2 py-0.5 text-xs rounded bg-muted text-foreground/80 border">
              #{t.toLowerCase()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default Create;
