import { File } from 'expo-file-system';
import { PhotoSlot } from '../data/photoSlots';
import { imzaliBaglantilar } from './admin';
import { supabase, supabaseConfigured } from './supabase';

export type ModerasyonDurumu = 'approved' | 'pending' | 'rejected';

export type UploadResult =
  | { ok: true; photoId: string; durum: ModerasyonDurumu; gerekce?: string }
  | { ok: false; message: string };

/**
 * Depo hatasını kullanıcının yapabileceği bir şeye çevirir.
 *
 * Üç sebep gerçekten farklı davranış gerektiriyor: dosya çok büyükse yeniden
 * çekmek gerekir, yetki hatasında yeniden denemek işe yaramaz, ağ hatasında
 * yarar. Hepsine aynı cümleyi yazmak, üçünü de yanlış yönlendirmek demek.
 */
function yuklemeHatasiniCevir(ham: string): string {
  const m = ham.toLowerCase();
  if (m.includes('exceeded the maximum allowed size') || m.includes('payload too large')) {
    return 'Fotoğraf çok büyük. Biraz daha uzaktan çekip tekrar dene.';
  }
  if (m.includes('mime type') || m.includes('invalid_mime')) {
    return 'Bu dosya biçimi desteklenmiyor. Kamerayla çekilmiş bir kare kullan.';
  }
  if (m.includes('row-level security') || m.includes('unauthorized') || m.includes('403')) {
    return 'Bu kareyi yükleme izni alınamadı. Çıkış yapıp tekrar giriş yapmayı dene.';
  }
  return 'Fotoğraf yüklenemedi. Tekrar dene.';
}

/**
 * Bir kareyi depoya yükler ve product_photos'a kaydeder.
 *
 * Yol düzeni: {satici_id}/{ilan_id}/{slot}.jpg — ilk klasör sahibi belirtir,
 * depolama politikası da bunun üzerinden çalışır.
 *
 * Kayıt `pending` durumuyla açılır. Bu ONAY DEĞİLDİR: kareyi ilanla birlikte
 * **yönetici** inceler (2026-09-08'den beri; öncesinde bir görüntü modeli
 * bakıyordu). Satıcı bütün kareleri çektikten sonra ilanı onaya gönderir
 * (`submitListing`), yönetici onaylarsa kareler onaylanır ve ilan vitrine
 * çıkar.
 */
export async function uploadPhoto(
  productId: string,
  slot: PhotoSlot,
  localUri: string,
): Promise<UploadResult> {
  if (!supabaseConfigured || !supabase) {
    return { ok: false, message: 'Sunucu bağlantısı yok.' };
  }

  const { data: oturum } = await supabase.auth.getUser();
  const uid = oturum?.user?.id;
  if (!uid) return { ok: false, message: 'Oturum bulunamadı.' };

  const uzanti = localUri.split('.').pop()?.toLowerCase() === 'png' ? 'png' : 'jpg';
  const yol = `${uid}/${productId}/${slot}.${uzanti}`;

  // Hermes'te fetch(file://).blob() güvenilir değil; dosyayı doğrudan
  // baytlarıyla okuyoruz (expo-file-system SDK 54 File API'si).
  let bytes: Uint8Array;
  try {
    bytes = await new File(localUri).bytes();
  } catch {
    return { ok: false, message: 'Fotoğraf okunamadı.' };
  }

  const { error: yuklemeHatasi } = await supabase.storage
    .from('listing-photos')
    .upload(yol, bytes, {
      contentType: uzanti === 'png' ? 'image/png' : 'image/jpeg',
      upsert: true,
    });

  if (yuklemeHatasi) {
    /* Sebep ayrıştırılıyor, ham mesaj gösterilmiyor: depo hataları İngilizce
       ve teknik. Tanımadığımız hatada nötr bir cümle kalıyor — ağı suçlamak
       yerine "tekrar dene". */
    console.error('[uploadPhoto] depo hatası', yuklemeHatasi.message);
    return { ok: false, message: yuklemeHatasiniCevir(yuklemeHatasi.message) };
  }

  // Aynı slot yeniden çekilirse eski satır değişmeli, ikinci satır oluşmamalı.
  const { data, error } = await supabase
    .from('product_photos')
    .upsert(
      { product_id: productId, slot, storage_path: yol, moderation_status: 'pending' },
      { onConflict: 'product_id,slot' },
    )
    .select('id')
    .single();

  if (error || !data?.id) return { ok: false, message: 'Fotoğraf kaydedilemedi.' };

  return { ok: true, photoId: data.id as string, durum: 'pending' };
}

