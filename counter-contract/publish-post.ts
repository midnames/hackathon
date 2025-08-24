import { type Wallet } from "@midnight-ntwrk/wallet-api";
import {
  type CoinInfo,
  nativeToken,
  Transaction,
  type TransactionId
} from "@midnight-ntwrk/ledger";
import {
  type BalancedTransaction,
  createBalancedTx,
  type MidnightProvider,
  type UnbalancedTransaction,
  type WalletProvider
} from "@midnight-ntwrk/midnight-js-types";
import { Transaction as ZswapTransaction } from "@midnight-ntwrk/zswap";
import {
  getLedgerNetworkId,
  getZswapNetworkId,
  NetworkId,
  setNetworkId
} from "@midnight-ntwrk/midnight-js-network-id";
import { type Resource, WalletBuilder } from "@midnight-ntwrk/wallet";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import {
  findDeployedContract,
  type ContractProviders
} from "@midnight-ntwrk/midnight-js-contracts";

import { rebelsWitnesses, type RebelsPrivateState } from "./src/witnesses.js";
import { RebelsContract } from "./src/index.js";

import * as Rx from "rxjs";
import * as path from "node:path";
import { type Logger } from "pino";
import pinoPretty from "pino-pretty";
import pino from "pino";

// Configuration
interface Config {
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly proofServer: string;
}

class TestnetConfig implements Config {
  indexer = "https://indexer.testnet-02.midnight.network/api/v1/graphql";
  indexerWS = "wss://indexer.testnet-02.midnight.network/api/v1/graphql/ws";
  node = "https://rpc.testnet-02.midnight.network";
  proofServer = "https://ps.midnames.com";
  //proofServer = "localhost:6300";
  constructor() {
    setNetworkId(NetworkId.TestNet);
  }
}

// Logger setup
const logger: Logger = pino(
  {
    level: "info",
    depthLimit: 20
  },
  pinoPretty({
    colorize: true,
    sync: true,
    customColors: {
      debug: "green"
    }
  })
);

// Use a test wallet seed - in production, use your own secure seed
const DEPLOYER_WALLET_SEED =
  "557beb4d4bd5c88948712fd375b20f44ed9f38ade5e6ee8c27ece84d26de1639";

// Contract configuration
const contractConfig = {
  zkConfigPath: path.resolve(import.meta.dirname, "src", "managed", "rebels")
};

// Default contract address (can be overridden with --contract)
const DEFAULT_CONTRACT_ADDRESS =
  "02000d91adc5b77cbf50910b50fc8b6481ccf88f4028b7711e10bb390a18917e2bc5";

// Helper functions (reused from deploy-rebels.ts)
export const createWalletAndMidnightProvider = async (
  wallet: Wallet
): Promise<WalletProvider & MidnightProvider> => {
  const state = await Rx.firstValueFrom(wallet.state());
  return {
    coinPublicKey: state.coinPublicKey,
    encryptionPublicKey: state.encryptionPublicKey,
    balanceTx(
      tx: UnbalancedTransaction,
      newCoins: CoinInfo[]
    ): Promise<BalancedTransaction> {
      return wallet
        .balanceTransaction(
          ZswapTransaction.deserialize(
            tx.serialize(getLedgerNetworkId()),
            getZswapNetworkId()
          ),
          newCoins
        )
        .then((tx) => wallet.proveTransaction(tx))
        .then((zswapTx) =>
          Transaction.deserialize(
            zswapTx.serialize(getZswapNetworkId()),
            getLedgerNetworkId()
          )
        )
        .then(createBalancedTx);
    },
    submitTx(tx: BalancedTransaction): Promise<TransactionId> {
      return wallet.submitTransaction(tx);
    }
  };
};

export const waitForFunds = (wallet: Wallet) =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(10_000),
      Rx.tap((state) => {
        const applyGap = state.syncProgress?.lag.applyGap ?? 0n;
        const sourceGap = state.syncProgress?.lag.sourceGap ?? 0n;
        logger.info(
          `Waiting for funds. Backend lag: ${sourceGap}, wallet lag: ${applyGap}, transactions=${state.transactionHistory.length}`
        );
      }),
      Rx.filter((state) => {
        return state.syncProgress?.synced === true;
      }),
      Rx.map((s) => s.balances[nativeToken()] ?? 0n),
      Rx.filter((balance) => balance > 0n)
    )
  );

