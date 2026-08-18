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

/**
 * Taslak ilanı düzenlemek için okur.
 *
 * `loadDrafts` liste için yeterli olanı veriyor (başlık, kare sayacı); form
 * bundan fazlasını istiyor. Ayrı bir çağrı, çünkü liste ekranında yedi alanı
 * daha çekmek her açılışta boşa trafik olurdu.
 *
 * RLS kendi ilanlarınızı okumaya izin veriyor; sahiplik kontrolü ayrıca
 * `update_listing` içinde de var — okuma izni ile yazma izni ayrı sorular.
 */
export async function loadDraftForEdit(id: string): Promise<EditableListing | null> {
  if (!supabaseConfigured || !supabase) return null;
  /* Sahiplik filtresi burada da açık: `update_listing` zaten yabancıyı
     reddediyor ama o yazma tarafı. Bu okuma tarafı ve yönetici politikası
     yüzünden başkasının taslağı forma doldurulabilirdi — kaydetmeye
     çalışınca hata alırdı, ama o ana kadar başkasının ilanını okumuş olurdu. */
  const { data: oturum } = await supabase.auth.getUser();
  const uid = oturum?.user?.id;
  if (!uid) return null;

  const { data, error } = await supabase
    .from('products')
    .select('id, title, description, category, sub_category, condition, size_class, location, has_damage, is_set, status')
    .eq('id', id)
    .eq('seller_id', uid)
    .single();

  if (error || !data) return null;
  const r = data as unknown as EditableRow;
  if (r.status !== 'DRAFT') return null;

  return {
    id: r.id,
    title: r.title,
    /* "Belirtilmedi" bir konum değil, `create_listing`'in boş konuma yazdığı
       dolgu. Forma öyle taşınsaydı kullanıcı onu kendi yazdığı bir şey sanıp
       silmeye çalışırdı. */
    location: r.location === 'Belirtilmedi' ? null : r.location,
    description: r.description,
    category: r.category,
    subCategory: r.sub_category,
    condition: r.condition as Condition,
    sizeClass: r.size_class as SizeClass,
    hasDamage: Boolean(r.has_damage),
    isSet: Boolean(r.is_set),
  };
}

export interface EditableListing {
  id: string;
  title: string;
  description: string | null;
  category: string;
  subCategory: string | null;
  condition: Condition;
  sizeClass: SizeClass;
  location: string | null;
  hasDamage: boolean;
  isSet: boolean;
}

interface EditableRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  sub_category: string | null;
  condition: string;
  size_class: string;
  location: string;
  has_damage: boolean;
  is_set: boolean;
  status: string;
}

/**
 * Taslak ilanı günceller.
 *
 * `createListing` ile aynı gövdeyi alıyor ama ayrı bir RPC çağırıyor:
 * `update_listing` yalnızca DRAFT'ı ve yalnızca sahibini kabul ediyor, ve
 * **değerlemeyi besleyen bir alan değiştiyse puanı siliyor**. Yani kondisyonunu
 * değiştiren kullanıcının ilanı yeniden değerlenmek zorunda kalıyor; eski
 * beyanın puanıyla yayına giremiyor.
 */
