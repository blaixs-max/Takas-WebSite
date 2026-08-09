import { supabase, supabaseConfigured } from './supabase';

/**
 * Yönetim kuyrukları.
 *
 * Yetkiyi istemci belirlemez: her fonksiyon sunucuda `is_admin()` kontrolünden
 * geçer. Buradaki `amIAdmin()` yalnızca arayüzü sürmek içindir — giriş
 * noktasını gizlemek bir güvenlik önlemi değil, gürültü azaltmadır.
 */

export async function amIAdmin(): Promise<boolean> {
  if (!supabaseConfigured || !supabase) return false;
  const { data, error } = await supabase.rpc('is_admin');
  if (error) return false;
  return data === true;
}

export interface PhotoQueueRow {
  photoId: string;
  productId: string;
  productTitle: string;
  slot: string;
  storagePath: string;
  beklemeSaati: number;
}

export async function loadPhotoQueue(): Promise<PhotoQueueRow[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.rpc('admin_photo_queue', { p_limit: 50 });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    photoId: r.photo_id as string,
    productId: r.product_id as string,
    productTitle: (r.product_title as string) ?? 'İsimsiz ilan',
    slot: r.slot as string,
    storagePath: r.storage_path as string,
    beklemeSaati: Number(r.bekleme_saati ?? 0),
  }));
}

export interface DisputeQueueRow {
  disputeId: string;
  tradeId: string;
  disputeStatus: 'OPEN' | 'NEEDS_EVIDENCE';
  reason: string;
  productTitle: string;
  points: number;
  esiginUstunde: boolean;
  kanitSayisi: number;
  beklemeSaati: number;
}

export async function loadDisputeQueue(): Promise<DisputeQueueRow[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.rpc('admin_dispute_queue', { p_limit: 50 });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    disputeId: r.dispute_id as string,
    tradeId: r.trade_id as string,
    disputeStatus: r.dispute_status as DisputeQueueRow['disputeStatus'],
    reason: (r.reason as string) ?? '',
    productTitle: (r.product_title as string) ?? 'İlan kaldırılmış',
    points: Number(r.points ?? 0),
    esiginUstunde: r.esigin_ustunde === true,
    kanitSayisi: Number(r.kanit_sayisi ?? 0),
    beklemeSaati: Number(r.bekleme_saati ?? 0),
  }));
}

export type AdminResult = { ok: true } | { ok: false; message: string };

export async function moderatePhoto(
  photoId: string,
  uygun: boolean,
  gerekce?: string,
): Promise<AdminResult> {
  if (!supabaseConfigured || !supabase) return { ok: false, message: 'Sunucu bağlantısı yok.' };
  const { error } = await supabase.rpc('admin_moderate_photo', {
    p_photo_id: photoId,
    p_uygun: uygun,
    p_gerekce: gerekce ?? null,
  });
  if (error) return { ok: false, message: cevir(error.message) };
  return { ok: true };
}

export async function resolveDispute(
  disputeId: string,
  kabul: boolean,
  not: string,
  kargoHasari = false,
  iadeKargoTl?: number,
): Promise<AdminResult> {
  if (!supabaseConfigured || !supabase) return { ok: false, message: 'Sunucu bağlantısı yok.' };
  const { error } = await supabase.rpc('admin_resolve_dispute', {
    p_dispute_id: disputeId,
    p_kabul: kabul,
    p_not: not,
    p_kargo_hasari: kargoHasari,
    p_iade_kargo_tl: iadeKargoTl ?? null,
  });
  if (error) return { ok: false, message: cevir(error.message) };
  return { ok: true };
}

/** İtirazın kanıt karelerinin görüntülenebilir bağlantıları. */
export async function disputeEvidenceUrls(disputeId: string): Promise<string[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data } = await supabase
    .from('dispute_evidence')
    .select('storage_path')
    .eq('dispute_id', disputeId);
  if (!data?.length) return [];
  const esleme = await imzaliBaglantilar(
    'dispute-evidence',
    data.map((e) => e.storage_path as string),
  );
  return Object.values(esleme);
}

/**
 * Özel kovadaki kareler için kısa ömürlü bağlantı üretir.
 *
 * Dizi değil, yol→bağlantı eşlemesi döner. Bazı yollar için bağlantı
 * üretilemeyebilir; dizi dönseydi eksik satırlar sırayı kaydırır ve kareler
 * yanlış görsele bağlanırdı.
 */
export async function imzaliBaglantilar(
  bucket: string,
  paths: string[],
): Promise<Record<string, string>> {
  if (!supabaseConfigured || !supabase || paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, 300);
  if (error || !data) return {};
  const esleme: Record<string, string> = {};
  for (const d of data) {
    if (d.path && d.signedUrl) esleme[d.path] = d.signedUrl;
  }
  return esleme;
}

function cevir(mesaj: string): string {
  if (mesaj.includes('yönetici yetkisi')) return 'Bu işlem için yönetici yetkisi gerekiyor.';
  if (mesaj.includes('ret gerekçesi')) return 'Ret gerekçesi yazmalısınız.';
  if (mesaj.includes('karar gerekçesi')) return 'Karar gerekçesi yazmalısınız.';
  if (mesaj.includes('zaten sonuçlanmış')) return 'Bu itiraz başka biri tarafından sonuçlandırılmış.';
  if (mesaj.includes('bulunamadı')) return 'Kayıt bulunamadı, kuyruk tazelenecek.';
  return 'İşlem tamamlanamadı. Tekrar deneyin.';
}