export const buildWalletAndWaitForFunds = async (
  { indexer, indexerWS, node, proofServer }: Config,
  seed: string
): Promise<Wallet & Resource> => {
  logger.info("Building wallet from scratch");
  const wallet = await WalletBuilder.buildFromSeed(
    indexer,
    indexerWS,
    proofServer,
    node,
    seed,
    getZswapNetworkId(),
    "info"
  );
  wallet.start();

  const state = await Rx.firstValueFrom(wallet.state());
  logger.info(`Your wallet seed is: ${seed}`);
  logger.info(`Your wallet address is: ${state.address}`);
  let balance = state.balances[nativeToken()];
  if (balance === undefined || balance === 0n) {
    logger.info(`Your wallet balance is: 0`);
    logger.info(`Waiting to receive tokens...`);
    balance = await waitForFunds(wallet);
  }
  logger.info(`Your wallet balance is: ${balance}`);
  return wallet;
};

export const configureProviders = async (
  wallet: Wallet & Resource,
  config: Config
) => {
  const walletAndMidnightProvider =
    await createWalletAndMidnightProvider(wallet);
  return {
    privateStateProvider: levelPrivateStateProvider<"rebelsPrivateState">({
      privateStateStoreName: "rebels-private-state"
    }),
    publicDataProvider: indexerPublicDataProvider(
      config.indexer,
      config.indexerWS
    ),
    zkConfigProvider: new NodeZkConfigProvider<
      keyof typeof rebelsContractInstance.impureCircuits
    >(contractConfig.zkConfigPath),
    proofProvider: httpClientProofProvider(config.proofServer),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider
  };
};

// Rebels contract instance
const rebelsContractInstance = new RebelsContract<RebelsPrivateState>(
  rebelsWitnesses
);

// Convert hex string to bytes
const hexToBytes = (hex: string): Uint8Array => {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (cleanHex.length !== 64) {
    throw new Error("Secret key must be exactly 64 hex characters");
  }
  if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
    throw new Error("Secret key must contain only hex characters");
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 64; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
};

// Parse command line arguments
interface Args {
  key: string;
  message: string;
  contract?: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Partial<Args> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--key" && i + 1 < args.length) {
      result.key = args[i + 1];
      i++;
    } else if (args[i] === "--message" && i + 1 < args.length) {
      result.message = args[i + 1];
      i++;
    } else if (args[i] === "--contract" && i + 1 < args.length) {
      result.contract = args[i + 1];
      i++;
    }
  }

  if (!result.key) {
    throw new Error("Missing required --key argument");
  }
  if (!result.message) {
    throw new Error("Missing required --message argument");
  }

  return {
    key: result.key,
    message: result.message,
    contract: result.contract || DEFAULT_CONTRACT_ADDRESS
  };
}

// Publish a post to the Rebels contract
async function publishPost(
  providers: ContractProviders<typeof rebelsContractInstance>,
  contractAddress: string,
  secretKey: Uint8Array,
  message: string
) {
  logger.info("Publishing post to Rebels contract...");
  logger.info(`Contract address: ${contractAddress}`);
  logger.info(`Message: "${message}"`);

  // Set private state with the provided secret key
  await providers.privateStateProvider.set("rebelsPrivateState", { secretKey });

  // Find and join the deployed contract
  const deployedContract = await findDeployedContract(providers, {
    contractAddress,
    contract: rebelsContractInstance,
    privateStateId: "rebelsPrivateState",
    initialPrivateState: { secretKey }
  });

  // Call publishPost method
  const result = await deployedContract.callTx.publishPost(message);

  logger.info("Post published successfully!");
  logger.info(`Post ID: ${result.result}`);
  logger.info(`Transaction ID: ${result.public.txId}`);

  return result;
}

// Main function
async function main() {
  try {
    // Parse command line arguments
    const args = parseArgs();

    logger.info("Starting post publication to Rebels contract");
    logger.info(`Using contract address: ${args.contract}`);

    // Validate secret key
    const secretKey = hexToBytes(args.key);

    // Configure network
    const config = new TestnetConfig();

    let wallet: (Wallet & Resource) | null = null;

    try {
      // Build wallet
      wallet = await buildWalletAndWaitForFunds(config, DEPLOYER_WALLET_SEED);

      // Configure providers
      const providers = await configureProviders(wallet, config);

      // Publish the post
      await publishPost(providers, args.contract, secretKey, args.message);

      logger.info("Post publication completed successfully!");
    } catch (error) {
      logger.error("Post publication failed:", error);
      throw error;
    } finally {
      if (wallet) {
        await wallet.close();
        logger.info("Wallet closed");
      }
    }
  } catch (error) {
    logger.error(
      "Error:",
      error instanceof Error ? error.message : String(error)
    );
    logger.info("");
    logger.info("Usage:");
    logger.info(
      "  npm run publish:post -- --key <secret_key> --message <message>"
    );
    logger.info(
      "  npm run publish:post -- --key <secret_key> --message <message> --contract <contract_address>"
    );
    logger.info("");
    logger.info("Example:");
    logger.info(
      '  npm run publish:post -- --key "abc123def456..." --message "Hello Rebels!"'
    );
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}
