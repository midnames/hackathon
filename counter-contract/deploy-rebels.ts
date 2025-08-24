import { type Wallet } from "@midnight-ntwrk/wallet-api";
import {
  type CoinInfo,
  nativeToken,
  Transaction,
  type TransactionId,
  valueToBigInt
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
  deployContract,
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

// Helper functions
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

// Generate random bytes
export const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};

// Convert hex string to bytes
const hexToBytes = (hex: string): Uint8Array => {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return bytes;
};

// Deploy Rebels contract
async function deployRebelsContract(
  providers: ContractProviders<typeof rebelsContractInstance>
) {
  logger.info("Deploying Rebels contract");

  // Use fixed secret keys for consistent testing
  const authoritySecretKey = hexToBytes("0000000000000000000000000000000000000000000000000000000000000000");
  const user1SecretKey = hexToBytes("1111111111111111111111111111111111111111111111111111111111111111");
  const user2SecretKey = hexToBytes("2222222222222222222222222222222222222222222222222222222222222222");

  // Initial secret keys (3 required by contract)
  const initialSecretKeys = [authoritySecretKey, user1SecretKey, user2SecretKey];

  // User aliases
  const aliases = ["authority", "journalist1", "journalist2"];

  // Removal vote threshold
  const threshold: bigint = BigInt(1);

  logger.info("Deployment configuration:");
  logger.info(`Removal threshold: ${threshold}`);
  logger.info(`User aliases: ${aliases.join(", ")}`);

  const deployedContract = await deployContract(providers, {
    contract: rebelsContractInstance,
    privateStateId: "rebelsPrivateState",
    initialPrivateState: {
      secretKey: authoritySecretKey // Use authority secret key for deployer
    },
    args: [initialSecretKeys, aliases, authoritySecretKey, threshold]
  });

  logger.info(
    `Rebels contract deployed at address: ${deployedContract.deployTxData.public.contractAddress}`
  );

  // Log the secret keys for testing purposes (NEVER do this in production)
  logger.info("=".repeat(80));
  logger.info("SECRET KEYS FOR TESTING (KEEP SECURE):");
  logger.info(
    `Authority secret key: ${Array.from(authoritySecretKey)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")}`
  );
  logger.info(
    `User 1 secret key: ${Array.from(user1SecretKey)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")}`
  );
  logger.info(
    `User 2 secret key: ${Array.from(user2SecretKey)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")}`
  );
  logger.info("=".repeat(80));

  return deployedContract;
}

// Main deployment
async function main() {
  logger.info("Starting Rebels contract deployment");

  // Configure network
  const config = new TestnetConfig();

  let wallet: (Wallet & Resource) | null = null;

  try {
    // Build wallet
    wallet = await buildWalletAndWaitForFunds(config, DEPLOYER_WALLET_SEED);

    // Configure providers
    const providers = await configureProviders(wallet, config);

    // Deploy Rebels contract
    const deployedContract = await deployRebelsContract(providers);

    logger.info("Rebels contract deployment completed successfully!");
    logger.info(
      `Contract address: ${deployedContract.deployTxData.public.contractAddress}`
    );

    logger.info("");
    logger.info("To use this contract in your frontend:");
    logger.info(
      `1. Set REACT_APP_REBELS_CONTRACT_ADDRESS=${deployedContract.deployTxData.public.contractAddress}`
    );
    logger.info("2. Or update the contractAddress in your Rebels component");
  } catch (error) {
    logger.error("Rebels contract deployment failed:", error);
    throw error;
  } finally {
    if (wallet) {
      await wallet.close();
      logger.info("Wallet closed");
    }
  }
}

if (import.meta.main) {
  main().catch(console.error);
}
