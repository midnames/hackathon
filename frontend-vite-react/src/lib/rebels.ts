import {
  NetworkId,
  getNetworkId,
} from "@midnight-ntwrk/midnight-js-network-id";
import {
  MidnightProviders,
  PublicDataProvider,
  type ImpureCircuitId,
} from "@midnight-ntwrk/midnight-js-types";
import { ContractAddress } from "@midnight-ntwrk/compact-runtime";
import {
  rebelsLedger,
  RebelsContract,
  rebelsPureCircuits,
} from "../../../freedom-contract/src/index.js";
import {
  rebelsWitnesses,
  type RebelsPrivateState,
} from "../../../freedom-contract/src/witnesses.js";
export type { RebelsPrivateState };
import {
  deployContract,
  findDeployedContract,
} from "@midnight-ntwrk/midnight-js-contracts";

// Define private state ID for Rebels contract
export const RebelsPrivateStateId = "rebelsPrivateState";

// Create contract instance with proper typing
export const rebelsContractInstance = new RebelsContract<RebelsPrivateState>(
  rebelsWitnesses
);

// Define proper provider types for Rebels contract
type RebelsContractType = RebelsContract<RebelsPrivateState>;
type RebelsCircuits = ImpureCircuitId<RebelsContractType>;
type RebelsProviders = MidnightProviders<
  RebelsCircuits,
  typeof RebelsPrivateStateId,
  RebelsPrivateState
>;

// Post interface matching the contract struct
export interface Post {
  author: string;
  content: string;
  plusVotes: number;
  minusVotes: number;
}

// Extended post with metadata
export interface PostWithMetadata extends Post {
  postId: number;
  score: number; // plusVotes - minusVotes
  timestamp?: number;
}

// User info interface
export interface UserInfo {
  publicKey: string;
  alias?: string;
  reputation: number;
  hasVotedPlus: boolean;
  hasVotedMinus: boolean;
}

// Contract state interface
export interface RebelsContractState {
  posts: Map<number, Post>;
  userAliases: Map<string, string>;
  userReputation: Map<string, number>;
  postCounter: number;
  plusVoters: Map<number, Set<string>>;
  minusVoters: Map<number, Set<string>>;
  flaggedPosts: Map<number, Set<string>>;
  authorizedUsers: Set<string>;
  prohibitedMaterialAuthority: string;
  removalVoteThreshold: number;
}

