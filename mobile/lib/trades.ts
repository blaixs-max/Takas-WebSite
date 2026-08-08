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

export type TradeStatus =
  | 'CREATED'
  | 'POINTS_HELD'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'DISPUTED'
  | 'REFUNDED';

export interface TradeRow {
  id: string;
  status: TradeStatus;
  points: number;
  productId: string | null;
  productTitle: string | null;
  /** Oturumdaki kullanıcı bu takasın alıcısı mı? Aksiyonlar buna bağlı. */
  benAliciyim: boolean;
  /** Sayaç dolduğunda ne olacağı duruma göre değişir; null ise sayaç yok. */
  deadlineAt: string | null;
  deliveredAt: string | null;
  disputeReason: string | null;
}

/** Kullanıcının taraf olduğu takaslar, yenisi üstte. */
export async function loadMyTrades(): Promise<TradeRow[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data: oturum } = await supabase.auth.getUser();
  const uid = oturum?.user?.id;
  if (!uid) return [];

  // RLS zaten yalnızca taraf olunan takasları veriyor; ürün başlığı ilişki
  // üzerinden geliyor, ayrı sorgu atmıyoruz.
  const { data, error } = await supabase
    .from('trades')
    .select(
      'id, status, points, product_id, buyer_id, deadline_at, delivered_at, dispute_reason, products(title)',
    )
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((t) => {
    const urun = t.products as { title?: string } | { title?: string }[] | null;
    const baslik = Array.isArray(urun) ? (urun[0]?.title ?? null) : (urun?.title ?? null);
    return {
      id: t.id as string,
      status: t.status as TradeStatus,
      points: Number(t.points ?? 0),
      productId: (t.product_id as string) ?? null,
      productTitle: baslik,
      benAliciyim: t.buyer_id === uid,
      deadlineAt: (t.deadline_at as string) ?? null,
      deliveredAt: (t.delivered_at as string) ?? null,
      disputeReason: (t.dispute_reason as string) ?? null,
    };
  });
}

export type ActionResult = { ok: true; status: TradeStatus } | { ok: false; message: string };

/**
 * "Teslim aldım" — puanı havuzdan çıkarıp satıcıya geçirir.
 *
 * Geri alınamaz: onaydan sonra itiraz kapısı kapanır. Ekran bunu sormadan
 * çağırmamalı.
 */
export async function confirmDelivery(tradeId: string): Promise<ActionResult> {
  if (!supabaseConfigured || !supabase) return { ok: false, message: 'Sunucu bağlantısı yok.' };
  const { data, error } = await supabase.rpc('confirm_delivery', { p_trade_id: tradeId });
  if (error) return { ok: false, message: cevirAksiyon(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, status: (row?.status ?? 'COMPLETED') as TradeStatus };
}

/** İtiraz açar: 48 saatlik sayaç durur, karar insana kalır. */
export async function openDispute(tradeId: string, reason: string): Promise<ActionResult> {
  if (!supabaseConfigured || !supabase) return { ok: false, message: 'Sunucu bağlantısı yok.' };
  const { data, error } = await supabase.rpc('open_dispute', {
    p_trade_id: tradeId,
    p_reason: reason,
  });
  if (error) return { ok: false, message: cevirAksiyon(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, status: (row?.status ?? 'DISPUTED') as TradeStatus };
}

function cevirAksiyon(mesaj: string): string {
  if (mesaj.includes('yalnızca alıcı onaylayabilir'))
    return 'Bu takası yalnızca alıcı onaylayabilir.';
  if (mesaj.includes('yalnızca alıcı itiraz')) return 'Bu takasa yalnızca alıcı itiraz edebilir.';
  if (mesaj.includes('onaylanabilir durumda değil')) return 'Ürün henüz kargoya verilmedi.';
  if (mesaj.includes('itiraz açılamaz')) return 'Bu aşamada itiraz açılamaz.';
  if (mesaj.includes('gerekçesi zorunludur')) return 'Lütfen itiraz gerekçesi yazın.';
  if (mesaj.includes('oturum bulunamadı')) return 'Giriş yapmalısınız.';
  return 'İşlem tamamlanamadı. Tekrar deneyin.';
}

function cevir(mesaj: string): string {
  if (mesaj.includes('yetersiz bakiye')) return 'Takas puanınız yetmiyor.';
  if (mesaj.includes('kendi ilanınızı')) return 'Kendi ilanınızı takas edemezsiniz.';
  if (mesaj.includes('satın alınabilir durumda değil')) return 'Bu ilan şu anda müsait değil.';
  if (mesaj.includes('bulunamadı')) return 'İlan bulunamadı.';
  return 'Takas başlatılamadı. Bağlantınızı kontrol edip tekrar deneyin.';
}
