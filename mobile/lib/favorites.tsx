import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
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
