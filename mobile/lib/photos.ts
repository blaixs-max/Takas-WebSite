import { File } from 'expo-file-system';
import { PhotoSlot } from '../data/photoSlots';
import { supabase, supabaseConfigured } from './supabase';

export type UploadResult = { ok: true; photoId: string } | { ok: false; message: string };

/**
 * Bir kareyi depoya yükler ve product_photos'a kaydeder.
 *
 * Yol düzeni: {satici_id}/{ilan_id}/{slot}.jpg — ilk klasör sahibi belirtir,
 * depolama politikası da bunun üzerinden çalışır.
 *
 * Kayıt `pending` moderasyon durumuyla açılır. Bu ONAY DEĞİLDİR: yayın kapısı
 * yalnız `approved` kareyi geçirir. İnceleme photo-check fonksiyonunda yapılır.
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
    return { ok: false, message: 'Fotoğraf yüklenemedi. Bağlantınızı kontrol edin.' };
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

  // İncelemeyi tetikle. Başarısız olursa kare 'pending' kalır ve ilan insana
  // kuyruklanır — sessizce onaylanmaz, o yüzden hata burada yutulabilir.
  supabase.functions.invoke('photo-check', { body: { photoId: data.id } }).catch(() => {});

  return { ok: true, photoId: data.id as string };
}

export interface PhotoRow {
  id: string;
  slot: PhotoSlot;
  storagePath: string;
  moderationStatus: 'pending' | 'approved' | 'rejected';
  moderationReason: string | null;
}

/** İlanın karelerini durumlarıyla getirir. */
export async function loadPhotos(productId: string): Promise<PhotoRow[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data } = await supabase
    .from('product_photos')
    .select('id, slot, storage_path, moderation_status, moderation_reason')
    .eq('product_id', productId);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    slot: r.slot as PhotoSlot,
    storagePath: r.storage_path as string,
    moderationStatus: r.moderation_status as PhotoRow['moderationStatus'],
    moderationReason: (r.moderation_reason as string) ?? null,
  }));
}

export type PublishResult = { ok: true } | { ok: false; message: string };

/** İlanı yayına alır. Eksik ya da onaysız kare varsa sunucu reddeder. */
export async function publishListing(
  productId: string,
  coverSlot: PhotoSlot,
): Promise<PublishResult> {
  if (!supabaseConfigured || !supabase) return { ok: false, message: 'Sunucu bağlantısı yok.' };

  const { error } = await supabase.rpc('publish_listing', {
    p_product_id: productId,
    p_cover_slot: coverSlot,
  });
  if (error) return { ok: false, message: cevir(error.message) };
  return { ok: true };
}

function cevir(mesaj: string): string {
  if (mesaj.includes('eksik kare')) return 'Zorunlu karelerden bazıları eksik.';
  if (mesaj.includes('hâlâ inceleniyor')) {
    return 'Kareler inceleniyor. Birkaç saniye sonra tekrar deneyin.';
  }
  if (mesaj.includes('moderasyondan geçmeyen')) {
    return 'Bir kare incelemeden geçmedi. İşaretli kareyi yeniden çekin.';
  }
  if (mesaj.includes('ilan sahibi')) return 'Bu ilan size ait değil.';
  if (mesaj.includes('taslak ilan')) return 'Bu ilan zaten yayında.';
  return 'İlan yayına alınamadı. Tekrar deneyin.';
}
