import { Condition } from '../data/products';
import { Category, SubCategory } from '../data/categories';
import { SizeClass } from '../data/sizeClasses';
import { PhotoSlot, zorunluSlotlar } from '../data/photoSlots';
import { supabase, supabaseConfigured } from './supabase';

export interface NewListing {
  title: string;
  category: Category;
  /** Alt kategori zorunludur: onsuz ilan taslak kalır, yayına alınamaz. */
  subCategory: SubCategory;
  condition: Condition;
  sizeClass: SizeClass;
  location?: string;
  description?: string;
  /** Hasar beyanı — hasar yakın çekimi karesini zorunlu yapar. */
  hasDamage?: boolean;
  /** Set beyanı — parça bütünlüğü karesini zorunlu yapar. */
  isSet?: boolean;
}

export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

/**
 * İlanı Supabase'e yazar.
 *
 * Doğrudan insert etmez, `create_listing` RPC'sini çağırır: satıcı kimliği,
 * görünen ad ve değerleme izi orada oturumdan türetilir, istemcinin
 * yazabileceği alan değildir.
 *
 * İlan TASLAK olarak açılır — vitrine çıkmaz. Yayına girmesi için yedi karenin
 * zorunlu olanları çekilip incelemeden geçmelidir (`publishListing`).
 */
export async function createListing(l: NewListing): Promise<CreateResult> {
  if (!supabaseConfigured || !supabase) {
    return { ok: false, message: 'Sunucu bağlantısı yok. Anahtarlar tanımlı değil.' };
  }

  const { data, error } = await supabase.rpc('create_listing', {
    p_title: l.title,
    p_category: l.category,
    p_sub_category: l.subCategory,
    p_condition: l.condition,
    p_size_class: l.sizeClass,
    p_location: l.location ?? 'Belirtilmedi',
    p_description: l.description ?? null,
    p_has_damage: l.hasDamage ?? false,
    p_is_set: l.isSet ?? false,
  });

  if (error) return { ok: false, message: cevir(error.message) };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) return { ok: false, message: 'İlan oluşturuldu ama kimliği alınamadı.' };
  return { ok: true, id: row.id as string };
}

export interface DegerlemeSonuc {
  bulundu: boolean;
  urun?: string;
  sifirFiyat?: number | null;
  puan?: number | null;
}

/**
 * İlanı değerletir — sıfır fiyatını buldurup puanı hesaplatır.
 *
 * Kareler onaylandıktan **sonra** çağrılıyor: model ürünü dört açıdan görmeden
 * tanıyamıyor. Yayından hemen önce çalışıyor çünkü yayın kapısı değerlenmemiş
 * ilanı geçirmiyor.
 *
 * Hata yutuluyor ve `bulundu: false` dönüyor: değerleme başarısız olduğunda
 * doğru davranış akışı durdurmak değil, ilanı taslakta bırakmak. Kullanıcı
 * kareleri boşuna çekmiş olmuyor, ilan insan kuyruğuna düşüyor.
 */
export async function degerlet(productId: string): Promise<DegerlemeSonuc> {
  if (!supabaseConfigured || !supabase) return { bulundu: false };
  try {
    const { data, error } = await supabase.functions.invoke('listing-value', {
      body: { productId },
    });
    if (error) return { bulundu: false };
    return {
      bulundu: data?.bulundu === true || data?.tekrar === true,
      urun: data?.urun,
      sifirFiyat: data?.sifirFiyat ?? null,
      puan: data?.puan ?? null,
    };
  } catch {
    return { bulundu: false };
  }
}

/** Postgres hata metinlerini kullanıcıya gösterilebilir hâle çevirir. */
function cevir(mesaj: string): string {
  if (mesaj.includes('oturum açmalısınız')) return 'İlan vermek için giriş yapmalısınız.';
  if (mesaj.includes('başlık zorunludur')) return 'Başlık boş bırakılamaz.';
  if (mesaj.includes('geçersiz desi')) return 'Geçerli bir boyut seçin.';
  if (mesaj.includes('geçersiz kategori')) return 'Geçerli bir kategori seçin.';
  if (mesaj.includes('bu kategoriye ait değil'))
    return 'Seçtiğiniz alt kategori bu kategoriye ait değil.';
  if (mesaj.includes('alt kategori seçilmeden'))
    return 'İlanı yayına almak için bir alt kategori seçin.';
  if (mesaj.includes('henüz değerlenmedi'))
    return 'İlan değerleniyor, birkaç saniye sonra tekrar dene.';
  if (mesaj.includes('piyasa değeri bulunamadı'))
    return 'Bu ürünün piyasa değeri bulunamadı. İlan incelemeye alındı, sana haber vereceğiz.';
  if (mesaj.includes('olağandışı yüksek'))
    return 'Hesaplanan değer olağandışı yüksek çıktı. İlan incelemeye alındı.';
  return 'İlan kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.';
}

export interface DraftListing {
  id: string;
  title: string;
  points: number;
  hasDamage: boolean;
  isSet: boolean;
  cekilenKare: number;
  gerekenKare: number;
  bekleyenKare: number;
  reddedilenKare: number;
}

/**
 * Yarım kalmış taslak ilanlar.
 *
 * Bunlar olmadan taslak bir ilana bir daha ulaşılamıyordu: çekim akışına
 * yalnızca ilan oluşturulduktan hemen sonra giriliyordu ve o ekrandan çıkan
 * kullanıcı ilanı yayına alacak düğmeyi bir daha hiçbir yerde bulamıyordu.
 * İlan veri tabanında DRAFT olarak sonsuza kadar duruyordu.
 */
export async function loadDrafts(): Promise<DraftListing[]> {
  if (!supabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('products')
    .select('id, title, points, has_damage, is_set, product_photos(slot, moderation_status)')
    .eq('status', 'DRAFT')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return (data as unknown as DraftRow[]).map((r) => {
    const kareler = r.product_photos ?? [];
    /* Sayaç `zorunluSlotlar`dan geliyor, elle yazılmış bir sayıdan değil.
       Burada "5 + hasar + set" yazıyordu ve etiket karesi opsiyonel olunca
       (2026-08-16) iki yerden birden yanlışa düştü: payda bir fazlaydı, ve
       etiket karesini çeken kullanıcı payı da şişirdiği için taslak listesi
       "6/5 kare çekildi" diyordu. Payda ile pay artık aynı kümeyi sayıyor. */
    const gerekli = zorunluSlotlar(Boolean(r.has_damage), Boolean(r.is_set));
    const gerekliCekilen = kareler.filter(
      (k) => k.moderation_status !== 'rejected' && gerekli.includes(k.slot as PhotoSlot),
    );
    return {
      id: r.id,
      title: r.title,
      points: Number(r.points),
      hasDamage: Boolean(r.has_damage),
      isSet: Boolean(r.is_set),
      // Reddedilen kare çekilmiş sayılmaz; yeniden çekilmesi gerekiyor.
      cekilenKare: gerekliCekilen.length,
      gerekenKare: gerekli.length,
      bekleyenKare: kareler.filter((k) => k.moderation_status === 'pending').length,
      reddedilenKare: kareler.filter((k) => k.moderation_status === 'rejected').length,
    };
  });
}

interface DraftRow {
  id: string;
  title: string;
  points: number;
  has_damage: boolean;
  is_set: boolean;
  product_photos: { slot: string; moderation_status: string }[] | null;
}
