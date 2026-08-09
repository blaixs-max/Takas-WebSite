import { DEMO_PRODUCTS, Product, ProductRow, depolamaYoluMu, rowToProduct } from '../data/products';
import { imzaliBaglantilar } from './admin';
import { supabase, supabaseConfigured } from './supabase';

export interface ProductsResult {
  source: 'live' | 'demo';
  products: Product[];
}

const COLS =
  'id, title, points, condition, category, location, distance_km, rating, market_value, badge, description, image_key, gallery_keys, seller_name, seller_initials, seller_trust, seller_trades';

/**
 * Kapak karelerinin imzalı bağlantılarını toplu üretir.
 *
 * `listing-photos` kovası özeldir; kapak karesine doğrudan URL ile erişilemez.
 * Yol→bağlantı eşlemesi döner, dizi değil: bir yol için bağlantı üretilemezse
 * dizi kayar ve ilanlar birbirinin fotoğrafını gösterirdi.
 */
async function kapakBaglantilari(satirlar: ProductRow[]): Promise<Record<string, string>> {
  const yollar = satirlar
    .map((r) => r.image_key)
    .filter((k): k is string => depolamaYoluMu(k));
  if (yollar.length === 0) return {};
  return imzaliBaglantilar('listing-photos', yollar);
}

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

  const satirlar = data as ProductRow[];
  const kapaklar = await kapakBaglantilari(satirlar);
  return {
    source: 'live',
    products: satirlar.map((r) => rowToProduct(r, kapaklar[r.image_key])),
  };
}

/** Tek ürün; canlıda bulunamazsa demo'dan dener. */
export async function loadProduct(id: string): Promise<Product | undefined> {
  if (supabaseConfigured && supabase) {
    const { data } = await supabase.from('products').select(COLS).eq('id', id).maybeSingle();
    if (data) {
      const r = data as ProductRow;
      const kapaklar = await kapakBaglantilari([r]);
      return rowToProduct(r, kapaklar[r.image_key]);
    }
  }
  return DEMO_PRODUCTS.find((p) => p.id === id);
}
