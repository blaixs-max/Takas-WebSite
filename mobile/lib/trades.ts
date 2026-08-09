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
 *
 * quote_trade_price() değil my_trade_quote() çağrılır: iç fonksiyon çağıranı
 * doğrulamıyordu ve kargo maliyeti ile komisyonu da döndürüyordu. Sarmalayıcı
 * çağıranın takasın tarafı olduğunu doğrular, marjı döndürmez.
 */
export async function quotePrice(tradeId: string): Promise<PriceQuote | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.rpc('my_trade_quote', { p_trade_id: tradeId });
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
  /** Açık itiraz varsa kimliği ve durumu; yoksa null. */
  acikItiraz: { id: string; kanitBekleniyor: boolean } | null;
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
    // Tek parça dize: birleştirilmiş bir select ifadesini supabase-js tip
    // olarak çözemiyor ve satırlar `GenericStringError`'a düşüyor.
    .select(
      'id, status, points, product_id, buyer_id, deadline_at, delivered_at, dispute_reason, products(title), disputes(id, status)',
    )
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((t) => {
    const urun = t.products as { title?: string } | { title?: string }[] | null;
    const baslik = Array.isArray(urun) ? (urun[0]?.title ?? null) : (urun?.title ?? null);

    const itirazlar = (t.disputes ?? []) as { id: string; status: string }[];
    const acik = itirazlar.find((d) => d.status === 'OPEN' || d.status === 'NEEDS_EVIDENCE');

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
      acikItiraz: acik ? { id: acik.id, kanitBekleniyor: acik.status === 'NEEDS_EVIDENCE' } : null,
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

/** Kargo öncesi iptal. Satıcı onayı gerekmez (Ana Doküman 5.1). */
export async function cancelTrade(tradeId: string): Promise<ActionResult> {
  if (!supabaseConfigured || !supabase) return { ok: false, message: 'Sunucu bağlantısı yok.' };
  const { data, error } = await supabase.rpc('cancel_trade', { p_trade_id: tradeId });
  if (error) return { ok: false, message: cevirAksiyon(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, status: (row?.status ?? 'REFUNDED') as TradeStatus };
}

export type DisputeResult =
  | { ok: true; disputeId: string; kanitBekleniyor: boolean }
  | { ok: false; message: string };

/**
 * İtiraz açar: 48 saatlik sayaç durur ve kanıt istenir.
 *
 * Talep `NEEDS_EVIDENCE` doğar. 24 saat içinde kanıt yüklenmezse sunucu talebi
 * reddeder ve sayaç kaldığı yerden devam eder — ekran kullanıcıyı kanıt
 * yüklemeye yönlendirmek zorunda, yoksa itiraz sessizce düşer.
 */
export async function openDispute(tradeId: string, reason: string): Promise<DisputeResult> {
  if (!supabaseConfigured || !supabase) return { ok: false, message: 'Sunucu bağlantısı yok.' };
  const { data, error } = await supabase.rpc('open_dispute', {
    p_trade_id: tradeId,
    p_reason: reason,
  });
  if (error) return { ok: false, message: cevirAksiyon(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) return { ok: false, message: 'İtiraz açıldı ama kimliği alınamadı.' };
  return {
    ok: true,
    disputeId: row.id as string,
    kanitBekleniyor: row.status === 'NEEDS_EVIDENCE',
  };
}

/** İtiraza görsel kanıt ekler. Yol düzeni: {kullanici_id}/{itiraz_id}/{ad}.jpg */
export async function uploadDisputeEvidence(
  disputeId: string,
  localUri: string,
  note?: string,
): Promise<ActionResult> {
  if (!supabaseConfigured || !supabase) return { ok: false, message: 'Sunucu bağlantısı yok.' };

  const { data: oturum } = await supabase.auth.getUser();
  const uid = oturum?.user?.id;
  if (!uid) return { ok: false, message: 'Oturum bulunamadı.' };

  const uzanti = localUri.split('.').pop()?.toLowerCase() === 'png' ? 'png' : 'jpg';
  // Aynı itiraza birden çok kanıt eklenebilmeli; ad çakışmasın diye sıra veriyoruz.
  const yol = `${uid}/${disputeId}/${Date.now()}.${uzanti}`;

  let bytes: Uint8Array;
  try {
    const { File } = await import('expo-file-system');
    bytes = await new File(localUri).bytes();
  } catch {
    return { ok: false, message: 'Fotoğraf okunamadı.' };
  }

  const { error: yuklemeHatasi } = await supabase.storage
    .from('dispute-evidence')
    .upload(yol, bytes, { contentType: uzanti === 'png' ? 'image/png' : 'image/jpeg' });
  if (yuklemeHatasi) {
    return { ok: false, message: 'Kanıt yüklenemedi. Bağlantınızı kontrol edin.' };
  }

  const { data, error } = await supabase.rpc('add_dispute_evidence', {
    p_dispute_id: disputeId,
    p_storage_path: yol,
    p_note: note ?? null,
  });
  if (error) return { ok: false, message: cevirAksiyon(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, status: (row?.status ?? 'OPEN') as TradeStatus };
}

function cevirAksiyon(mesaj: string): string {
  if (mesaj.includes('yalnızca alıcı onaylayabilir'))
    return 'Bu takası yalnızca alıcı onaylayabilir.';
  if (mesaj.includes('yalnızca alıcı itiraz')) return 'Bu takasa yalnızca alıcı itiraz edebilir.';
  if (mesaj.includes('onaylanabilir durumda değil')) return 'Ürün henüz kargoya verilmedi.';
  if (mesaj.includes('itiraz açılamaz')) return 'Bu aşamada itiraz açılamaz.';
  if (mesaj.includes('gerekçesi zorunludur')) return 'Lütfen itiraz gerekçesi yazın.';
  if (mesaj.includes('oturum bulunamadı')) return 'Giriş yapmalısınız.';
  if (mesaj.includes('itiraz süresi geçmiş')) {
    return 'İtiraz süresi geçmiş. Teslimattan sonra 48 saat içinde bildirilmeliydi.';
  }
  if (mesaj.includes('kargoya verildikten sonra iptal edilemez')) {
    return 'Ürün kargoya verildi; artık iptal değil iade süreci işler.';
  }
  if (mesaj.includes('yalnızca alıcı iptal')) return 'Bu takası yalnızca alıcı iptal edebilir.';
  if (mesaj.includes('kapanmış itiraza')) return 'Bu itiraz sonuçlanmış, kanıt eklenemez.';
  if (mesaj.includes('kendi klasörünüzde')) return 'Kanıt yüklenemedi, tekrar deneyin.';
  return 'İşlem tamamlanamadı. Tekrar deneyin.';
}

function cevir(mesaj: string): string {
  if (mesaj.includes('yetersiz bakiye')) return 'Takas puanınız yetmiyor.';
  if (mesaj.includes('kendi ilanınızı')) return 'Kendi ilanınızı takas edemezsiniz.';
  if (mesaj.includes('satın alınabilir durumda değil')) return 'Bu ilan şu anda müsait değil.';
  if (mesaj.includes('bulunamadı')) return 'İlan bulunamadı.';
  return 'Takas başlatılamadı. Bağlantınızı kontrol edip tekrar deneyin.';
}
