import { useCallback, useEffect, useState } from 'react';
import { DEMO_WALLET, loadWallet, WalletData } from '../lib/wallet';

interface UseWallet {
  data: WalletData;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
}

/** Cüzdan verisini yükler; pull-to-refresh ve hata durumu yönetir. */
export function useWallet(): UseWallet {
  const [data, setData] = useState<WalletData>(DEMO_WALLET);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (isRefresh: boolean) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const result = await loadWallet();
      setData(result);
      setError(null);
    } catch (e) {
      // Hata olursa demo veriye düş; sessizce kırılma
      setData(DEMO_WALLET);
      setError(e instanceof Error ? e.message : 'Cüzdan yüklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    run(false);
  }, [run]);

  return { data, loading, refreshing, error, refresh: () => run(true) };
}
