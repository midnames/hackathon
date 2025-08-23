import type { CoinInfo, TransactionId } from '@midnight-ntwrk/ledger';
import type {
  BalancedTransaction,
  PrivateStateProvider,
  UnbalancedTransaction,
  WalletProvider,
} from '@midnight-ntwrk/midnight-js-types';
import { createContext, useCallback, useMemo, useState } from 'react';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import {
  MidnightProvider,
  ProofProvider,
  PublicDataProvider,
  ZKConfigProvider,
  createBalancedTx,
} from '@midnight-ntwrk/midnight-js-types';
import { Logger } from 'pino';
import type { CounterCircuits, CounterPrivateStateId } from '../api/common-types';
import {
  CachedFetchZkConfigProvider,
  noopProofClient,
  proofClient,
  WrappedPrivateStateProvider,
  WrappedPublicDataProvider,
} from '@meshsdk/midnight-core';
import { CounterProviders } from '../api/common-types';
import { Transaction as ZswapTransaction } from '@midnight-ntwrk/zswap';
import { getLedgerNetworkId, getZswapNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { Transaction } from '@midnight-ntwrk/ledger';
import { ProviderCallbackAction } from '@meshsdk/midnight-core';
import { useAssets, useWallet } from '@meshsdk/midnight-react';

export interface ProvidersState {
  privateStateProvider: PrivateStateProvider<typeof CounterPrivateStateId>;
  zkConfigProvider?: ZKConfigProvider<CounterCircuits>;
  proofProvider: ProofProvider<CounterCircuits>;
  publicDataProvider?: PublicDataProvider;
  walletProvider?: WalletProvider;
  midnightProvider?: MidnightProvider;
  providers?: CounterProviders;
  flowMessage?: string;
}

interface ProviderProps {
  children: React.ReactNode;
  logger: Logger;
}

export const ProvidersContext = createContext<ProvidersState | undefined>(undefined);

export const Provider = ({ children, logger }: ProviderProps) => {
  const [flowMessage, setFlowMessage] = useState<string | undefined>(undefined);

  const { uris, coinPublicKey, encryptionPublicKey } = useAssets();
  const { midnightBrowserWalletInstance } = useWallet();

  const actionMessages = useMemo<Record<ProviderCallbackAction, string | undefined>>(
    () => ({
      proveTxStarted: 'Proving transaction...',
      proveTxDone: undefined,
      balanceTxStarted: 'Signing the transaction with Midnight Lace wallet...',
      balanceTxDone: undefined,
      downloadProverStarted: 'Downloading prover key...',
      downloadProverDone: undefined,
      submitTxStarted: 'Submitting transaction...',
      submitTxDone: undefined,
      watchForTxDataStarted: 'Waiting for transaction finalization on blockchain...',
      watchForTxDataDone: undefined,
    }),
    [],
  );

  const providerCallback = useCallback(
    (action: ProviderCallbackAction): void => {
      setFlowMessage(actionMessages[action]);
    },
    [actionMessages],
  );

  const privateStateProvider: PrivateStateProvider<typeof CounterPrivateStateId> = useMemo(
    () =>
      new WrappedPrivateStateProvider(
        levelPrivateStateProvider({
          privateStateStoreName: 'counter-private-state',
        }),
        logger,
      ),
    [logger],
  );

  const publicDataProvider: PublicDataProvider | undefined = useMemo(
    () =>
      uris
        ? new WrappedPublicDataProvider(indexerPublicDataProvider(uris.indexerUri, uris.indexerWsUri), providerCallback, logger)
        : undefined,
    [uris, providerCallback, logger],
  );

  const zkConfigProvider = useMemo(() => {
    if (typeof window === 'undefined') {
      // Return undefined (or an appropriate fallback) if running on the server.
      return undefined;
    }
    return new CachedFetchZkConfigProvider<CounterCircuits>(
      `${window.location.origin}/midnight/counter`,
      fetch.bind(window),
      () => {},
    );
  }, []);

  const proofProvider = useMemo(
    () => (uris ? proofClient(uris.proverServerUri, providerCallback) : noopProofClient()),
    [uris, providerCallback],
  );

  const walletProvider: WalletProvider = useMemo(
    () =>
      midnightBrowserWalletInstance
        ? {
            coinPublicKey: coinPublicKey!,
            encryptionPublicKey: encryptionPublicKey!,
            balanceTx: (tx: UnbalancedTransaction, newCoins: CoinInfo[]): Promise<BalancedTransaction> => {
              providerCallback('balanceTxStarted');
              return midnightBrowserWalletInstance
                ._walletInstance!.balanceAndProveTransaction(
                  ZswapTransaction.deserialize(tx.serialize(getLedgerNetworkId()), getZswapNetworkId()),
                  newCoins,
                )
                .then((zswapTx) => Transaction.deserialize(zswapTx.serialize(getZswapNetworkId()), getLedgerNetworkId()))
                .then(createBalancedTx)
                .finally(() => providerCallback('balanceTxDone'));
            },
          }
        : {
            coinPublicKey: '',
            encryptionPublicKey: '',
            balanceTx: () => Promise.reject(new Error('readonly')),
          },
    [midnightBrowserWalletInstance, coinPublicKey, providerCallback],
  );

  const midnightProvider: MidnightProvider = useMemo(
    () =>
      midnightBrowserWalletInstance
        ? {
            submitTx: (tx: BalancedTransaction): Promise<TransactionId> => {
              providerCallback('submitTxStarted');
              return midnightBrowserWalletInstance
                ._walletInstance!.submitTransaction(tx)
                .finally(() => providerCallback('submitTxDone'));
            },
          }
        : {
            submitTx: (): Promise<TransactionId> => Promise.reject(new Error('readonly')),
          },
    [midnightBrowserWalletInstance, providerCallback],
  );

  const combinedProviders: ProvidersState = useMemo(() => {
    return {
      privateStateProvider,
      publicDataProvider,
      proofProvider,
      zkConfigProvider,
      walletProvider,
      midnightProvider,
      // Only set the nested providers object if publicDataProvider (and others, if needed) are defined.
      providers:
        publicDataProvider && zkConfigProvider
          ? {
              privateStateProvider,
              publicDataProvider,
              zkConfigProvider,
              proofProvider,
              walletProvider,
              midnightProvider,
            }
          : undefined,
      flowMessage,
    };
  }, [privateStateProvider, publicDataProvider, proofProvider, zkConfigProvider, walletProvider, midnightProvider, flowMessage]);

  return <ProvidersContext.Provider value={combinedProviders}>{children}</ProvidersContext.Provider>;
};
