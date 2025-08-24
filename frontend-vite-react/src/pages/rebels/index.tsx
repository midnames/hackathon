import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import {
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Flag,
  User,
  Trophy,
  Plus,
  Send,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAssets, useWallet } from "@meshsdk/midnight-react";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import {
  WrappedPublicDataProvider,
  WrappedPrivateStateProvider,
  CachedFetchZkConfigProvider,
  noopProofClient,
  proofClient,
} from "@meshsdk/midnight-core";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { logger } from "@/App";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
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
import {
  getLedgerNetworkId,
  getZswapNetworkId,
} from "@midnight-ntwrk/midnight-js-network-id";
import { Transaction } from "@midnight-ntwrk/ledger";
import { ProviderCallbackAction } from "@meshsdk/midnight-core";
import {
  RebelsPrivateStateId,
  type PostWithMetadata,
  type UserInfo,
  type RebelsPrivateState,
  getAllPosts,
  getUserInfo,
  publishPost,
  votePlus,
  voteMinus,
  flagPost,
  deployRebelsContract,
  findDeployedRebelsContract,
  coinPublicKeyToHex,
  getUserInfoFromSecretKey,
  derivePublicKeyFromSecret,
  checkUserVote,
} from "@/lib/rebels";

// VotingButton component
interface VotingButtonProps {
  post: PostWithMetadata;
  voteType: "plus" | "minus";
  onVote: (postId: number, voteType: "plus" | "minus") => void;
  fullProviders: any;
  secretKeyUserInfo: UserInfo | null;
  votingStates: Record<number, "voting-plus" | "voting-minus" | null>;
  checkVoteStatus: (postId: number) => Promise<"plus" | "minus" | null>;
}

const VotingButton: React.FC<VotingButtonProps> = ({
  post,
  voteType,
  onVote,
  fullProviders,
  secretKeyUserInfo,
  votingStates,
  checkVoteStatus,
}) => {
  console.log(
    `[DEBUG] VotingButton ${voteType} for post ${post.postId} component mounted/re-rendered`
  );

  const [currentVote, setCurrentVote] = useState<"plus" | "minus" | null>(null);
  const [isCheckingVote, setIsCheckingVote] = useState(false);

  // Load vote status when component mounts or dependencies change
  useEffect(() => {
    console.log(
      `[DEBUG] VotingButton ${voteType} useEffect for post ${post.postId}:`,
      {
        hasFullProviders: !!fullProviders,
        hasSecretKeyUserInfo: !!secretKeyUserInfo,
        postId: post.postId,
        voteType,
      }
    );

    const loadVoteStatus = async () => {
      if (!fullProviders || !secretKeyUserInfo) {
        console.log(
          `[DEBUG] VotingButton ${voteType} post ${post.postId}: conditions not met, setting currentVote to null`
        );
        setCurrentVote(null);
        return;
      }

      console.log(
        `[DEBUG] VotingButton ${voteType} post ${post.postId}: starting vote status check`
      );
      setIsCheckingVote(true);
      try {
        const voteStatus = await checkVoteStatus(post.postId);
        console.log(
          `[DEBUG] VotingButton ${voteType} post ${post.postId}: vote status result:`,
          voteStatus
        );
        setCurrentVote(voteStatus);
      } catch (error) {
        console.error(
          `[DEBUG] VotingButton ${voteType} post ${post.postId}: Failed to load vote status:`,
          error
        );
      } finally {
        setIsCheckingVote(false);
        console.log(
          `[DEBUG] VotingButton ${voteType} post ${post.postId}: finished checking vote`
        );
      }
    };

    loadVoteStatus();
  }, [post.postId, fullProviders, secretKeyUserInfo, checkVoteStatus]);

  // Track previous voting state to detect when voting completes
  const prevVotingState = useRef(votingStates[post.postId]);
  useEffect(() => {
    const currentVotingState = votingStates[post.postId];

    // If voting just completed (was voting, now null), refresh status
    if (prevVotingState.current !== null && currentVotingState === null) {
      const refreshVoteStatus = async () => {
        try {
          const voteStatus = await checkVoteStatus(post.postId);
          setCurrentVote(voteStatus);
        } catch (error) {
          console.error("Failed to refresh vote status:", error);
        }
      };
      refreshVoteStatus();
    }

    prevVotingState.current = currentVotingState;
  }, [votingStates[post.postId], post.postId, checkVoteStatus]);

  const isCurrentlyVoting = votingStates[post.postId] === `voting-${voteType}`;
  const hasVoted = currentVote === "plus" || currentVote === "minus";
  const hasVotedThisType = currentVote === voteType;
  const isActiveVote = currentVote === voteType;

  const Icon = voteType === "plus" ? ThumbsUp : ThumbsDown;
  const label = voteType === "plus" ? "UP" : "DOWN";

  // Debug the disabled state - only disable if user has already voted (any type) since contract prevents multiple votes
  const isCurrentlyVotingThisPost = !!votingStates[post.postId]; // true if "voting-plus" or "voting-minus", false if undefined/null
  const isDisabled =
    !fullProviders ||
    !secretKeyUserInfo ||
    isCurrentlyVotingThisPost ||
    hasVoted ||
    isCheckingVote;

  console.log(`[DEBUG] VotingButton ${voteType} post ${post.postId} render:`, {
    isDisabled,
    fullProviders: !!fullProviders,
    secretKeyUserInfo: !!secretKeyUserInfo,
    votingState: votingStates[post.postId],
    isCurrentlyVotingThisPost,
    currentVote,
    hasVoted,
    isCheckingVote,
    isActiveVote,
  });

  return (
    <Button
      variant={isActiveVote ? "default" : "outline"}
      size="sm"
      onClick={() => onVote(post.postId, voteType)}
      disabled={isDisabled}
      className="flex items-center gap-1"
    >
      {isCurrentlyVoting ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : isCheckingVote ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-50" />
      ) : (
        <Icon className="w-4 h-4" />
      )}
      {label}
    </Button>
  );
};

