'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Wallet, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RH_CHAIN, RH_CHAIN_HEX, shortAddress } from '@/lib/chain';
import { requestApi } from '@/lib/client-api';
type Provider = {
  request: (input: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, callback: () => void) => void;
  removeListener?: (event: string, callback: () => void) => void;
};
type WalletChoice = {
  info: { uuid: string; name: string };
  provider: Provider;
};
type WalletContextValue = {
  address: string | null;
  busy: boolean;
  open: () => void;
  refresh: () => Promise<void>;
};
const WalletContext = createContext<WalletContextValue>({
  address: null,
  busy: false,
  open: () => {},
  refresh: async () => {},
});
export const useWallet = () => useContext(WalletContext);
const walletApi = <T,>(body?: unknown) => requestApi<T>('/api/wallet', body);
export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false),
    [error, setError] = useState(''),
    [step, setStep] = useState(''),
    [choices, setChoices] = useState<WalletChoice[]>([]);
  const providerRef = useRef<Provider | null>(null),
    cleanup = useRef<(() => void) | null>(null),
    connecting = useRef(false),
    authGeneration = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++authGeneration.current;
    try {
      const data = await walletApi<{ address: string | null }>();
      if (id === authGeneration.current) setAddress(data.address);
    } catch {}
  }, []);
  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- Hydrate authenticated session state from the server.
    void refresh();
    const announced = (event: Event) => {
      const detail = (event as CustomEvent<WalletChoice>).detail;
      if (!detail?.info?.uuid || !detail.provider?.request) return;
      setChoices((current) =>
        current.some((v) => v.info.uuid === detail.info.uuid)
          ? current
          : [
              ...current,
              {
                info: {
                  uuid: detail.info.uuid,
                  name: detail.info.name.slice(0, 50),
                },
                provider: detail.provider,
              },
            ],
      );
    };
    window.addEventListener('eip6963:announceProvider', announced);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    const visibility = () => {
      if (document.visibilityState === 'visible' && !connecting.current)
        // oxlint-disable-next-line react/react-compiler -- Hydrate authenticated session state from the server.
        void refresh();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('eip6963:announceProvider', announced);
      document.removeEventListener('visibilitychange', visibility);
      // oxlint-disable-next-line react-hooks/exhaustive-deps -- Unsubscribe the provider selected most recently.
      cleanup.current?.();
      // oxlint-disable-next-line react-hooks/exhaustive-deps -- Cancel the most recent request on unmount.
      authGeneration.current++;
    };
  }, [refresh]);
  async function disconnect() {
    authGeneration.current++;
    setBusy(true);
    setError('');
    try {
      await walletApi({ action: 'disconnect' });
      setAddress(null);
      // oxlint-disable-next-line react-hooks/exhaustive-deps -- Unsubscribe the provider selected most recently.
      cleanup.current?.();
      cleanup.current = null;
      providerRef.current = null;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Please retry disconnecting.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function connect(chosen?: Provider) {
    if (connecting.current) return;
    const provider =
      chosen || (window as Window & { ethereum?: Provider }).ethereum;
    if (!provider) {
      setError(
        'Open this website in an EVM wallet browser, or install a browser wallet such as MetaMask or Rabby.',
      );
      return;
    }
    connecting.current = true;
    authGeneration.current++;
    setBusy(true);
    setError('');
    setStep('Choose your account in your wallet…');
    try {
      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
      })) as string[];
      const account = accounts?.[0];
      if (!account || !/^0x[a-f0-9]{40}$/i.test(account))
        throw new Error('Choose an EVM wallet account.');
      setStep('Switch to Robinhood Chain…');
      if (
        Number(await provider.request({ method: 'eth_chainId' })) !==
        RH_CHAIN.id
      ) {
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: RH_CHAIN_HEX }],
          });
        } catch (err) {
          const code =
            (
              err as {
                code?: number;
                data?: { originalError?: { code?: number } };
              }
            ).code ||
            (err as { data?: { originalError?: { code?: number } } }).data
              ?.originalError?.code;
          if (code !== 4902) throw err;
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: RH_CHAIN_HEX,
                chainName: RH_CHAIN.name,
                nativeCurrency: RH_CHAIN.nativeCurrency,
                rpcUrls: RH_CHAIN.rpcUrls.default.http,
                blockExplorerUrls: [RH_CHAIN.blockExplorers.default.url],
              },
            ],
          });
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: RH_CHAIN_HEX }],
          });
        }
      }
      if (
        Number(await provider.request({ method: 'eth_chainId' })) !==
        RH_CHAIN.id
      )
        throw new Error('Select Robinhood Chain in your wallet.');
      setStep('Sign the free login message in your wallet…');
      const challenge = await walletApi<{ message: string }>({
        action: 'challenge',
        address: account,
      });
      const hex =
        '0x' +
        Array.from(new TextEncoder().encode(challenge.message), (byte) =>
          byte.toString(16).padStart(2, '0'),
        ).join('');
      const signature = await provider.request({
        method: 'personal_sign',
        params: [hex, account],
      });
      const current = (await provider.request({
        method: 'eth_accounts',
      })) as string[];
      if (
        current[0]?.toLowerCase() !== account.toLowerCase() ||
        Number(await provider.request({ method: 'eth_chainId' })) !==
          RH_CHAIN.id
      )
        throw new Error('Your wallet changed. Connect again.');
      const data = await walletApi<{ address: string }>({
        action: 'verify',
        message: challenge.message,
        signature,
      });
      setAddress(data.address);
      providerRef.current = provider;
      // oxlint-disable-next-line react-hooks/exhaustive-deps -- Unsubscribe the provider selected most recently.
      cleanup.current?.();
      const changed = () => {
        if (connecting.current) return;
        authGeneration.current++;
        setAddress(null);
        setError(
          'Your wallet account or network changed. Reconnect to save scores.',
        );
        void walletApi({ action: 'disconnect' }).catch(() => {});
      };
      provider.on?.('accountsChanged', changed);
      provider.on?.('chainChanged', changed);
      provider.on?.('disconnect', changed);
      cleanup.current = () => {
        provider.removeListener?.('accountsChanged', changed);
        provider.removeListener?.('chainChanged', changed);
        provider.removeListener?.('disconnect', changed);
      };
      setOpen(false);
    } catch (err) {
      const code = (err as { code?: number })?.code;
      setError(
        code === 4001
          ? 'Request cancelled. Your game is still here.'
          : err instanceof Error
            ? err.message
            : 'Could not connect. Please retry.',
      );
    } finally {
      connecting.current = false;
      setBusy(false);
      setStep('');
    }
  }
  return (
    <WalletContext.Provider
      value={{
        address,
        busy,
        open: () => {
          setError('');
          setOpen(true);
        },
        refresh,
      }}
    >
      {children}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent
          className="holiday-dialog wallet-dialog"
          showCloseButton={!busy}
        >
          <DialogHeader>
            <DialogTitle>
              {address
                ? 'Your travel identity.'
                : 'One wallet. All your good times.'}
            </DialogTitle>
            <DialogDescription>
              Link an EVM wallet on Robinhood Chain to keep your endless records
              across devices.
            </DialogDescription>
          </DialogHeader>
          {address ? (
            <div className="wallet-connected">
              <Check size={30} />
              <b>{shortAddress(address)}</b>
              <span>ROBINHOOD CHAIN · VERIFIED</span>
              <a
                href={`${RH_CHAIN.blockExplorers.default.url}/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View address <ExternalLink size={14} />
              </a>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void disconnect()}
              >
                DISCONNECT
              </Button>
              <small>Disconnecting keeps your saved records.</small>
            </div>
          ) : (
            <div className="wallet-options">
              {choices.length ? (
                choices.map((choice) => (
                  <Button
                    key={choice.info.uuid}
                    variant="outline"
                    disabled={busy}
                    onClick={() => void connect(choice.provider)}
                  >
                    <Wallet size={18} />
                    {choice.info.name}
                  </Button>
                ))
              ) : (
                <Button
                  className="primary-button"
                  disabled={busy}
                  onClick={() => void connect()}
                >
                  <Wallet size={18} /> CONNECT WALLET
                </Button>
              )}
              <p>
                A free sign-in signature. No transaction, gas payment or token
                approval. Your wallet address will appear with your score on the
                public leaderboard.
              </p>
            </div>
          )}
          {busy && <output>{step || 'Updating your connection…'}</output>}
          {error && (
            <p className="endless-notice" role="alert">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </WalletContext.Provider>
  );
}
export function WalletButton() {
  const wallet = useWallet();
  return (
    <Button
      variant="outline"
      className="wallet-button"
      onClick={wallet.open}
      disabled={wallet.busy}
    >
      <Wallet size={16} />
      <span>
        {wallet.address ? shortAddress(wallet.address) : 'CONNECT WALLET'}
      </span>
    </Button>
  );
}