// Utility functions
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte: number) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  let cleanHex = hex;

  // Handle different hex string formats
  if (cleanHex.startsWith("0x")) {
    cleanHex = cleanHex.slice(2);
  }

  // Ensure we have exactly 64 characters (32 bytes) for public keys
  if (cleanHex.length < 64) {
    cleanHex = cleanHex.padStart(64, "0");
  } else if (cleanHex.length > 64) {
    // If longer, take the last 64 characters (common for wallet addresses)
    cleanHex = cleanHex.slice(-64);
  }

  const bytes = new Uint8Array(32); // Always 32 bytes for Bytes<32>
  for (let i = 0; i < 64; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function queryContractStateSafely(
  publicDataProvider: PublicDataProvider,
  contractAddress: string,
  errorMessage: string
) {
  console.log("[DEBUG] queryContractStateSafely called:", {
    contractAddress: contractAddress.substring(0, 8) + "...",
    errorMessage
  });
  
  try {
    const contractState =
      await publicDataProvider.queryContractState(contractAddress);
    
    console.log("[DEBUG] Contract state query result:", {
      hasState: contractState != null,
      hasData: contractState?.data != null,
      dataType: typeof contractState?.data
    });
    
    if (contractState == null) {
      console.error("[DEBUG] Contract state is null");
      throw new Error(errorMessage);
    }
    return contractState;
  } catch (error) {
    console.error("[DEBUG] queryContractStateSafely failed:", error);
    throw error;
  }
}

// Generate a random secret key for new users
export function generateSecretKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

// Derive public key from secret key using the contract's pure circuit
export function derivePublicKeyFromSecret(secretKeyHex: string): string {
  console.log("[DEBUG] derivePublicKeyFromSecret called with:", {
    secretKeyHex: secretKeyHex.substring(0, 8) + "...", // Only show first 8 chars for privacy
    length: secretKeyHex.length,
    isValidHex: /^[0-9a-fA-F]+$/.test(secretKeyHex)
  });
  
  try {
    const secretKey = hexToBytes(secretKeyHex);
    console.log("[DEBUG] secretKey converted to bytes:", { byteLength: secretKey.length });
    
    const publicKeyBytes = rebelsPureCircuits.publicKey(secretKey);
    console.log("[DEBUG] publicKey derived:", { byteLength: publicKeyBytes.length });
    
    const publicKeyHex = bytesToHex(publicKeyBytes);
    console.log("[DEBUG] publicKey hex:", {
      hex: publicKeyHex.substring(0, 8) + "...", // Only show first 8 chars
      length: publicKeyHex.length
    });
    
    return publicKeyHex;
  } catch (error) {
    console.error("[DEBUG] Failed to derive public key:", error);
    throw new Error("Invalid secret key");
  }
}

// Convert coinPublicKey from wallet to hex string format
export function coinPublicKeyToHex(coinPublicKey: string): string {
  // Remove any prefix and ensure it's a valid hex string
  let cleanKey = coinPublicKey;
  if (cleanKey.startsWith("0x")) {
    cleanKey = cleanKey.slice(2);
  }

  // If the key is already the right length, return it
  if (cleanKey.length === 64) {
    return cleanKey;
  }

  // If it's shorter, pad with zeros
  if (cleanKey.length < 64) {
    return cleanKey.padStart(64, "0");
  }

  // If it's longer, take the last 64 characters (this handles wallet address formats)
  return cleanKey.slice(-64);
}

// Helper to get deployed contract object for calling methods
async function getDeployedRebelsContract(
  providers: RebelsProviders,
  contractAddress: string,
  secretKey: Uint8Array
) {
  // Set the private state with the provided secret key
  await providers.privateStateProvider.set(RebelsPrivateStateId, { secretKey });

  // Join the deployed contract
  const deployedContract = await findDeployedContract(providers, {
    contractAddress,
    contract: rebelsContractInstance,
    privateStateId: RebelsPrivateStateId,
    initialPrivateState: { secretKey },
  });

  return deployedContract;
}

// Deploy a new Rebels contract
export async function deployRebelsContract(
  providers: RebelsProviders,
  initialUsers: string[],
  aliases: string[],
  authority: string,
  threshold: number
): Promise<string> {
  console.log("Deploying Rebels contract...");

  // Pad arrays to required length (3)
  const paddedUsers = [...initialUsers];
  const paddedAliases = [...aliases];

  while (paddedUsers.length < 3) {
    paddedUsers.push("00".repeat(32)); // Empty bytes
  }
  while (paddedAliases.length < 3) {
    paddedAliases.push("");
  }

  const deployedContract = await deployContract(
    providers,
    rebelsContractInstance,
    paddedUsers.map((u) => hexToBytes(u)),
    paddedAliases,
    hexToBytes(authority),
    threshold
  );

  console.log("Rebels contract deployed at:", deployedContract.contractAddress);
  return deployedContract.contractAddress;
}

// Find deployed Rebels contract
export async function findDeployedRebelsContract(
  providers: Pick<RebelsProviders, "publicDataProvider">,
  deployerAddress?: string
): Promise<string | null> {
  console.log("Looking for deployed Rebels contract...");

  const deployedContract = await findDeployedContract(
    providers.publicDataProvider,
    rebelsContractInstance,
    deployerAddress
  );

  return deployedContract?.contractAddress || null;
}

// Read all posts from the contract
export async function getAllPosts(
  publicDataProvider: PublicDataProvider,
  contractAddress: string
): Promise<PostWithMetadata[]> {
  try {
    const contractState = await queryContractStateSafely(
      publicDataProvider,
      contractAddress,
      `Contract state unavailable for Rebels contract ${contractAddress}`
    );

    const contractLedger = rebelsLedger(contractState.data);
    const posts: PostWithMetadata[] = [];

    // Get post counter to know how many posts exist
    const postCounter = contractLedger.postCounter;

    // Iterate through all post IDs
    for (let postId = 1; postId <= postCounter; postId++) {
      if (contractLedger.posts.member(BigInt(postId))) {
        const post = contractLedger.posts.lookup(BigInt(postId));
        const postWithMetadata: PostWithMetadata = {
          postId,
          author: bytesToHex(post.author as Uint8Array),
          content: post.content as string,
          plusVotes: Number(post.plusVotes),
          minusVotes: Number(post.minusVotes),
          score: Number(post.plusVotes) - Number(post.minusVotes),
        };
        posts.push(postWithMetadata);
      }
    }

    // Sort by score descending, then by postId descending (newest first for ties)
    return posts.sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      return b.postId - a.postId;
    });
  } catch (error) {
    console.error("Failed to get all posts:", error);
    return [];
  }
}

