import { useCallback, useEffect, useState } from 'react';
import { DEMO_PRODUCTS, Product } from '../data/products';
import { loadProduct, loadProducts } from '../lib/products';

interface UseProducts {
  products: Product[];
  featured: Product[];
  source: 'live' | 'demo';
  loading: boolean;
  refreshing: boolean;
  refresh: () => void;
}

export function useProducts(): UseProducts {
  const [products, setProducts] = useState<Product[]>(DEMO_PRODUCTS);
  const [source, setSource] = useState<'live' | 'demo'>('demo');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const run = useCallback(async (isRefresh: boolean) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const res = await loadProducts();
      setProducts(res.products);
      setSource(res.source);
    } catch {
      setProducts(DEMO_PRODUCTS);
      setSource('demo');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    run(false);
  }, [run]);

  return {
    products,
    featured: products.filter((p) => p.badge),
    source,
    loading,
    refreshing,
    refresh: () => run(true),
  };
}

export function useProduct(id: string | undefined) {
  const [product, setProduct] = useState<Product | undefined>(
    id ? DEMO_PRODUCTS.find((p) => p.id === id) : undefined,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadProduct(id)
      .then((p) => active && setProduct(p))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  return { product, loading };
}
