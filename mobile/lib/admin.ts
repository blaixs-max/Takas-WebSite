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

export interface CampaignStatus {
  aktif: boolean;
  kullaniciSayisi: number;
  kalanKontenjan: number;
  dagitilanPuan: number;
  /**
   * Yüksek kademede kalan yer (2026-08-18: ilk 50 kişi 1000+1000,
   * kalan 950 kişi 300+300).
   *
   * "Kalan kontenjan 950" tek başına yanıltıcı: asıl merak edilen yüksek
   * kademede kaç yer kaldığı, çünkü bütçenin büyük kısmı orada — 50 × 2000
   * ile 950 × 600 birbirine yakın iki rakam.
   */
  erkenKalan: number;
  erkenKullanici: number;
}

/**
 * Kampanya yükümlülüğü.
 *
 * Dağıtılan puan kalıcı bir borçtur ve süresi olmadığı için kendiliğinden
 * sönmez (Ana Doküman 2.4). Panelde durmasının sebebi bu: ölçülmeyen bütçe
 * yönetilemez.
 */
export async function campaignStatus(): Promise<CampaignStatus | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.rpc('campaign_status');
  if (error || !data) return null;
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    aktif: r.aktif === true,
    kullaniciSayisi: Number(r.kullanici_sayisi ?? 0),
    kalanKontenjan: Number(r.kalan_kontenjan ?? 0),
    dagitilanPuan: Number(r.dagitilan_puan ?? 0),
    erkenKalan: Number(r.erken_kalan ?? 0),
    erkenKullanici: Number(r.erken_kullanici ?? 0),
  };
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

/** Toplu onayın sonucu — kaçı geçti, kaçı takıldı. */
export interface TopluSonuc {
  onaylanan: number;
  basarisiz: number;
}

/**
 * Kuyruktaki kareleri toplu onaylar.
 *
 * Toplu inceleme akışının karşılığı: model kararsız kaldığında kare `pending`
 * kalıyor ve kuyruğa düşüyor. Bunlar genelde modelin emin olamadığı sıradan
 * ürün fotoğrafları; tek tek onaylamak kuyruğu büyüdükçe imkânsızlaşır.
 *
 * **Toplu reddetme yok, bilerek.** Onaylamak geri alınabilir bir karar —
 * yanlış onaylanan kare şikâyetle geri gelir. Reddetmek geri alınamaz:
 * `admin_moderate_photo` reddedilen kareyi depodan siliyor, kullanıcının
 * fotoğrafı yok oluyor. Otuz karenin tek dokunuşla silinmesi, yanlış düğmeye
 * basmanın bedelini kabul edilemez yapardı. Ret tek tek ve gerekçeyle kalıyor.
 *
 * Çağrılar sırayla gidiyor, paralel değil: her biri bir yazma işlemi ve
 * yönetim eylemi denetim kaydına giriyor. Otuz eşzamanlı yazmanın kazandıracağı
 * saniye, sıranın verdiği öngörülebilirliğe değmez.
 */
export async function approvePhotosBulk(photoIds: string[]): Promise<TopluSonuc> {
  const sonuc: TopluSonuc = { onaylanan: 0, basarisiz: 0 };
  for (const id of photoIds) {
    const r = await moderatePhoto(id, true);
    if (r.ok) sonuc.onaylanan += 1;
    else sonuc.basarisiz += 1;
  }
  return sonuc;
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

export interface ReportQueueRow {
  reportId: string;
  messageId: string;
  reason: string;
  note: string | null;
  sistemIsareti: boolean;
  mesaj: string;
  urun: string;
  beklemeSaati: number;
}

const NEDEN_ETIKET: Record<string, string> = {
  HARASSMENT: 'Taciz / hakaret',
  OFF_PLATFORM: 'Platform dışına yönlendirme',
  SCAM: 'Dolandırıcılık şüphesi',
  INAPPROPRIATE: 'Uygunsuz içerik',
  OTHER: 'Diğer',
};

export function nedenEtiketi(kod: string): string {
  return NEDEN_ETIKET[kod] ?? kod;
}

export async function loadReportQueue(): Promise<ReportQueueRow[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.rpc('admin_report_queue', { p_limit: 50 });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    reportId: r.report_id as string,
    messageId: r.message_id as string,
    reason: r.reason as string,
    note: (r.note as string) ?? null,
    sistemIsareti: r.sistem_isareti === true,
    mesaj: (r.mesaj as string) ?? '',
    urun: (r.urun as string) ?? 'İlan kaldırılmış',
    beklemeSaati: Number(r.bekleme_saati ?? 0),
  }));
}

/**
 * Şikâyeti karara bağlar.
 *
 * İhlal onaylandığında mesaj SİLİNMEZ: uyuşmazlıkta kayıt kanıttır. Sonuç,
 * gönderenin güven skoruna yazılır.
 */
export async function resolveReport(
  reportId: string,
  ihlal: boolean,
  not: string,
): Promise<AdminResult> {
  if (!supabaseConfigured || !supabase) return { ok: false, message: 'Sunucu bağlantısı yok.' };
  const { error } = await supabase.rpc('admin_resolve_report', {
    p_report_id: reportId,
    p_ihlal: ihlal,
    p_not: not,
  });
  if (error) return { ok: false, message: cevir(error.message) };
  return { ok: true };
}
