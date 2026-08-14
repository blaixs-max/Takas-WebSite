import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './auth';
import { birlestir, bulutEkle, bulutSil, bulutTemizle } from './senkron';

/**
 * Alma sepeti — almak istenen ürün id'leri cihazda (AsyncStorage) saklanır.
 * "Takas et" anında her ürün ayrı takas + kargo olur (güvenli havuz her biri için).
 */
const STORAGE_KEY = 'kt:cart';

interface CartState {
  ids: string[];
  inCart: (id: string) => boolean;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  count: number;
}

const CartContext = createContext<CartState | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { user } = useAuth();
  /* Aynı oturum için birleştirme bir kez koşar. */
  const birlestirilen = useRef<string | null>(null);

  /**
   * Sepet oturum açıkken buluta senkron.
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
    birlestir('cart_items', ids).then((birlesim) => {
      if (!iptal) setIds(birlesim);
    });
    return () => {
      iptal = true;
    };
    // `ids` bilerek bağımlılık değil: birleştirme oturum başına bir kez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, user]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setIds(JSON.parse(raw));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids)).catch(() => {});
  }, [ids, loaded]);

  const inCart = useCallback((id: string) => ids.includes(id), [ids]);
  const toggle = useCallback((id: string) => {
    setIds((cur) => {
      const vardi = cur.includes(id);
      /* Bulut yazımı beklenmiyor: liste zaten cihazda güncellendi ve ağ
         yokken de çalışmaya devam etmeli. */
      if (vardi) void bulutSil('cart_items', id);
      else void bulutEkle('cart_items', [id]);
      return vardi ? cur.filter((x) => x !== id) : [...cur, id];
    });
  }, []);
  const remove = useCallback((id: string) => {
    void bulutSil('cart_items', id);
    setIds((cur) => cur.filter((x) => x !== id));
  }, []);
  /* Takas açıldıktan sonra sepet boşalıyor; bulutta kalsaydı bir sonraki
     açılışta birleştirme onu geri getirirdi. */
  const clear = useCallback(() => {
    void bulutTemizle('cart_items');
    setIds([]);
  }, []);

  return (
    <CartContext.Provider value={{ ids, inCart, toggle, remove, clear, count: ids.length }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart, CartProvider içinde kullanılmalı');
  return ctx;
}
