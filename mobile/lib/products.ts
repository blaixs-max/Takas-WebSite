import { DEMO_PRODUCTS, Product, ProductRow, rowToProduct } from '../data/products';
import { supabase, supabaseConfigured } from './supabase';

export interface ProductsResult {
  source: 'live' | 'demo';
  products: Product[];
}

const COLS =
  'id, title, points, condition, category, location, distance_km, rating, market_value, badge, description, image_key, gallery_keys, seller_name, seller_initials, seller_trust, seller_trades';

/** Aktif ilanları yükler; Supabase yoksa/boşsa demo'ya düşer. */
export async function loadProducts(): Promise<ProductsResult> {
  if (!supabaseConfigured || !supabase) return { source: 'demo', products: DEMO_PRODUCTS };

  const { data, error } = await supabase
    .from('products')
    .select(COLS)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    return { source: 'demo', products: DEMO_PRODUCTS };
  }
  return { source: 'live', products: (data as ProductRow[]).map(rowToProduct) };
}

/** Tek ürün; canlıda bulunamazsa demo'dan dener. */
export async function loadProduct(id: string): Promise<Product | undefined> {
  if (supabaseConfigured && supabase) {
    const { data } = await supabase.from('products').select(COLS).eq('id', id).maybeSingle();
    if (data) return rowToProduct(data as ProductRow);
  }
  return DEMO_PRODUCTS.find((p) => p.id === id);
}
