import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './auth';
import { birlestir, bulutEkle, bulutSil } from './senkron';

/**
 * Favori deposu — favori ürün id'leri cihazda (AsyncStorage) saklanır.
 * Backend gerektirmez; oturum açılınca ileride Supabase'e senkron edilebilir.
 */
const STORAGE_KEY = 'kt:favorites';

interface FavoritesState {
  ids: string[];
  isFavorite: (id: string) => boolean;
  toggle: (id: string) => void;
  count: number;
}

const FavoritesContext = createContext<FavoritesState | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { user } = useAuth();
  /* Aynı oturum için birleştirme bir kez koşar. */
  const birlestirilen = useRef<string | null>(null);

  /**
   * Favoriler oturum açıkken buluta senkron.
   *
   * Oturum açılınca cihazdaki liste ile buluttaki birleşiyor ve sonuç iki
   * tarafa birden yazılıyor. Ayrıntısı ve neden "bulut kazanır" olmadığı
   * `lib/senkron.ts` içinde.
   */
  useEffect(() => {
    if (!loaded || !user) return;
    if (birlestirilen.current === user.id) return;
    birlestirilen.current = user.id;
    let iptal = false;
    birlestir('favorites', ids).then((birlesim) => {
      if (!iptal) setIds(birlesim);
    });
    return () => {
      iptal = true;
    };
    // `ids` bilerek bağımlılık değil: birleştirme oturum başına bir kez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, user]);

  // İlk açılışta diskten yükle
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setIds(JSON.parse(raw));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Değişince diske yaz
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids)).catch(() => {});
  }, [ids, loaded]);

  const isFavorite = useCallback((id: string) => ids.includes(id), [ids]);

  const toggle = useCallback((id: string) => {
    setIds((cur) => {
      const vardi = cur.includes(id);
      /* Bulut yazımı beklenmiyor: liste zaten cihazda güncellendi ve ağ
         yokken de çalışmaya devam etmeli. */
      if (vardi) void bulutSil('favorites', id);
      else void bulutEkle('favorites', [id]);
      return vardi ? cur.filter((x) => x !== id) : [...cur, id];
    });
  }, []);

  return (
    <FavoritesContext.Provider value={{ ids, isFavorite, toggle, count: ids.length }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesState {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites, FavoritesProvider içinde kullanılmalı');
  return ctx;
}