// Contract address - you might want to make this configurable
const REBELS_CONTRACT_ADDRESS =
  process.env.REACT_APP_REBELS_CONTRACT_ADDRESS ||
  "020028186857b4c80c1a6a46a51f167f6b16e0527f41db20048044017f78e4d62c6d";

export function Rebels() {
  // State management
  const [posts, setPosts] = useState<PostWithMetadata[]>([]);
  const [newPostContent, setNewPostContent] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [contractAddress, setContractAddress] = useState(
    REBELS_CONTRACT_ADDRESS
  );
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [secretKeyUserInfo, setSecretKeyUserInfo] = useState<UserInfo | null>(
    null
  );
  const [flowMessage, setFlowMessage] = useState<string | undefined>(undefined);
  const [operationResult, setOperationResult] = useState<any>(null);
  const [votingStates, setVotingStates] = useState<
    Record<number, "voting-plus" | "voting-minus" | null>
  >({});
  const [useCustomProofServer, setUseCustomProofServer] = useState(false);

  const { hasConnectedWallet, uris, coinPublicKey, encryptionPublicKey } =
    useAssets();
  const { midnightBrowserWalletInstance } = useWallet();

  // Provider callback for transaction flow messages
  const actionMessages = useMemo<
    Record<ProviderCallbackAction, string | undefined>
  >(
    () => ({
      proveTxStarted: "Proving transaction...",
      proveTxDone: undefined,
      balanceTxStarted: "Signing the transaction with Midnight Lace wallet...",
      balanceTxDone: undefined,
      downloadProverStarted: "Downloading prover key...",
      downloadProverDone: undefined,
      submitTxStarted: "Submitting transaction...",
      submitTxDone: undefined,
      watchForTxDataStarted:
        "Waiting for transaction finalization on blockchain...",
      watchForTxDataDone: undefined,
    }),
    []
  );

  const providerCallback = useCallback(
    (action: ProviderCallbackAction): void => {
      setFlowMessage(actionMessages[action]);
    },
    [actionMessages]
  );

  // Private state provider for Rebels contract
  const privateStateProvider: PrivateStateProvider<
    typeof RebelsPrivateStateId,
    RebelsPrivateState
  > = useMemo(
    () =>
      new WrappedPrivateStateProvider(
        levelPrivateStateProvider({
          privateStateStoreName: "rebels-private-state",
        }),
        logger
      ),
    [logger]
  );

  // Public data provider with callback
  const publicDataProvider: PublicDataProvider | undefined = useMemo(
    () =>
      uris
        ? new WrappedPublicDataProvider(
            indexerPublicDataProvider(uris.indexerUri, uris.indexerWsUri),
            providerCallback,
            logger
          )
        : undefined,
    [uris, providerCallback, logger]
  );

  // ZK Config provider for Rebels contract
  const zkConfigProvider = useMemo(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    return new CachedFetchZkConfigProvider(
      `${window.location.origin}/midnight/rebels`,
      fetch.bind(window),
      () => {}
    );
  }, []);

  // Proof provider with custom server option
  const proofProvider = useMemo(() => {
    if (useCustomProofServer) {
      console.log("[DEBUG] Using custom proof server: https://ps.midnames.com");
      return httpClientProofProvider("https://ps.midnames.com");
    } else if (uris) {
      console.log(
        "[DEBUG] Using wallet proof server URI:",
        uris.proverServerUri
      );
      return proofClient(uris.proverServerUri, providerCallback);
    } else {
      console.log("[DEBUG] No URIs available, using noop proof client");
      return noopProofClient();
    }
  }, [uris, providerCallback, useCustomProofServer]);

  // Wallet provider with real transaction capabilities
  const walletProvider: WalletProvider = useMemo(
    () =>
      midnightBrowserWalletInstance
        ? {
            coinPublicKey: coinPublicKey!,
            encryptionPublicKey: encryptionPublicKey!,
            balanceTx: (
              tx: UnbalancedTransaction,
              newCoins: CoinInfo[]
            ): Promise<BalancedTransaction> => {
              providerCallback("balanceTxStarted");
              return midnightBrowserWalletInstance
                ._walletInstance!.balanceAndProveTransaction(
                  ZswapTransaction.deserialize(
                    tx.serialize(getLedgerNetworkId()),
                    getZswapNetworkId()
                  ),
                  newCoins
                )
                .then((zswapTx: any) =>
                  Transaction.deserialize(
                    zswapTx.serialize(getZswapNetworkId()),
                    getLedgerNetworkId()
                  )
                )
                .then(createBalancedTx)
                .finally(() => providerCallback("balanceTxDone"));
            },
          }
        : {
            coinPublicKey: "",
            encryptionPublicKey: "",
            balanceTx: () => Promise.reject(new Error("readonly")),
          },
    [
      midnightBrowserWalletInstance,
      coinPublicKey,
      encryptionPublicKey,
      providerCallback,
    ]
  );

  // Midnight provider for transaction submission
  const midnightProvider: MidnightProvider = useMemo(
    () =>
      midnightBrowserWalletInstance
        ? {
            submitTx: (tx: BalancedTransaction): Promise<TransactionId> => {
              providerCallback("submitTxStarted");
              return midnightBrowserWalletInstance
                ._walletInstance!.submitTransaction(tx)
                .finally(() => providerCallback("submitTxDone"));
            },
          }
        : {
            submitTx: (): Promise<TransactionId> =>
              Promise.reject(new Error("readonly")),
          },
    [midnightBrowserWalletInstance, providerCallback]
  );

  // Complete providers object for write operations
  const fullProviders:
    | MidnightProviders<any, typeof RebelsPrivateStateId, RebelsPrivateState>
    | undefined = useMemo(() => {
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
  }, [
    privateStateProvider,
    publicDataProvider,
    proofProvider,
    zkConfigProvider,
    walletProvider,
    midnightProvider,
    hasConnectedWallet,
  ]);

  // Find contract address on startup
  useEffect(() => {
    if (publicDataProvider && !contractAddress) {
      const findContract = async () => {
        try {
          const foundAddress = await findDeployedRebelsContract({
            publicDataProvider,
          });
          if (foundAddress) {
            setContractAddress(foundAddress);
          }
        } catch (error) {
          console.error("Failed to find contract:", error);
        }
      };
      findContract();
    }
  }, [publicDataProvider, contractAddress]);

  // Load posts when contract is ready
  useEffect(() => {
    if (publicDataProvider && contractAddress) {
      loadPosts();
    }
  }, [publicDataProvider, contractAddress, secretKey, coinPublicKey]);

  // Load user info when we have a connected wallet and contract
  useEffect(() => {
    if (publicDataProvider && contractAddress && coinPublicKey) {
      loadUserInfo();
    }
  }, [publicDataProvider, contractAddress, coinPublicKey]);

  // Load user info from secret key when secret key changes
  useEffect(() => {
    console.log("[DEBUG] secretKey useEffect triggered:", {
      hasPublicDataProvider: !!publicDataProvider,
      hasContractAddress: !!contractAddress,
      secretKeyLength: secretKey?.length,
    });

    // Vote status will be refreshed by individual VotingButton components
    console.log(
      "[DEBUG] Secret key changed - voting buttons will refresh their status"
    );

    loadSecretKeyUserInfo();
  }, [publicDataProvider, contractAddress, secretKey]);

  // Function to check vote status for a specific post
  const checkVoteStatus = useCallback(
    async (postId: number): Promise<"plus" | "minus" | null> => {
      console.log(`[DEBUG] checkVoteStatus called for post ${postId}:`, {
        hasPublicDataProvider: !!publicDataProvider,
        hasContractAddress: !!contractAddress,
        hasSecretKey: !!secretKey,
        secretKeyLength: secretKey?.length,
        secretKeyValid: secretKey ? /^[0-9a-fA-F]+$/.test(secretKey) : false,
      });

      if (
        !publicDataProvider ||
        !contractAddress ||
        !secretKey ||
        secretKey.length !== 64 ||
        !/^[0-9a-fA-F]+$/.test(secretKey)
      ) {
        console.log(
          `[DEBUG] checkVoteStatus for post ${postId}: conditions not met, returning null`
        );
        return null;
      }

      try {
        console.log(
          `[DEBUG] checkVoteStatus for post ${postId}: deriving public key`
        );
        const userPublicKey = derivePublicKeyFromSecret(secretKey);
        console.log(
          `[DEBUG] checkVoteStatus for post ${postId}: calling checkUserVote with public key ${userPublicKey.substring(0, 8)}...`
        );
        const result = await checkUserVote(
          publicDataProvider,
          contractAddress,
          userPublicKey,
          postId
        );
        console.log(
          `[DEBUG] checkVoteStatus for post ${postId}: checkUserVote returned:`,
          result
        );
        return result;
      } catch (error) {
        console.error(
          `[DEBUG] checkVoteStatus for post ${postId}: Failed to check vote status:`,
          error
        );
        return null;
      }
    },
    [publicDataProvider, contractAddress, secretKey]
  );

  // Debug log when secretKeyUserInfo changes
  useEffect(() => {
    console.log("[DEBUG] secretKeyUserInfo changed:", {
      hasInfo: !!secretKeyUserInfo,
      reputation: secretKeyUserInfo?.reputation,
      alias: secretKeyUserInfo?.alias,
    });
  }, [secretKeyUserInfo]);

  const loadPosts = async () => {
    if (!publicDataProvider || !contractAddress) return;

    setIsLoading(true);
    try {
      const fetchedPosts = await getAllPosts(
        publicDataProvider,
        contractAddress
      );
      setPosts(fetchedPosts);
    } catch (error) {
      console.error("Failed to load posts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserInfo = async () => {
    if (!publicDataProvider || !contractAddress || !coinPublicKey) return;

    try {
      const userKeyHex = coinPublicKeyToHex(coinPublicKey);
      const info = await getUserInfo(
        publicDataProvider,
        contractAddress,
        userKeyHex
      );
      setUserInfo(info);
    } catch (error) {
      console.error("Failed to load user info:", error);
    }
  };

  const loadSecretKeyUserInfo = async () => {
    console.log("[DEBUG] loadSecretKeyUserInfo called:", {
      hasPublicDataProvider: !!publicDataProvider,
      hasContractAddress: !!contractAddress,
      contractAddress: contractAddress?.substring(0, 8) + "...",
      hasSecretKey: !!secretKey,
      secretKeyLength: secretKey?.length,
      secretKeyValid:
        secretKey &&
        secretKey.length === 64 &&
        /^[0-9a-fA-F]+$/.test(secretKey),
    });

    if (
      !publicDataProvider ||
      !contractAddress ||
      !secretKey ||
      secretKey.length !== 64 ||
      !/^[0-9a-fA-F]+$/.test(secretKey)
    ) {
      console.log(
        "[DEBUG] loadSecretKeyUserInfo: conditions not met, setting secretKeyUserInfo to null"
      );
      setSecretKeyUserInfo(null);
      return;
    }

    try {
      console.log(
        "[DEBUG] loadSecretKeyUserInfo: calling getUserInfoFromSecretKey"
      );
      const info = await getUserInfoFromSecretKey(
        publicDataProvider,
        contractAddress,
        secretKey
      );
      console.log("[DEBUG] loadSecretKeyUserInfo: setting secretKeyUserInfo:", {
        hasInfo: !!info,
        reputation: info?.reputation,
        hasAlias: !!info?.alias,
      });
      setSecretKeyUserInfo(info);
    } catch (error) {
      console.error("[DEBUG] Failed to load secret key user info:", error);
      setSecretKeyUserInfo(null);
    }
  };

  const handlePublishPost = async () => {
    console.log("[DEBUG] handlePublishPost called:", {
      hasFullProviders: !!fullProviders,
      hasContractAddress: !!contractAddress,
      hasContent: !!newPostContent.trim(),
      contentLength: newPostContent.trim().length,
      hasSecretKeyUserInfo: !!secretKeyUserInfo,
      hasSecretKey: !!secretKey,
      secretKeyLength: secretKey?.length,
    });

    if (
      !fullProviders ||
      !contractAddress ||
      !newPostContent.trim() ||
      !secretKey
    ) {
      console.log(
        "[DEBUG] handlePublishPost: conditions not met, returning early"
      );
      return;
    }

    console.log("[DEBUG] handlePublishPost: starting publish process");
    setIsPublishing(true);
    setOperationResult(null);
    try {
      const result = await publishPost(
        fullProviders,
        contractAddress,
        newPostContent.trim(),
        secretKey
      );

      if (result.success) {
        setOperationResult({
          success: true,
          message: "Post published successfully!",
          transactionId: result.transactionId,
        });
        setNewPostContent("");
        // Reload posts after successful publish
        setTimeout(() => loadPosts(), 2000); // Give some time for blockchain to update
      } else {
        setOperationResult({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      setOperationResult({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsPublishing(false);
      setFlowMessage(undefined);
    }
  };

  const handleVote = async (postId: number, voteType: "plus" | "minus") => {
    console.log("[DEBUG] handleVote called:", {
      postId,
      voteType,
      hasFullProviders: !!fullProviders,
      hasContractAddress: !!contractAddress,
      hasSecretKeyUserInfo: !!secretKeyUserInfo,
      hasSecretKey: !!secretKey,
    });

    if (
      !fullProviders ||
      !contractAddress ||
      !secretKeyUserInfo ||
      !secretKey
    ) {
      console.log("[DEBUG] handleVote: conditions not met, returning early");
      return;
    }

    console.log("[DEBUG] handleVote: starting vote process");
    setVotingStates((prev) => ({ ...prev, [postId]: `voting-${voteType}` }));
    setOperationResult(null);

    try {
      const result =
        voteType === "plus"
          ? await votePlus(fullProviders, contractAddress, postId, secretKey)
          : await voteMinus(fullProviders, contractAddress, postId, secretKey);

      if (result.success) {
        setOperationResult({
          success: true,
          message: `${voteType === "plus" ? "Upvoted" : "Downvoted"} successfully!`,
          transactionId: result.transactionId,
        });

        // VotingButton components will automatically refresh their status

        // Reload posts to get updated counts and refresh user info
        setTimeout(() => {
          loadPosts();
          loadSecretKeyUserInfo();
        }, 2000);
      } else {
        setOperationResult({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      setOperationResult({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setVotingStates((prev) => ({ ...prev, [postId]: null }));
      setFlowMessage(undefined);
    }
  };

  const handleFlagPost = async (postId: number) => {
    if (!fullProviders || !contractAddress || !secretKeyUserInfo || !secretKey)
      return;

    try {
      const result = await flagPost(
        fullProviders,
        contractAddress,
        postId,
        secretKey
      );

      if (result.success) {
        setOperationResult({
          success: true,
          message: "Post flagged successfully!",
          transactionId: result.transactionId,
        });
      } else {
        setOperationResult({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      setOperationResult({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setFlowMessage(undefined);
    }
  };

  const formatAddress = (address: string) => {
    if (address.length > 16) {
      return `${address.slice(0, 8)}...${address.slice(-8)}`;
    }
    return address;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mb-6 mx-auto">
            <MessageSquare className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Rebels Platform
          </h1>
          <p className="text-xl text-muted-foreground">
            Decentralized journalism with community voting
          </p>
        </div>

        {/* Secret Key Input */}
        <div className="mb-6">
          <Card>
            <CardContent className="py-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4" />
                  <span className="font-medium">Secret Key Authentication</span>
                </div>
                <Input
                  type="password"
                  placeholder="Enter your secret key (64 hex characters)"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  className="font-mono"
                />
                <div className="flex items-center justify-between text-sm">
                  <div
                    className={`${secretKey.length === 64 && /^[0-9a-fA-F]+$/.test(secretKey) ? "text-green-600" : "text-red-500"}`}
                  >
                    Secret key: {secretKey.length}/64 chars{" "}
                    {secretKey.length === 64 && /^[0-9a-fA-F]+$/.test(secretKey)
                      ? "✓"
                      : "✗"}
                  </div>
                  {secretKeyUserInfo && (
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1 text-green-600">
                        <Trophy className="w-4 h-4" />
                        Reputation: {secretKeyUserInfo.reputation}
                      </span>
                      {secretKeyUserInfo.alias && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <User className="w-4 h-4" />
                          {secretKeyUserInfo.alias}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Debug Panel */}
        {secretKey && (
          <div className="mb-6">
            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader>
                <CardTitle className="text-yellow-800 text-sm">
                  🐛 Debug Information
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <strong>Secret Key:</strong>
                    <div>Length: {secretKey.length}/64</div>
                    <div>
                      Valid Hex:{" "}
                      {/^[0-9a-fA-F]+$/.test(secretKey) ? "✅" : "❌"}
                    </div>
                    <div>
                      Valid Format:{" "}
                      {secretKey.length === 64 &&
                      /^[0-9a-fA-F]+$/.test(secretKey)
                        ? "✅"
                        : "❌"}
                    </div>
                  </div>
                  <div>
                    <strong>User Info:</strong>
                    <div>
                      Has secretKeyUserInfo: {secretKeyUserInfo ? "✅" : "❌"}
                    </div>
                    <div>
                      Reputation: {secretKeyUserInfo?.reputation || "N/A"}
                    </div>
                    <div>
                      Has Alias: {secretKeyUserInfo?.alias ? "✅" : "❌"}
                    </div>
                  </div>
                  <div>
                    <strong>Providers:</strong>
                    <div>
                      publicDataProvider: {publicDataProvider ? "✅" : "❌"}
                    </div>
                    <div>fullProviders: {fullProviders ? "✅" : "❌"}</div>
                    <div>
                      hasConnectedWallet: {hasConnectedWallet ? "✅" : "❌"}
                    </div>
                    <div>
                      Proof Server:{" "}
                      {useCustomProofServer
                        ? "Custom (ps.midnames.com)"
                        : "Wallet (localhost)"}
                    </div>
                  </div>
                  <div>
                    <strong>Contract:</strong>
                    <div>
                      Address:{" "}
                      {contractAddress
                        ? contractAddress.substring(0, 8) + "..."
                        : "❌"}
                    </div>
                    <div>
                      Coin Public Key:{" "}
                      {coinPublicKey
                        ? coinPublicKey.substring(0, 8) + "..."
                        : "❌"}
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-2 bg-yellow-100 rounded">
                  <strong>Voting States:</strong>
                  <div>votingStates: {JSON.stringify(votingStates)}</div>
                  <div>Total posts loaded: {posts.length}</div>
                  {posts.length > 0 && (
                    <div>
                      <strong>First post vote button states:</strong>
                      <div>Post ID: {posts[0].postId}</div>
                      <div>
                        Currently voting:{" "}
                        {votingStates[posts[0].postId] || "none"}
                      </div>
                      <div>
                        Note: Vote status is now checked directly by each button
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-2 p-2 bg-yellow-100 rounded">
                  <strong>Publish Button:</strong>
                  <div>Content length: {newPostContent.trim().length}</div>
                  <div>
                    Has secretKeyUserInfo: {!!secretKeyUserInfo ? "✅" : "❌"}
                  </div>
                  <div>
                    Button disabled:{" "}
                    {!newPostContent.trim() ||
                    newPostContent.length > 1000 ||
                    !secretKeyUserInfo
                      ? "🔴 YES"
                      : "🟢 NO"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Proof Server Toggle */}
        <div className="mb-6">
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Proof Server Configuration
                  </p>
                  <p className="text-xs text-blue-600">
                    {useCustomProofServer
                      ? "Using custom proof server (ps.midnames.com) - same as CLI script"
                      : "Using wallet proof server (localhost) - default Lace behavior"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUseCustomProofServer(!useCustomProofServer)}
                  className="ml-4"
                >
                  {useCustomProofServer
                    ? "Use Wallet Server"
                    : "Use Custom Server"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Connection Status */}
        <div className="mb-6">
          {!publicDataProvider ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground">
                Loading network connection...
              </p>
            </div>
          ) : (
            <div
              className={`text-center py-3 px-4 rounded-lg border ${
                fullProviders
                  ? "bg-green-50 border-green-200 text-green-800"
                  : hasConnectedWallet
                    ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                    : "bg-blue-50 border-blue-200 text-blue-800"
              }`}
            >
              {fullProviders ? (
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>Wallet Connected - All operations enabled</span>
                  {userInfo && (
                    <div className="flex items-center gap-4 ml-4">
                      <span className="flex items-center gap-1">
                        <Trophy className="w-4 h-4" />
                        Reputation: {userInfo.reputation}
                      </span>
                      {userInfo.alias && (
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {userInfo.alias}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : hasConnectedWallet ? (
                <p className="flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Loading providers... Write operations will be available soon
                </p>
              ) : (
                <p className="flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Connect wallet to publish posts and vote
                </p>
              )}
            </div>
          )}
        </div>

        {/* Contract Address Display */}
        {contractAddress && (
          <div className="mb-6 p-3 bg-muted/20 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Contract:</strong>{" "}
              <span className="font-mono">
                {formatAddress(contractAddress)}
              </span>
            </p>
          </div>
        )}

        {/* Flow Message */}
        {flowMessage && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              {flowMessage}
            </p>
          </div>
        )}

        {/* Operation Result */}
        {operationResult && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              operationResult.success
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <p
              className={`font-medium ${
                operationResult.success ? "text-green-800" : "text-red-800"
              }`}
            >
              {operationResult.success
                ? operationResult.message
                : `Error: ${operationResult.error}`}
            </p>
            {operationResult.transactionId && (
              <p className="text-sm mt-1 text-green-700">
                Transaction: {formatAddress(operationResult.transactionId)}
              </p>
            )}
          </div>
        )}

        {/* Publish Post Section */}
        {fullProviders && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Publish New Post</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3">
                <textarea
                  placeholder="Share your story with the world..."
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  className="min-h-[100px] w-full px-3 py-2 border rounded-md resize-vertical"
                  disabled={isPublishing}
                />
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    <div>{newPostContent.length}/1000 characters</div>
                    <div
                      className={`${secretKeyUserInfo ? "text-green-600" : "text-red-500"}`}
                    >
                      {secretKeyUserInfo
                        ? "Secret key authenticated ✓"
                        : "Please enter a valid secret key above ✗"}
                    </div>
                  </div>
                  <Button
                    onClick={handlePublishPost}
                    disabled={
                      isPublishing ||
                      !newPostContent.trim() ||
                      newPostContent.length > 1000 ||
                      !secretKeyUserInfo
                    }
                    className="px-6"
                  >
                    {isPublishing ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Publish
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Posts Feed */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading posts...</p>
            </div>
          ) : posts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No posts yet. Be the first to share your story!
                </p>
              </CardContent>
            </Card>
          ) : (
            posts.map((post) => (
              <Card key={post.postId} className="p-6">
                <div className="space-y-4">
                  {/* Post Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Post #{post.postId} by {formatAddress(post.author)}
                      </p>
                      <div className="flex items-center gap-4 mt-1">
                        <span
                          className={`text-lg font-bold ${
                            post.score > 0
                              ? "text-green-600"
                              : post.score < 0
                                ? "text-red-600"
                                : "text-muted-foreground"
                          }`}
                        >
                          Score: {post.score}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          +{post.plusVotes} / -{post.minusVotes}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Post Content */}
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap">{post.content}</p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    {/* Upvote Button */}
                    <VotingButton
                      post={post}
                      voteType="plus"
                      onVote={handleVote}
                      fullProviders={fullProviders}
                      secretKeyUserInfo={secretKeyUserInfo}
                      votingStates={votingStates}
                      checkVoteStatus={checkVoteStatus}
                    />

                    {/* Downvote Button */}
                    <VotingButton
                      post={post}
                      voteType="minus"
                      onVote={handleVote}
                      fullProviders={fullProviders}
                      secretKeyUserInfo={secretKeyUserInfo}
                      votingStates={votingStates}
                      checkVoteStatus={checkVoteStatus}
                    />

                    {/* Flag Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFlagPost(post.postId)}
                      disabled={!fullProviders || !secretKeyUserInfo}
                      className="flex items-center gap-1 text-muted-foreground hover:text-orange-600"
                    >
                      <Flag className="w-4 h-4" />
                      Flag
                    </Button>

                    {/* Vote Status will be shown by VotingButton components */}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Refresh Button */}
        <div className="mt-8 text-center">
          <Button
            variant="outline"
            onClick={loadPosts}
            disabled={isLoading || !publicDataProvider || !contractAddress}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Refresh Posts
          </Button>
        </div>
      </div>
    </div>
  );
}
