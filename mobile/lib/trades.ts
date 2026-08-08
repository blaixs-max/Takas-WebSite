import { supabase, supabaseConfigured } from './supabase';

export type StartTradeResult =
  | { ok: true; tradeId: string; points: number }
  | { ok: false; message: string };

/**
 * Takası başlatır.
 *
 * `create_trade` RPC'sini çağırır. Bu çağrı sunucuda tek bir işlemde şunları
 * yapar: ürünü kilitler, hâlâ satılabilir mi bakar, takası açar, ilanı rezerve
 * eder ve alıcının puanını güvenli havuza alır. Herhangi biri başarısız olursa
 * hepsi geri sarılır — yarım kalmış bir rezervasyon oluşmaz.
 *
 * İstemci takası doğrudan insert ETMEZ: rezervasyon ve emanet oradan işliyor.
 */
export async function startTrade(productId: string): Promise<StartTradeResult> {
  if (!supabaseConfigured || !supabase) {
    return { ok: false, message: 'Sunucu bağlantısı yok. Anahtarlar tanımlı değil.' };
  }

  const { data: oturum } = await supabase.auth.getSession();
  if (!oturum?.session) {
    return { ok: false, message: 'Takas için giriş yapmalısınız.' };
  }

  const { data, error } = await supabase.rpc('create_trade', { p_product_id: productId });
  if (error) return { ok: false, message: cevir(error.message) };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) return { ok: false, message: 'Takas açıldı ama kimliği alınamadı.' };
  return { ok: true, tradeId: row.id as string, points: Number(row.points ?? 0) };
}

export interface PriceQuote {
  sizeClass: string;
  shippingTl: number;
  serviceFeeTl: number;
  transactionFeeTl: number;
  totalTl: number;
}

/**
 * Takasın kargo + hizmet + işlem payı kırılımını sunucudan alır.
 * Bu rakamlar istemcide hesaplanmaz; tarifeden türetilir.
 */
export async function quotePrice(tradeId: string): Promise<PriceQuote | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.rpc('quote_trade_price', { p_trade_id: tradeId });
  if (error) return null;
  const q = Array.isArray(data) ? data[0] : data;
  if (!q) return null;
  return {
    sizeClass: q.size_class,
    shippingTl: Number(q.shipping_tl),
    serviceFeeTl: Number(q.service_fee_tl),
    transactionFeeTl: Number(q.transaction_fee_tl),
    totalTl: Number(q.total_tl),
  };
}

function cevir(mesaj: string): string {
  if (mesaj.includes('yetersiz bakiye')) return 'Takas puanınız yetmiyor.';
  if (mesaj.includes('kendi ilanınızı')) return 'Kendi ilanınızı takas edemezsiniz.';
  if (mesaj.includes('satın alınabilir durumda değil')) return 'Bu ilan şu anda müsait değil.';
  if (mesaj.includes('bulunamadı')) return 'İlan bulunamadı.';
  return 'Takas başlatılamadı. Bağlantınızı kontrol edip tekrar deneyin.';
}