// Get user information
export async function getUserInfo(
  publicDataProvider: PublicDataProvider,
  contractAddress: string,
  userPublicKey: string,
  postId?: number
): Promise<UserInfo> {
  try {
    const contractState = await queryContractStateSafely(
      publicDataProvider,
      contractAddress,
      `Contract state unavailable for Rebels contract ${contractAddress}`
    );

    const contractLedger = rebelsLedger(contractState.data);

    // Convert user public key to proper Bytes<32> format
    let userKeyBytes: Uint8Array;
    try {
      userKeyBytes = hexToBytes(userPublicKey);
    } catch (error) {
      console.error("Failed to convert userPublicKey to bytes:", error);
      throw new Error(`Invalid public key format: ${userPublicKey}`);
    }

    // Get user alias
    let alias: string | undefined;
    try {
      if (contractLedger.userAliases.member(userKeyBytes)) {
        alias = contractLedger.userAliases.lookup(userKeyBytes).value as string;
      }
    } catch (error) {
      console.error("Failed to get user alias:", error);
    }

    // Get user reputation
    let reputation = 1000; // Default
    try {
      if (contractLedger.userReputation.member(userKeyBytes)) {
        reputation = Number(contractLedger.userReputation.lookup(userKeyBytes));
      }
    } catch (error) {
      console.error("Failed to get user reputation:", error);
    }

    // Check voting status for specific post
    let hasVotedPlus = false;
    let hasVotedMinus = false;
    if (postId !== undefined) {
      try {
        if (contractLedger.plusVoters.member(BigInt(postId))) {
          hasVotedPlus = contractLedger.plusVoters
            .lookup(BigInt(postId))
            .member(userKeyBytes);
        }
        if (contractLedger.minusVoters.member(BigInt(postId))) {
          hasVotedMinus = contractLedger.minusVoters
            .lookup(BigInt(postId))
            .member(userKeyBytes);
        }
      } catch (error) {
        console.error("Failed to check voting status:", error);
      }
    }

    return {
      publicKey: userPublicKey,
      alias,
      reputation,
      hasVotedPlus,
      hasVotedMinus,
    };
  } catch (error) {
    console.error("Failed to get user info:", error);
    return {
      publicKey: userPublicKey,
      reputation: 1000,
      hasVotedPlus: false,
      hasVotedMinus: false,
    };
  }
}

// Get user information using their secret key
export async function getUserInfoFromSecretKey(
  publicDataProvider: PublicDataProvider,
  contractAddress: string,
  secretKeyHex: string,
  postId?: number
): Promise<UserInfo> {
  console.log("[DEBUG] getUserInfoFromSecretKey called with:", {
    contractAddress: contractAddress.substring(0, 8) + "...",
    secretKeyLength: secretKeyHex.length,
    hasPostId: postId !== undefined,
    postId
  });

  try {
    // Derive public key from secret key
    const publicKey = derivePublicKeyFromSecret(secretKeyHex);
    console.log("[DEBUG] Derived public key, now calling getUserInfo");
    
    // Use the existing getUserInfo function
    const userInfo = await getUserInfo(publicDataProvider, contractAddress, publicKey, postId);
    console.log("[DEBUG] getUserInfo returned:", {
      publicKey: userInfo.publicKey.substring(0, 8) + "...",
      reputation: userInfo.reputation,
      hasAlias: !!userInfo.alias,
      alias: userInfo.alias,
      hasVotedPlus: userInfo.hasVotedPlus,
      hasVotedMinus: userInfo.hasVotedMinus
    });
    
    return userInfo;
  } catch (error) {
    console.error("[DEBUG] Failed to get user info from secret key:", error);
    const fallbackInfo = {
      publicKey: "",
      reputation: 1000,
      hasVotedPlus: false,
      hasVotedMinus: false,
    };
    console.log("[DEBUG] Returning fallback user info:", fallbackInfo);
    return fallbackInfo;
  }
}

