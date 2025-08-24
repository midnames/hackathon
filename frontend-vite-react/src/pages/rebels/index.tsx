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
  Trophy,
  
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Users,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
// Publish form moved to /create
import { toast } from "sonner";
import { CONFIG } from "@/config";
import { Skeleton } from "@/components/ui/skeleton";
import { FlowStatus } from "@/components/flow-status";
import { useAppSettings } from "@/contexts/app-settings";
import { useAuth } from "@/contexts/auth";
import { Link } from "react-router-dom";
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
  type PostWithMetadata,
  type UserInfo,
  getAllPosts,
  getUserInfo,
  votePlus,
  voteMinus,
  flagPost,
  findDeployedRebelsContract,
  getUserInfoFromSecretKey,
  derivePublicKeyFromSecret,
  checkUserVote,
  suggestNewUser,
  getReferralCount,
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

// Contract address via Vite env (fallback in CONFIG)
const REBELS_CONTRACT_ADDRESS = CONFIG.REBELS_CONTRACT_ADDRESS;

export function Rebels() {
  // State management
  const [posts, setPosts] = useState<PostWithMetadata[]>([]);
  // Post creation moved to /create
  const { secretKey, secretKeyUserInfo, setSecretKeyUserInfo } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  const [contractAddress, setContractAddress] = useState(
    REBELS_CONTRACT_ADDRESS
  );
  // Map author publicKey -> UserInfo for displaying trust next to posts
  const [authorInfoMap, setAuthorInfoMap] = useState<Record<string, UserInfo>>({});
  const [flowMessage, setFlowMessage] = useState<string | undefined>(undefined);
  const [operationResult, setOperationResult] = useState<any>(null);
  const [votingStates, setVotingStates] = useState<
    Record<number, "voting-plus" | "voting-minus" | null>
  >({});
  const { useCustomProofServer } = useAppSettings();
  const [activeTab, setActiveTab] = useState<"posts" | "referrals">(
    "posts"
  );
  const [newUserPublicKey, setNewUserPublicKey] = useState("");
  const [secretKeyToConvert, setSecretKeyToConvert] = useState("");
  const [convertedPublicKey, setConvertedPublicKey] = useState("");
  const [referralCount, setReferralCount] = useState<number>(2);
  const [isReferring, setIsReferring] = useState(false);

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
  const privateStateProvider: PrivateStateProvider<any, any> = useMemo(
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
    | MidnightProviders<any, any, any>
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

  // Build author trust map whenever posts load
  useEffect(() => {
    if (!publicDataProvider || !contractAddress || posts.length === 0) return;
    const uniqueAuthors = Array.from(new Set(posts.map((p) => p.author)));
    let cancelled = false;
    (async () => {
      try {
        const entries = await Promise.all(
          uniqueAuthors.map(async (author) => {
            try {
              const info = await getUserInfo(publicDataProvider, contractAddress, author);
              return [author, info] as const;
            } catch {
              return [author, { publicKey: author, reputation: 1000, hasVotedPlus: false, hasVotedMinus: false }] as const;
            }
          })
        );
        if (!cancelled) setAuthorInfoMap(Object.fromEntries(entries));
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [publicDataProvider, contractAddress, posts]);

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

  // Debug log when secretKeyUserInfo changes
  useEffect(() => {
    console.log("[DEBUG] secretKeyUserInfo changed:", {
      hasInfo: !!secretKeyUserInfo,
      reputation: secretKeyUserInfo?.reputation,
      alias: secretKeyUserInfo?.alias,
    });

    // Load referral count when user info is available
    if (secretKeyUserInfo && fullProviders && contractAddress) {
      loadReferralCount();
    }
  }, [secretKeyUserInfo, fullProviders, contractAddress]);

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

  // removed wallet-based user info fetch; trust comes via Profile + per-author map

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

  // Publish helpers removed; handled in /create

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
        toast.success(
          voteType === "plus" ? "Upvoted successfully" : "Downvoted successfully",
          {
            description: result.transactionId
              ? `Tx: ${formatAddress(result.transactionId)}`
              : undefined,
          }
        );

        // VotingButton components will automatically refresh their status

        // Reload posts to get updated counts and refresh user info
        setTimeout(() => {
          loadPosts();
          loadSecretKeyUserInfo();
        }, 2000);
      } else {
  toast.error(result.error || "Failed to vote");
      }
    } catch (error) {
  toast.error(error instanceof Error ? error.message : String(error));
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
        toast.success("Post flagged successfully", {
          description: result.transactionId
            ? `Tx: ${formatAddress(result.transactionId)}`
            : undefined,
        });
      } else {
        toast.error(result.error || "Failed to flag post");
      }
    } catch (error) {
  toast.error(error instanceof Error ? error.message : String(error));
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

  // Handle secret key to public key conversion
  const handleConvertSecretKey = () => {
    if (secretKeyToConvert.trim().length === 64) {
      try {
        const publicKey = derivePublicKeyFromSecret(secretKeyToConvert);
        setConvertedPublicKey(publicKey);
      } catch (error) {
        setConvertedPublicKey("Error: Invalid secret key");
      }
    } else {
      setConvertedPublicKey("Error: Secret key must be 64 hex characters");
    }
  };

  // Handle referral submission
  const handleReferral = async () => {
    if (
      !fullProviders ||
      !contractAddress ||
      !secretKeyUserInfo ||
      !secretKey
    ) {
      toast.error("Missing required providers or user information");
      return;
    }

    if (!newUserPublicKey.trim()) {
      toast.error("Please enter a public key to refer");
      return;
    }

    if (newUserPublicKey.length !== 64) {
      toast.error("Public key must be 64 hex characters");
      return;
    }

    setIsReferring(true);
    setFlowMessage("Submitting referral...");

    try {
      const result = await suggestNewUser(
        fullProviders,
        contractAddress,
        newUserPublicKey,
        secretKey
      );

      if (result.success) {
        toast.success("Referral submitted", {
          description: result.txHash ? `Tx: ${formatAddress(result.txHash)}` : undefined,
        });
        setNewUserPublicKey("");
        // Refresh referral count
        setTimeout(() => loadReferralCount(), 1000);
      } else {
        toast.error(result.error || "Failed to submit referral");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsReferring(false);
      setFlowMessage(undefined);
    }
  };

  // Load referral count for the current user
  const loadReferralCount = async () => {
    if (!fullProviders || !contractAddress || !secretKeyUserInfo) return;

    try {
      const count = await getReferralCount(
        fullProviders.publicDataProvider,
        contractAddress,
        secretKeyUserInfo.publicKey
      );
      setReferralCount(count);
    } catch (error) {
      console.error("Failed to load referral count:", error);
    }
  };

  // Check vote status for a specific post
  const checkVoteStatus = useCallback(
    async (postId: number): Promise<"plus" | "minus" | null> => {
      if (!fullProviders || !secretKeyUserInfo) return null;

      try {
        return await checkUserVote(
          fullProviders.publicDataProvider,
          contractAddress,
          secretKeyUserInfo.publicKey,
          postId
        );
      } catch (error) {
        console.error("Failed to check vote status:", error);
        return null;
      }
    },
    [fullProviders, contractAddress, secretKeyUserInfo]
  );

  return (
    <div className="min-h-screen bg-background py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 text-accent mb-3">
            <MessageSquare className="w-6 h-6" />
            <span className="uppercase tracking-widest text-xs">Latest Dispatch</span>
          </div>
          <h1 className="font-headline text-4xl md:text-5xl leading-tight">
            Censorship‑resistant, community‑moderated reporting
          </h1>
          <p className="text-base text-muted-foreground mt-3">
            Publish stories, vote on credibility, and build a reputation—on chain.
          </p>
          <div className="mt-4">
            <Button asChild>
              <Link to="/create">➕ Create new story</Link>
            </Button>
          </div>
        </div>

  {/* Secret Key moved to Profile page */}

  {/* Debug panel moved off the main page */}

  {/* Proof Server settings moved to Debug page */}

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

        {/* Your trust score (if secret key loaded in Profile) */}
        {secretKeyUserInfo && (
          <div className="mb-6 p-3 bg-muted/20 rounded-lg flex items-center justify-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-green-700">
              <Trophy className="w-4 h-4" />
              Your Trust: {secretKeyUserInfo.reputation}
            </span>
            {secretKeyUserInfo.alias && (
              <span className="text-muted-foreground">Alias: {secretKeyUserInfo.alias}</span>
            )}
          </div>
        )}

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

  {/* Flow status (compact floating) */}
  <FlowStatus message={flowMessage} />

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

        {/* Tab Navigation */}
    {fullProviders && (
          <div className="mb-8">
            <div className="flex space-x-1 bg-muted p-1 rounded-lg mb-6">
      {(["posts", "referrals"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === tab
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "posts" && "📝 Posts"}
                  {tab === "referrals" && "👥 Referrals"}
                </button>
              ))}
            </div>

            {/* Posts Tab */}
            {activeTab === "posts" && (
              <>
                {/* Posts Feed */}
                <div className="space-y-4">
                  {isLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <Card key={i} className="p-6">
                          <div className="space-y-3">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-6 w-24" />
                            <Skeleton className="h-16 w-full" />
                            <div className="flex gap-2">
                              <Skeleton className="h-8 w-20" />
                              <Skeleton className="h-8 w-20" />
                              <Skeleton className="h-8 w-20" />
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : posts.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No posts yet</p>
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
                                <span className="text-sm flex items-center gap-1 text-foreground/80">
                                  <Trophy className="w-4 h-4" />
                                  Trust: {authorInfoMap[post.author]?.reputation ?? "-"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Styled Content */}
                          {/* Styled teaser: title, summary, image only */}
                          <Teaser content={post.content} />

                          {/* Actions */}
                          <div className="flex items-center gap-2 pt-2">
                            <VotingButton
                              post={post}
                              voteType="plus"
                              onVote={handleVote}
                              fullProviders={fullProviders}
                              secretKeyUserInfo={secretKeyUserInfo}
                              votingStates={votingStates}
                              checkVoteStatus={checkVoteStatus}
                            />
                            <VotingButton
                              post={post}
                              voteType="minus"
                              onVote={handleVote}
                              fullProviders={fullProviders}
                              secretKeyUserInfo={secretKeyUserInfo}
                              votingStates={votingStates}
                              checkVoteStatus={checkVoteStatus}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleFlagPost(post.postId)}
                              className="flex items-center gap-1"
                            >
                              <Flag className="w-4 h-4" />
                              Flag
                            </Button>
                            <Button asChild size="sm">
                              <Link to={`/story/${post.postId}`}>Read full story</Link>
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </>
            )}

            {/* Referrals Tab */}
            {activeTab === "referrals" && (
              <div className="space-y-6">
                {/* Referral Status */}
                <Card className="border-purple-200 bg-purple-50">
                  <CardHeader>
                    <CardTitle className="text-purple-800 text-lg">
                      👥 Referral System
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-purple-700">
                        Remaining referrals:
                      </span>
                      <span className="font-mono bg-purple-100 px-2 py-1 rounded text-purple-900">
                        {referralCount} / 2
                      </span>
                    </div>
                    <p className="text-purple-600">
                      You can refer up to 2 new users to join the platform.
                    </p>
                  </CardContent>
                </Card>

                {/* Secret Key to Public Key Converter */}
                <Card>
                  <CardHeader>
                    <CardTitle>🔑 Secret Key → Public Key Converter</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Secret Key (64 hex characters):
                      </label>
                      <Input
                        type="password"
                        placeholder="Enter secret key to convert..."
                        value={secretKeyToConvert}
                        onChange={(e) => setSecretKeyToConvert(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <Button onClick={handleConvertSecretKey} className="w-full">
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Convert to Public Key
                    </Button>
                    {convertedPublicKey && (
                      <div className="p-3 bg-muted rounded-md">
                        <label className="block text-sm font-medium mb-2">
                          Public Key:
                        </label>
                        <div className="font-mono text-xs break-all bg-background p-2 rounded border">
                          {convertedPublicKey}
                        </div>
                        {!convertedPublicKey.startsWith("Error:") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={() =>
                              setNewUserPublicKey(convertedPublicKey)
                            }
                          >
                            Use for Referral
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Refer New User */}
                <Card>
                  <CardHeader>
                    <CardTitle>➕ Refer New User</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        New User's Public Key:
                      </label>
                      <Input
                        placeholder="Enter public key of user to refer..."
                        value={newUserPublicKey}
                        onChange={(e) => setNewUserPublicKey(e.target.value)}
                        className="font-mono"
                        disabled={isReferring}
                      />
                    </div>
                    <Button
                      onClick={handleReferral}
                      disabled={
                        !newUserPublicKey.trim() ||
                        newUserPublicKey.length !== 64 ||
                        isReferring ||
                        referralCount === 0
                      }
                      className="w-full"
                    >
                      {isReferring ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                          Submitting Referral...
                        </>
                      ) : (
                        <>
                          <Users className="w-4 h-4 mr-2" />
                          Refer User
                        </>
                      )}
                    </Button>
                    {referralCount === 0 && (
                      <p className="text-sm text-red-600">
                        You have used all your referrals for this period.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Debug tab removed from main page */}

            {/* Flow Messages and Results */}
            {flowMessage && (
              <Card className="border-blue-200 bg-blue-50 mb-4">
                <CardContent className="py-4">
                  <div className="flex items-center gap-2 text-blue-800">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    {flowMessage}
                  </div>
                </CardContent>
              </Card>
            )}

            {operationResult && (
              <Card
                className={`border-2 mb-4 ${
                  operationResult.success
                    ? "border-green-200 bg-green-50"
                    : "border-red-200 bg-red-50"
                }`}
              >
                <CardContent className="py-4">
                  <div
                    className={`text-sm ${
                      operationResult.success
                        ? "text-green-800"
                        : "text-red-800"
                    }`}
                  >
                    {operationResult.success ? (
                      <div>
                        <p className="font-medium">✅ Success!</p>
                        {operationResult.txHash && (
                          <p className="mt-2 font-mono text-xs">
                            TX: {operationResult.txHash}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium">❌ Error</p>
                        <p className="mt-1">{operationResult.error}</p>
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setOperationResult(null)}
                    className="mt-2"
                  >
                    Dismiss
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Refresh Posts Button */}
            <div className="text-center">
              <Button
                variant="outline"
                onClick={loadPosts}
                disabled={isLoading}
                className="mb-4"
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
                />
                Refresh Posts
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Lightweight renderer for composed content (# title, > summary, ![image](url), body)
// Preview helpers removed

function Teaser({ content }: { content: string }) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  let title: string | undefined;
  let summary: string | undefined;
  let imageUrl: string | undefined;
  for (const line of lines) {
    if (!title && line.startsWith("# ")) { title = line.slice(2).trim(); continue; }
    if (!imageUrl && line.startsWith("![image](") && line.endsWith(")")) { imageUrl = line.slice(9, -1); continue; }
    if (!summary && line.startsWith("> ")) { summary = line.slice(2).trim(); continue; }
  }
  return (
    <div className="space-y-3">
      {title && <h2 className="font-headline text-2xl leading-snug">{title}</h2>}
      {imageUrl && (
        <div className="rounded-md overflow-hidden border bg-muted/30">
          <img src={imageUrl} alt="post image" className="w-full h-48 object-cover" />
        </div>
      )}
      {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
    </div>
  );
}
