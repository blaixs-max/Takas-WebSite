import { File } from 'expo-file-system';
import { PhotoSlot } from '../data/photoSlots';
import { imzaliBaglantilar } from './admin';
import { supabase, supabaseConfigured } from './supabase';

export type ModerasyonDurumu = 'approved' | 'pending' | 'rejected';

export type UploadResult =
  | { ok: true; photoId: string; durum: ModerasyonDurumu; gerekce?: string }
  | { ok: false; message: string };

/**
 * Bir kareyi depoya yükler, product_photos'a kaydeder ve **incelemeyi bekler.**
 *
 * Yol düzeni: {satici_id}/{ilan_id}/{slot}.jpg — ilk klasör sahibi belirtir,
 * depolama politikası da bunun üzerinden çalışır.
 *
 * Kayıt `pending` moderasyon durumuyla açılır. Bu ONAY DEĞİLDİR: yayın kapısı
 * yalnız `approved` kareyi geçirir. İnceleme photo-check fonksiyonunda yapılır.
 *
 * ## Neden artık sonucu bekliyoruz
 *
 * Bu çağrı "ateşle ve unut"tu: `invoke(...).catch(() => {})` yazılıp hemen
 * dönülüyordu. Çekim ekranı da kareyi yükler yüklemez bir sonraki slota
 * geçiyordu, yani kullanıcı kararı hiç görmüyordu. Ret ancak en sonda,
 * "Kontrole gönder"e basınca "bir kare incelemeden geçmedi" diye ortaya
 * çıkıyordu — beş kareyi bitirdiğini sanan kişi başa dönüyordu.
 *
 * Kıyaslamalı denetim bunu iyice tutarsız hâle getirdi: "bu kareyi öncekiyle
 * aynı açıdan çekmişsin" uyarısının işe yaradığı tek an, kullanıcının hâlâ
 * ürünün başında olduğu an. Bir-iki saniyelik bekleme bunun karşılığı.
 *
 * Fonksiyon yanıt vermezse `pending` dönüyor: akış durmuyor, kare kuyrukta
 * kalıyor, ekranda "İnceleniyor…" yazıyor ve elle tazeleme düğmesi çıkıyor.
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

  const photoId = data.id as string;

  /* İncelemeyi tetikle ve sonucunu bekle. Hata yutuluyor çünkü başarısızlığın
     sonucu zaten güvenli tarafta: kare 'pending' kalır, yayın kapısı geçirmez,
     ilan insan kuyruğuna düşer. Yükleme başarılı olduğu için `ok: false`
     dönmek yanlış olurdu — kare gerçekten yüklendi. */
  try {
    const { data: karar } = await supabase.functions.invoke('photo-check', {
      body: { photoId },
    });
    const durum = karar?.status;
    if (durum === 'approved' || durum === 'rejected' || durum === 'pending') {
      return { ok: true, photoId, durum, gerekce: karar?.gerekce || undefined };
    }
  } catch {
    // yut: aşağıdaki 'pending' doğru cevap
  }

  return { ok: true, photoId, durum: 'pending' };
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