export async function updateListing(id: string, l: NewListing): Promise<CreateResult> {
  if (!supabaseConfigured || !supabase) {
    return { ok: false, message: 'Sunucu bağlantısı yok. Anahtarlar tanımlı değil.' };
  }

  const { data, error } = await supabase.rpc('update_listing', {
    p_product_id: id,
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
  if (!row?.id) return { ok: false, message: 'İlan güncellendi ama kimliği alınamadı.' };
  return { ok: true, id: row.id as string };
}

export type SilmeSonucu = { ok: true } | { ok: false; message: string };

/**
 * İlanı kaldırır.
 *
 * Hem taslak hem yayındaki ilan için aynı çağrı: kullanıcı açısından ikisi de
 * "bu ilanı istemiyorum" ve iki ayrı düğme öğrenmesi için bir sebep yok.
 * Ayrımı sunucu yapıyor — süren takası olan ya da satılmış ilan geri
 * çeviriliyor.
 */
export async function deleteListing(id: string): Promise<SilmeSonucu> {
  if (!supabaseConfigured || !supabase) {
    return { ok: false, message: 'Sunucu bağlantısı yok. Anahtarlar tanımlı değil.' };
  }
  const { error } = await supabase.rpc('delete_listing', { p_product_id: id });
  if (!error) return { ok: true };
  return { ok: false, message: silmeHatasi(error.message) };
}

function silmeHatasi(mesaj: string): string {
  if (mesaj.includes('süren takası'))
    return 'Bu ilan için süren bir takas var. Takas tamamlanmadan ilan kaldırılamaz.';
  if (mesaj.includes('satılmış ilan'))
    return 'Satılmış ilanlar kaldırılamaz; takas geçmişinde kayıtlı kalır.';
  if (mesaj.includes('ilan bulunamadı'))
    return 'Bu ilan bulunamadı. Listeyi yenileyip tekrar dene.';
  if (mesaj.includes('oturum açmalısınız')) return 'Bunun için giriş yapmalısın.';
  return 'İlan kaldırılamadı. Bağlantını kontrol edip tekrar dene.';
}

export interface MyListing {
  id: string;
  title: string;
  points: number;
  status: 'ACTIVE' | 'RESERVED' | 'SOLD';
  imageKey: string | null;
  createdAt: string;
}

/**
 * Kullanıcının yayındaki ilanları.
 *
 * Taslaklarla aynı ekranda listelenmiyor: taslak "bitmemiş iş", yayındaki
 * ilan "biten iş". İkisini karıştırmak, kullanıcının silmek istediği ilanla
 * yayına almak istediği ilanı yan yana koyardı.
 *
 * `seller_id` filtresi burada da açık — RLS'in yönetici politikası taslak
 * listesinde bir kez bütün kullanıcıların ilanlarını göstermişti.
 */
export async function loadMyListings(): Promise<MyListing[]> {
  if (!supabaseConfigured || !supabase) return [];

  const { data: oturum } = await supabase.auth.getUser();
  const uid = oturum?.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from('products')
    .select('id, title, points, status, image_key, created_at')
    .eq('seller_id', uid)
    .in('status', ['ACTIVE', 'RESERVED', 'SOLD'])
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return (data as unknown as MyListingRow[]).map((r) => ({
    id: r.id,
    title: r.title,
    points: Number(r.points),
    status: r.status as MyListing['status'],
    imageKey: r.image_key,
    createdAt: r.created_at,
  }));
}

interface MyListingRow {
  id: string;
  title: string;
  points: number;
  status: string;
  image_key: string | null;
  created_at: string;
}

export interface DegerlemeSonuc {
  bulundu: boolean;
  urun?: string;
  sifirFiyat?: number | null;
  puan?: number | null;
  /**
   * Hesaplanan puan taban puanın altında kalıp yükseltildi mi.
   *
   * Puanın 50 olmasından çıkarılamaz: 80 TL'lik bir ürün de tam 50 puan eder
   * ama orada yükseltme yoktur. Ayrımı yapan tek şey sunucunun değerleme
   * anında koyduğu işaret.
   */
  tabanUygulandi?: boolean;
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

    /* Taban işareti Edge Function'ın döndürdüğü gövdede yok; satırdan
       okunuyor. Fonksiyonu yeniden yayınlamamak için böyle: işaret zaten
       `degerleme_yaz` tarafından ürüne yazılıyor ve kullanıcı kendi ilanını
       okuyabiliyor. Okunamazsa `undefined` kalır ve ekran hiçbir şey
       söylemez — yanlış bir şey söylemektense susmak doğru. */
    let tabanUygulandi: boolean | undefined;
    const { data: satir } = await supabase
      .from('products')
      .select('taban_uygulandi')
      .eq('id', productId)
      .single();
    if (satir) tabanUygulandi = Boolean(satir.taban_uygulandi);

    return {
      bulundu: data?.bulundu === true || data?.tekrar === true,
      urun: data?.urun,
      sifirFiyat: data?.sifirFiyat ?? null,
      puan: data?.puan ?? null,
      tabanUygulandi,
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
  if (mesaj.includes('ilan bulunamadı'))
    return 'Bu ilan bulunamadı. Taslaklar listesini yenileyip tekrar dene.';
  if (mesaj.includes('yayındaki ilan düzenlenemez'))
    return 'Bu ilan yayında; yayındaki ilanlar düzenlenemiyor.';
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

  /* **`seller_id` filtresi şart** — RLS'e bırakılamaz.
     Bu sorgu bir tur boyunca filtresizdi ve kapsamı RLS'e güveniyordu. Normal
     kullanıcıda çalışıyordu, çünkü "kendi ilanlarını gör" politikası zaten
     daraltıyor. Ama `products` üzerinde bir de "yönetici tüm ilanları görür"
     politikası var (yönetim ekranı onsuz çalışmaz) ve yönetici hesabıyla
     girildiğinde bu ekran **bütün kullanıcıların taslaklarını** listeledi:
     dokuz ilan göründü, dokuzu da başkalarınındı.

     Ders: RLS bir **güvenlik sınırı** — neyi görmeye hakkın var. Sorgu
     filtresi ise **niyet** — neyi görmek istiyorsun. İkisi aynı şey değil ve
     birini öbürünün yerine kullanmak, yetkisi genişleyen ilk hesapta kırılır. */
  const { data: oturum } = await supabase.auth.getUser();
  const uid = oturum?.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from('products')
    .select('id, title, points, has_damage, is_set, product_photos(slot, moderation_status)')
    .eq('status', 'DRAFT')
    .eq('seller_id', uid)
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