export interface PhotoRow {
  id: string;
  slot: PhotoSlot;
  storagePath: string;
  moderationStatus: 'pending' | 'approved' | 'rejected';
  moderationReason: string | null;
  /**
   * Kareyi göstermek için kısa ömürlü bağlantı.
   *
   * `listing-photos` kovası özeldir; depo yolu tek başına gösterilemez.
   * Bağlantı üretilemezse `null` — çekim ekranı o durumda kareyi "yüklendi"
   * ama önizlemesiz gösteriyor, sahte bir "çekilmedi" değil.
   */
  url: string | null;
}

/** İlanın karelerini durumlarıyla ve gösterilebilir bağlantılarıyla getirir. */
export async function loadPhotos(productId: string): Promise<PhotoRow[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data } = await supabase
    .from('product_photos')
    .select('id, slot, storage_path, moderation_status, moderation_reason')
    .eq('product_id', productId);
  if (!data) return [];

  const yollar = data.map((r) => r.storage_path as string).filter(Boolean);
  const baglantilar = await imzaliBaglantilar('listing-photos', yollar);

  return data.map((r) => ({
    id: r.id as string,
    slot: r.slot as PhotoSlot,
    storagePath: r.storage_path as string,
    moderationStatus: r.moderation_status as PhotoRow['moderationStatus'],
    moderationReason: (r.moderation_reason as string) ?? null,
    url: baglantilar[r.storage_path as string] ?? null,
  }));
}

export type SubmitResult = { ok: true } | { ok: false; message: string };

/**
 * İlanı yönetici onayına gönderir.
 *
 * Sunucu yalnızca fiziksel gerçeklere bakar: zorunlu kareler yüklü mü,
 * reddedilmiş zorunlu kare var mı, alt kategori seçili mi. Kalitesine karar
 * vermek yöneticinin işi. Onaylanınca ilan kendiliğinden vitrine çıkar ve
 * satıcıya bildirim gider; reddedilirse gerekçesiyle taslağa döner.
 */
export async function submitListing(productId: string): Promise<SubmitResult> {
  if (!supabaseConfigured || !supabase) return { ok: false, message: 'Sunucu bağlantısı yok.' };
  const { error } = await supabase.rpc('submit_listing', { p_product_id: productId });
  if (error) return { ok: false, message: cevir(error.message) };
  return { ok: true };
}

/** İncelemedeki ilanı taslağa geri çeker — satıcı bir şey değiştirmek istiyorsa. */
export async function withdrawListing(productId: string): Promise<SubmitResult> {
  if (!supabaseConfigured || !supabase) return { ok: false, message: 'Sunucu bağlantısı yok.' };
  const { error } = await supabase.rpc('withdraw_listing', { p_product_id: productId });
  if (error) return { ok: false, message: cevir(error.message) };
  return { ok: true };
}

function cevir(mesaj: string): string {
  if (mesaj.includes('eksik kare')) return 'Zorunlu karelerden bazıları eksik.';
  if (mesaj.includes('reddedilen kare yeniden çekilmeli')) {
    return 'Bir kare kabul edilmemiş. İşaretli kareyi yeniden çekip tekrar gönder.';
  }
  if (mesaj.includes('alt kategori')) return 'Önce bir alt kategori seç.';
  if (mesaj.includes('ilan sahibi')) return 'Bu ilan size ait değil.';
  if (mesaj.includes('yalnızca taslak ilan')) return 'Bu ilan zaten onaya gönderilmiş ya da yayında.';
  if (mesaj.includes('yalnızca incelemedeki ilan')) return 'Bu ilan incelemede değil.';
  return 'İlan gönderilemedi. Tekrar dene.';
}
