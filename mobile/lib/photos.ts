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
    /* Eskiden her yükleme hatasına "Bağlantınızı kontrol edin" deniyordu ve
       bu 2026-08-16'da yarım saat kaybettirdi: gerçek sebep yetki hatasıydı
       (kovada UPDATE politikası yoktu, yeniden çekim reddediliyordu) ama
       ekran ağı suçluyordu. Kullanıcıyı çözemeyeceği bir yere bakmaya
       göndermek, hiçbir şey söylememekten kötü.

       Sebep ayrıştırılıyor, ham mesaj gösterilmiyor: depo hataları İngilizce
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

  const photoId = data.id as string;

  /* **Çekim sırasında inceleme çağrılmıyor** — bilerek.
     Önceden her kare yüklenir yüklenmez `photo-check` çalışıyor ve
     reddedebiliyordu. Kullanıcı yedi karenin her birinde tek tek bir kapıya
     çarpıyordu: çek, bekle, reddedildi, yeniden çek. Ürün eklemek bir işlem
     değil bir sınav gibi okunuyordu.
     Artık kare yüklenir ve `pending` kalır; inceleme hepsi çekildikten sonra
     `analizEt` ile toplu yapılıyor. Güvenlik zayıflamıyor: yayın kapısı hâlâ
     yalnızca `approved` kareyi geçiriyor, yani incelenmemiş bir ilan vitrine
     çıkamıyor. Değişen tek şey incelemenin **ne zaman** olduğu. */
  return { ok: true, photoId, durum: 'pending' };
}

/** Toplu analizin ilan başına sonucu. */
export interface AnalizSonuc {
  onaylanan: number;
  reddedilen: number;
  /** Model karar veremedi ya da çağrı düştü — insan kuyruğuna gidiyor. */
  bekleyen: number;
  /** Reddedilen karelerin slotu ve gerekçesi; ekran bunları yeniden çektiriyor. */
  retler: { slot: PhotoSlot; gerekce: string }[];
}

/**
 * İlanın bekleyen karelerini toplu inceler.
 *
 * Kareler paralel gidiyor: yedi kareyi sırayla beklemek, kullanıcıyı tek bir
 * ilerleme çubuğunun karşısında yedi kat uzun tutardı. `photo-check` kare
 * başına bağımsız çalışıyor, aralarında sıra bağımlılığı yok.
 *
 * Tek tek hatalar yutuluyor ve `bekleyen` sayılıyor — bir karenin çağrısı
 * düştü diye bütün analizi başarısız saymak, kullanıcıyı yeniden çekime
 * gönderirdi. Bekleyen kare yayını engelliyor ama ilanı kaybettirmiyor:
 * yönetim kuyruğunda insan onayına düşüyor.
 */
export async function analizEt(productId: string): Promise<AnalizSonuc> {
  const bos: AnalizSonuc = { onaylanan: 0, reddedilen: 0, bekleyen: 0, retler: [] };
  if (!supabaseConfigured || !supabase) return bos;

  const { data } = await supabase
    .from('product_photos')
    .select('id, slot, moderation_status')
    .eq('product_id', productId)
    .eq('moderation_status', 'pending');

  if (!data?.length) return bos;

  const sonuclar = await Promise.all(
    data.map(async (r) => {
      const slot = r.slot as PhotoSlot;
      try {
        const { data: karar } = await supabase!.functions.invoke('photo-check', {
          body: { photoId: r.id as string },
        });
        const durum = karar?.status;
        if (durum === 'approved') return { durum: 'approved' as const, slot, gerekce: '' };
        if (durum === 'rejected') {
          return {
            durum: 'rejected' as const,
            slot,
            gerekce: (karar?.gerekce as string) || 'Kare geçmedi.',
          };
        }
      } catch {
        // yut: aşağıdaki 'pending' doğru cevap
      }
      return { durum: 'pending' as const, slot, gerekce: '' };
    }),
  );

  /* Ret listesi bu turda incelenenlerden değil, ilanın **o anki** durumundan
     okunuyor. Fark şurada: kullanıcı reddedilen kareyi yeniden çekmeden
     tekrar "Kontrole gönder"e basarsa bekleyen kare yoktur, bu tur hiçbir şey
     incelemez ve liste boş çıkardı — ekran da yayın kapısının ham hata
     metnini gösterirdi. Durumu sormak, hatırlamaktan doğru. */
  const { data: retSatirlari } = await supabase
    .from('product_photos')
    .select('slot, moderation_reason')
    .eq('product_id', productId)
    .eq('moderation_status', 'rejected');

  return {
    onaylanan: sonuclar.filter((x) => x.durum === 'approved').length,
    reddedilen: retSatirlari?.length ?? 0,
    bekleyen: sonuclar.filter((x) => x.durum === 'pending').length,
    retler: (retSatirlari ?? []).map((r) => ({
      slot: r.slot as PhotoSlot,
      gerekce: (r.moderation_reason as string) || 'Kare geçmedi.',
    })),
  };
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
    /* "Birkaç saniye sonra tekrar deneyin" artık yanlış: bekleyen kare insan
       onayına düşüyor ve o saatler sürebilir. Ekran bu yola normalde hiç
       girmiyor — bekleyen kare varken kullanıcıyı çıkarıyoruz. Buraya ancak
       yarış durumunda düşülür (kullanıcı gönderirken yönetici kareyi
       incelemeye geri almışsa), o yüzden mesaj bekletmiyor. */
    return 'İlanın incelemede. Onaylanınca kendiliğinden yayına girecek, sana bildireceğiz.';
  }
  if (mesaj.includes('moderasyondan geçmeyen')) {
    return 'Bir kare incelemeden geçmedi. İşaretli kareyi yeniden çekin.';
  }
  if (mesaj.includes('ilan sahibi')) return 'Bu ilan size ait değil.';
  if (mesaj.includes('taslak ilan')) return 'Bu ilan zaten yayında.';
  return 'İlan yayına alınamadı. Tekrar deneyin.';
}