// Publish a new post
export async function publishPost(
  providers: RebelsProviders,
  contractAddress: string,
  content: string,
  secretKeyHex: string
): Promise<{
  success: boolean;
  postId?: number;
  error?: string;
  transactionId?: string;
}> {
  console.log("[DEBUG] publishPost called with:", {
    contractAddress: contractAddress.substring(0, 8) + "...",
    contentLength: content.length,
    secretKeyLength: secretKeyHex.length,
    hasProviders: !!providers,
    providerKeys: Object.keys(providers)
  });

  try {
    console.log("[DEBUG] Publishing post...");

    // Convert hex string to Uint8Array
    const secretKey = hexToBytes(secretKeyHex);
    console.log("[DEBUG] Secret key converted to bytes:", { length: secretKey.length });

    // Get deployed contract object
    console.log("[DEBUG] Getting deployed contract...");
    const deployedContract = await getDeployedRebelsContract(
      providers,
      contractAddress,
      secretKey
    );
    console.log("[DEBUG] Got deployed contract:", { hasCallTx: !!deployedContract.callTx });

    // Call publishPost method via callTx
    console.log("[DEBUG] Calling publishPost on contract...");
    const result = await deployedContract.callTx.publishPost(content);

    console.log("[DEBUG] Post published successfully:", {
      hasResult: !!result.result,
      hasTxId: !!result.public?.txId,
      result: result.result,
      txId: result.public?.txId
    });
    
    return {
      success: true,
      postId: Number(result.result), // The circuit returns the new post ID
      transactionId: result.public.txId,
    };
  } catch (error) {
    console.error("[DEBUG] Failed to publish post:", error);
    console.error("[DEBUG] Error details:", {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Vote plus on a post
export async function votePlus(
  providers: RebelsProviders,
  contractAddress: string,
  postId: number,
  secretKeyHex: string
): Promise<{ success: boolean; error?: string; transactionId?: string }> {
  try {
    console.log("Voting plus on post", postId);

    // Convert hex string to Uint8Array
    const secretKey = hexToBytes(secretKeyHex);

    // Get deployed contract object
    const deployedContract = await getDeployedRebelsContract(
      providers,
      contractAddress,
      secretKey
    );

    // Call votePlus method via callTx
    const result = await deployedContract.callTx.votePlus(BigInt(postId));

    console.log("Plus vote successful:", result);
    return {
      success: true,
      transactionId: result.public.txId,
    };
  } catch (error) {
    console.error("[DEBUG] Failed to vote plus:", error);
    console.error("[DEBUG] Error details:", {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error ? error.cause : undefined
    });
    
    // Try to extract more details if it's a network error
    if (error && typeof error === 'object' && 'response' in error) {
      console.error("[DEBUG] Network response error:", error.response);
    }
    if (error && typeof error === 'object' && 'status' in error) {
      console.error("[DEBUG] HTTP status:", error.status);
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Vote minus on a post
export async function voteMinus(
  providers: RebelsProviders,
  contractAddress: string,
  postId: number,
  secretKeyHex: string
): Promise<{ success: boolean; error?: string; transactionId?: string }> {
  try {
    console.log("Voting minus on post", postId);

    // Convert hex string to Uint8Array
    const secretKey = hexToBytes(secretKeyHex);

    // Get deployed contract object
    const deployedContract = await getDeployedRebelsContract(
      providers,
      contractAddress,
      secretKey
    );

    // Call voteMinus method via callTx
    const result = await deployedContract.callTx.voteMinus(BigInt(postId));

    console.log("Minus vote successful:", result);
    return {
      success: true,
      transactionId: result.public.txId,
    };
  } catch (error) {
    console.error("[DEBUG] Failed to vote minus:", error);
    console.error("[DEBUG] Error details:", {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error ? error.cause : undefined
    });
    
    // Try to extract more details if it's a network error
    if (error && typeof error === 'object' && 'response' in error) {
      console.error("[DEBUG] Network response error:", error.response);
    }
    if (error && typeof error === 'object' && 'status' in error) {
      console.error("[DEBUG] HTTP status:", error.status);
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Flag a post
export async function flagPost(
  providers: RebelsProviders,
  contractAddress: string,
  postId: number,
  secretKeyHex: string
): Promise<{ success: boolean; error?: string; transactionId?: string }> {
  try {
    console.log("Flagging post", postId);

    // Convert hex string to Uint8Array
    const secretKey = hexToBytes(secretKeyHex);

    // Get deployed contract object
    const deployedContract = await getDeployedRebelsContract(
      providers,
      contractAddress,
      secretKey
    );

    // Call flagPost method via callTx
    const result = await deployedContract.callTx.flagPost(BigInt(postId));

    console.log("Post flagged successfully:", result);
    return {
      success: true,
      transactionId: result.public.txId,
    };
  } catch (error) {
    console.error("Failed to flag post:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Remove illegal content (authority only)
export async function removeIllegalContent(
  providers: RebelsProviders,
  contractAddress: string,
  postId: number,
  secretKeyHex: string
): Promise<{ success: boolean; error?: string; transactionId?: string }> {
  try {
    console.log("Removing illegal content for post", postId);

    // Convert hex string to Uint8Array
    const secretKey = hexToBytes(secretKeyHex);

    // Get deployed contract object
    const deployedContract = await getDeployedRebelsContract(
      providers,
      contractAddress,
      secretKey
    );

    // Call removeIllegalContent method via callTx
    const result = await deployedContract.callTx.removeIllegalContent(
      BigInt(postId)
    );

    console.log("Illegal content removed successfully:", result);
    return {
      success: true,
      transactionId: result.public.txId,
    };
  } catch (error) {
    console.error("Failed to remove illegal content:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Get a specific post
export async function getPost(
  publicDataProvider: PublicDataProvider,
  contractAddress: string,
  postId: number
): Promise<PostWithMetadata | null> {
  try {
    const contractState = await queryContractStateSafely(
      publicDataProvider,
      contractAddress,
      `Contract state unavailable for Rebels contract ${contractAddress}`
    );

    const contractLedger = rebelsLedger(contractState.data);

    if (!contractLedger.posts.member(postId)) {
      return null;
    }

    const post = contractLedger.posts.lookup(postId);
    return {
      postId,
      author: bytesToHex(post.author.bytes as Uint8Array),
      content: post.content.value as string,
      plusVotes: Number(post.plusVotes),
      minusVotes: Number(post.minusVotes),
      score: Number(post.plusVotes) - Number(post.minusVotes),
    };
  } catch (error) {
    console.error("Failed to get post:", error);
    return null;
  }
}

// Check user's vote status for a specific post
export async function checkUserVote(
  publicDataProvider: PublicDataProvider,
  contractAddress: string,
  userPublicKey: string,
  postId: number
): Promise<"plus" | "minus" | null> {
  console.log(`[DEBUG] checkUserVote called:`, {
    contractAddress: contractAddress.substring(0, 8) + "...",
    userPublicKey: userPublicKey.substring(0, 8) + "...",
    postId
  });

  try {
    console.log(`[DEBUG] checkUserVote: querying contract state`);
    const contractState = await queryContractStateSafely(
      publicDataProvider,
      contractAddress,
      `Contract state unavailable for Rebels contract ${contractAddress}`
    );

    console.log(`[DEBUG] checkUserVote: got contract state, creating ledger`);
    const contractLedger = rebelsLedger(contractState.data);

    // Convert user public key to proper Bytes<32> format
    let userKeyBytes: Uint8Array;
    try {
      userKeyBytes = hexToBytes(userPublicKey);
      console.log(`[DEBUG] checkUserVote: converted public key to bytes (${userKeyBytes.length} bytes)`);
    } catch (error) {
      console.error("[DEBUG] checkUserVote: Failed to convert userPublicKey to bytes:", error);
      return null;
    }

    console.log(`[DEBUG] checkUserVote: checking plus voters for post ${postId}`);
    // Check if user voted plus
    if (contractLedger.plusVoters.member(BigInt(postId))) {
      console.log(`[DEBUG] checkUserVote: plusVoters map has entry for post ${postId}, checking membership`);
      const plusVotersSet = contractLedger.plusVoters.lookup(BigInt(postId));
      if (plusVotersSet.member(userKeyBytes)) {
        console.log(`[DEBUG] checkUserVote: user IS in plusVoters for post ${postId}`);
        return "plus";
      }
      console.log(`[DEBUG] checkUserVote: user is NOT in plusVoters for post ${postId}`);
    } else {
      console.log(`[DEBUG] checkUserVote: no plusVoters entry for post ${postId}`);
    }

    console.log(`[DEBUG] checkUserVote: checking minus voters for post ${postId}`);
    // Check if user voted minus
    if (contractLedger.minusVoters.member(BigInt(postId))) {
      console.log(`[DEBUG] checkUserVote: minusVoters map has entry for post ${postId}, checking membership`);
      const minusVotersSet = contractLedger.minusVoters.lookup(BigInt(postId));
      if (minusVotersSet.member(userKeyBytes)) {
        console.log(`[DEBUG] checkUserVote: user IS in minusVoters for post ${postId}`);
        return "minus";
      }
      console.log(`[DEBUG] checkUserVote: user is NOT in minusVoters for post ${postId}`);
    } else {
      console.log(`[DEBUG] checkUserVote: no minusVoters entry for post ${postId}`);
    }

    // User hasn't voted
    console.log(`[DEBUG] checkUserVote: user has not voted on post ${postId}`);
    return null;
  } catch (error) {
    console.error("[DEBUG] checkUserVote: Failed to check user vote:", error);
    return null;
  }
}

// Suggest a new user (referral system)
export async function suggestNewUser(
  providers: RebelsProviders,
  contractAddress: string,
  newUserPublicKeyHex: string,
  secretKeyHex: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  console.log(`[DEBUG] suggestNewUser called for:`, newUserPublicKeyHex.substring(0, 8) + "...");

  try {
    // Convert hex strings to Uint8Array
    const newUserPublicKey = hexToBytes(newUserPublicKeyHex);
    const secretKey = hexToBytes(secretKeyHex);
    
    console.log(`[DEBUG] suggestNewUser: getting deployed contract`);
    // Get deployed contract object
    const deployedContract = await getDeployedRebelsContract(
      providers,
      contractAddress,
      secretKey
    );
    
    console.log(`[DEBUG] suggestNewUser: calling contract circuit`);
    const result = await deployedContract.callTx.suggestNewUser(newUserPublicKey);

    console.log(`[DEBUG] suggestNewUser: transaction successful`, result.public.txId);
    return { 
      success: true, 
      txHash: result.public.txId 
    };
  } catch (error: any) {
    console.error("[DEBUG] suggestNewUser failed:", error);
    return { success: false, error: error?.message || "Unknown error" };
  }
}

// Get user's remaining referral count
export async function getReferralCount(
  publicDataProvider: PublicDataProvider,
  contractAddress: string,
  userPublicKey: string
): Promise<number> {
  console.log(`[DEBUG] getReferralCount called for:`, userPublicKey.substring(0, 8) + "...");

  try {
    const contractState = await queryContractStateSafely(
      publicDataProvider,
      contractAddress,
      `Contract state unavailable for Rebels contract ${contractAddress}`
    );

    const contractLedger = rebelsLedger(contractState.data);
    const userKeyBytes = hexToBytes(userPublicKey);

    if (contractLedger.referrals.member(userKeyBytes)) {
      const usedReferrals = contractLedger.referrals.lookup(userKeyBytes);
      const remaining = 2 - Number(usedReferrals); // Max 2 referrals per user
      console.log(`[DEBUG] getReferralCount: user has used ${usedReferrals}, remaining: ${remaining}`);
      return Math.max(0, remaining);
    } else {
      console.log(`[DEBUG] getReferralCount: user not found in referrals map, assuming 2 remaining`);
      return 2; // New user, hasn't used any referrals yet
    }
  } catch (error) {
    console.error("[DEBUG] getReferralCount failed:", error);
    return 0; // Default to 0 on error
  }
}
