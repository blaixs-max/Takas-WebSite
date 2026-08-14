import { supabase, supabaseConfigured } from './supabase';

/**
 * Favori ve sepetin bulut tarafı.
 *
 * İkisi de yalnızca cihazdaydı (`AsyncStorage`). Tek cihazlı kullanıcıda
 * çalışıyordu ama iki gerçek sonucu vardı: telefon değişince ya da uygulama
 * silinince liste kayboluyordu, ve aynı hesaba başka bir cihazdan girildiğinde
 * favoriler boş görünüyordu.
 *
 * ## Birleştirme kuralı
 *
 * Oturum açıldığında cihazdaki liste ile buluttaki liste **birleştiriliyor**
 * (küme birleşimi), sonuç buluta yazılıyor ve ekrana o veriliyor.
 *
 * Birleşim, "bulut kazanır"dan daha doğru: kullanıcı oturum açmadan önce
 * favorilediği şeyler onun niyetidir ve giriş yapmak o niyeti silmemeli.
 * Bundan sonraki her değişiklik iki tarafa birden yazılıyor, yani ikinci bir
 * birleştirme turu gerekmiyor.
 *
 * Silmenin diriltilmesi riski yalnızca ilk turda olurdu ve orada da yok:
 * ilk turda buluttan silinmiş bir şey henüz yok.
 *
 * ## Hatalar neden yutuluyor
 *
 * Ağ yoksa ya da sunucu yanıt vermiyorsa favori eklemek **çalışmaya devam
 * etmeli** — cihazdaki liste zaten kaydediliyor. Kalp'e basınca hata kutusu
 * çıkması, kaybedilen şeyin büyüklüğüne göre orantısız bir ceza olurdu.
 * Bir sonraki oturum açılışındaki birleştirme farkı kapatır.
 */

export type SenkronTablo = 'favorites' | 'cart_items';

/** Buluttaki ürün kimlikleri. Oturum yoksa ya da hata varsa boş dizi. */
export async function bulutListe(tablo: SenkronTablo): Promise<string[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.from(tablo).select('product_id');
  if (error || !data) return [];
  return data.map((r) => r.product_id as string);
}

/** Kimlikleri buluta yazar. Zaten varsa dokunmaz. */
export async function bulutEkle(tablo: SenkronTablo, ids: string[]): Promise<void> {
  if (!supabaseConfigured || !supabase || ids.length === 0) return;
  const { data: oturum } = await supabase.auth.getUser();
  const uid = oturum?.user?.id;
  if (!uid) return;
  await supabase
    .from(tablo)
    .upsert(
      ids.map((product_id) => ({ user_id: uid, product_id })),
      { onConflict: 'user_id,product_id', ignoreDuplicates: true },
    );
}

export async function bulutSil(tablo: SenkronTablo, id: string): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  await supabase.from(tablo).delete().eq('product_id', id);
}

/**
 * Kullanıcının o tablodaki bütün satırlarını siler — sepet boşaltılınca.
 *
 * `neq('product_id', '')` bir "hepsi" hilesi değil, PostgREST'in koşulsuz
 * silmeyi reddetmesinin karşılığı. Hangi satırların silindiğini RLS
 * belirliyor: politika yalnızca `user_id = auth.uid()` olanları geçiriyor,
 * yani başkasının sepeti bu çağrıdan etkilenmiyor.
 */
export async function bulutTemizle(tablo: SenkronTablo): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  await supabase.from(tablo).delete().neq('product_id', '');
}

/**
 * Cihaz listesi ile bulut listesini birleştirir, farkı buluta yazar ve
 * birleşimi döndürür.
 */
export async function birlestir(tablo: SenkronTablo, cihaz: string[]): Promise<string[]> {
  const bulut = await bulutListe(tablo);
  const birlesim = Array.from(new Set([...bulut, ...cihaz]));
  const eksik = cihaz.filter((id) => !bulut.includes(id));
  if (eksik.length > 0) await bulutEkle(tablo, eksik);
  return birlesim;
}
