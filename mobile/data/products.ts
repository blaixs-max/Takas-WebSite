import { ImageSourcePropType } from 'react-native';
import { EMPTY_IMAGE, resolveImage, resolveGallery } from './productImages';
import { Category, SubCategory } from './categories';

export type Condition = 'İyi durumda' | 'Az kullanılmış' | 'Yeni gibi' | 'Hasarlı';
export type { Category, SubCategory };

export interface Product {
  id: string;
  title: string;
  points: number;
  condition: Condition;
  category: Category;
  /**
   * Alt kategori taslak ilanda henüz boş olabilir; `publish_listing` onsuz
   * yayına almaz, yani vitrindeki her üründe doludur.
   */
  subCategory?: SubCategory;
  location: string;
  distanceKm: number;
  rating: number;
  /**
   * TL karşılığı — **hiçbir ekranda gösterilmiyor**.
   *
   * Rehber 05'in uygulama notu: "'Piyasa karşılığı' ve TL değer aralığı
   * gösterilmez." Alan yine de duruyor çünkü sunucudaki `market_value`
   * sütunu değerlemede kullanılıyor; arayüze çıkmayan bir veri olması bir
   * çelişki değil. Zorunlu olmaktan çıktı: yeni ilanlarda boş kalabiliyor ve
   * boş kalması bir eksiklik değil.
   */
  marketValue?: string;
  badge?: string;
  /**
   * Satıcı hasar beyan etti mi.
   *
   * Sütun (`products.has_damage`) `product_photos` göçünden beri vardı ve
   * yedinci kareyi zorunlu yapıyordu, ama arayüze hiç çıkmıyordu: alıcı
   * hasarı ancak ilanı açıp yedinci kareye bakınca görüyordu. İkinci el
   * üründe en çok merak edilen şeyin kartta görünmemesi, kusuru saklamak
   * gibi okunuyor.
   */
  hasDamage: boolean;
  /**
   * `id` satıcının kullanıcı kimliği; profil fotoğrafını çekmek için gerekiyor
   * ve **yalnızca uygulamada** var. Pazarlama sitesindeki aynı adlı alan
   * bilerek ilanın kimliğini taşıyor (karşı repo, `vitrin-cek.mjs`): orası
   * açık web ve indeksleniyor, gerçek kullanıcı kimlikleri oraya inmemeli.
   * Burası üyeler arası ve kimlik zaten takas akışında dolaşıyor.
   *
   * Demo ilanlarda boş — onların bir kullanıcısı yok.
   */
  seller: { id?: string; name: string; initials: string; trust: number; trades: number };
  description: string;
  image: ImageSourcePropType;
  gallery: ImageSourcePropType[];
  favorite?: boolean;
  /**
   * İlanın yayına giriş anı (ISO). "En yeniler" sıralaması için.
   *
   * Sorgu zaten `created_at desc` ile geliyordu, yani varsayılan sıra doğruydu
   * — ama değer arayüze hiç çıkmıyordu. Kullanıcı bir kez "puana göre"
   * sıraladıktan sonra "yeniden en yeniye dön" diyemiyordu; geri dönülecek
   * ölçüt elimizde yoktu. Demo ilanlarda boş.
   */
  createdAt?: string;
}

/** Supabase satırını uygulama tipine çevirir (görseli image_key'den çözer). */
export interface ProductRow {
  id: string;
  title: string;
  points: number;
  condition: Condition;
  category: Category;
  sub_category: SubCategory | null;
  location: string;
  distance_km: number;
  rating: number;
  market_value: string | null;
  badge: string | null;
  description: string | null;
  image_key: string;
  gallery_keys: string[] | null;
  seller_id?: string | null;
  created_at?: string | null;
  seller_name: string;
  seller_initials: string;
  seller_trust: number;
  seller_trades: number;
  has_damage: boolean;
}

/**
 * Depolama yolu mu, paketli görsel anahtarı mı?
 *
 * Gerçek ilanların kapağı `{satici}/{ilan}/{slot}.jpg` biçiminde bir depolama
 * yoludur; demo ilanlarınki `wooden-blocks` gibi bir anahtardır. İkisi eğik
 * çizgiyle ayrılıyor.
 */
export function depolamaYoluMu(key?: string | null): boolean {
  return Boolean(key && key.includes('/'));
}

/**
 * @param kapakUrl Kapak karesinin imzalı bağlantısı. Verilmezse ve anahtar bir
 *   depolama yoluysa görsel BOŞ bırakılır — paketli demo görsele düşmek,
 *   kullanıcıya başka bir ürünün fotoğrafını satıcının çektiği kare diye
 *   göstermek olurdu.
 */
export function rowToProduct(
  r: ProductRow,
  kapakUrl?: string,
  galeriUrller?: string[],
): Product {
  return {
    id: r.id,
    title: r.title,
    points: r.points,
    condition: r.condition,
    category: r.category,
    subCategory: r.sub_category ?? undefined,
    location: r.location,
    distanceKm: Number(r.distance_km),
    rating: Number(r.rating),
    marketValue: r.market_value ?? '',
    badge: r.badge ?? undefined,
    hasDamage: r.has_damage === true,
    createdAt: r.created_at ?? undefined,
    description: r.description ?? '',
    image: kapakUrl
      ? { uri: kapakUrl }
      : depolamaYoluMu(r.image_key)
        ? EMPTY_IMAGE
        : resolveImage(r.image_key),
    gallery: galeriUrller?.length
      ? galeriUrller.map((u) => ({ uri: u }))
      : kapakUrl
        ? // Galeri üretilemediyse en azından kapak gösterilir; boş dizi
          // detay ekranındaki galeriyi tamamen kırardı.
          [{ uri: kapakUrl }]
        : depolamaYoluMu(r.image_key)
          ? [EMPTY_IMAGE]
          : resolveGallery(r.gallery_keys),
    seller: {
      id: r.seller_id ?? undefined,
      name: r.seller_name,
      initials: r.seller_initials,
      trust: r.seller_trust,
      trades: r.seller_trades,
    },
  };
}

/**
 * Anahtar/oturum yokken kullanılan demo ilanlar.
 *
 * Dördü de ahşap oyuncaktı ve hepsi tek kategorideydi ("Oyun & Oyuncak");
 * dokuz ana kategorili bir ürünü tek kategoriyle tanıtıyordu ve çip satırı
 * seçilince beş kategori boş dönüyordu. Tasarımın vitrininde bir puset ve bir
 * kitap seti var — ikisi de eklendi, fotoğrafları da tasarım paketinden.
 *
 * `condition` dört değerle sınırlı (`products` CHECK kısıtı): 'Yeni gibi',
 * 'Az kullanılmış', 'İyi durumda', 'Hasarlı'. Dördüncüsü 2026-08-16'da geldi:
 * hasar eskiden ayrı bir onay kutusuydu ve iki sorun üretiyordu — "Yeni gibi
 * ama hasarlı" gibi çelişkili beyan mümkündü, ve kutu kondisyon çiplerinin
 * altında küçük kaldığı için satıcı çoğu zaman fark etmiyordu. Beyan
 * edilmeyen hasar, alıcının itirazı ve havuzdan ödediğimiz iade demek.
 * 'Hasarlı' seçilince `has_damage` sunucuda zorla true oluyor, o da hasar
 * karesini zorunlu kılıyor. Tasarımın "Çok iyi"si bizde yok — kullanıcı
 * kararıyla durumlar bizim üçlümüz kalıyor.
 */
export const DEMO_PRODUCTS: Product[] = [
  {
    id: 'puset',
    title: 'Adaçayı yeşili puset',
    points: 780,
    condition: 'Yeni gibi',
    category: 'Bebek Arabası & Puset',
    subCategory: 'Puset & portbebe',
    location: 'Beşiktaş',
    distanceKm: 3.2,
    rating: 4.9,
    /* Blok setinde zaten "Popüler" var; öne çıkanlar şeridinde iki özdeş
       rozet yan yana geliyordu. Rehber 04 bu etiketin alternatifini
       "Öne çıkan" olarak veriyor. */
    badge: 'Öne çıkan',
    hasDamage: false,
    seller: { name: 'Ayşe Y.', initials: 'AY', trust: 94, trades: 29 },
    description:
      'Adaçayı yeşili, çift yönlü puset. Katlanma mekanizması sorunsuz çalışır; kumaşında belirgin leke veya yırtık yoktur. Yağmurluk ve alt sepetiyle gönderilir.',
    image: resolveImage('puset'),
    gallery: resolveGallery(['puset']),
  },
  {
    id: 'kitaplar',
    title: 'Resimli kitap seti',
    points: 320,
    condition: 'İyi durumda',
    category: 'Kitap & Eğitim',
    subCategory: 'Kitaplar',
    location: 'Kadıköy',
    distanceKm: 2.4,
    rating: 4.8,
    hasDamage: false,
    seller: { name: 'Selin B.', initials: 'SB', trust: 92, trades: 14 },
    description:
      'On iki kitaplık resimli hikâye seti. Sayfalarda yırtık yok, kapaklarda hafif okuma izi var. Tamamı Türkçe.',
    image: resolveImage('kitap-seti'),
    gallery: resolveGallery(['kitap-seti']),
  },
  {
    id: 'blocks',
    title: 'Montessori ahşap blok seti',
    points: 420,
    condition: 'Az kullanılmış',
    category: 'Oyun & Oyuncak',
    subCategory: 'Yapı & inşa',
    location: 'Kadıköy',
    distanceKm: 2.4,
    rating: 4.9,
    marketValue: '~520–610 ₺',
    badge: 'Popüler',
    hasDamage: false,
    seller: { name: 'Zeynep D.', initials: 'ZD', trust: 96, trades: 38 },
    description:
      'Doğal kayın ağacından, 48 parçalık geometrik blok seti. 2 yıl kullanıldı, boyası dökülmemiş. Orijinal ahşap kutusuyla birlikte gönderilir.',
    image: resolveImage('montessori-set'),
    gallery: resolveGallery(['montessori-set', 'wooden-blocks', 'wooden-close', 'rings-close']),
  },
  {
    id: 'sorter',
    title: 'Ahşap renk ayırma oyunu',
    points: 260,
    condition: 'İyi durumda',
    category: 'Oyun & Oyuncak',
    subCategory: 'Gelişim & duyu',
    location: 'Beşiktaş',
    distanceKm: 5.1,
    rating: 4.7,
    marketValue: '~300–360 ₺',
    hasDamage: true, // demo: hasar beyanı olan bir ilan da bulunsun
    seller: { name: 'Murat K.', initials: 'MK', trust: 91, trades: 22 },
    description:
      'El becerisi ve renk eşleştirme için ahşap sıralama oyunu. Tüm parçalar tam, küçük kullanım izleri mevcut.',
    image: resolveImage('color-sorter'),
    gallery: resolveGallery(['color-sorter', 'wooden-close', 'wooden-blocks']),
  },
  {
    id: 'rings',
    title: 'Montessori halka kulesi',
    points: 340,
    condition: 'Yeni gibi',
    category: 'Oyun & Oyuncak',
    subCategory: 'Gelişim & duyu',
    location: 'Üsküdar',
    distanceKm: 3.8,
    rating: 5.0,
    marketValue: '~400–470 ₺',
    badge: 'Editör seçimi',
    hasDamage: false,
    seller: { name: 'Elif T.', initials: 'ET', trust: 98, trades: 51 },
    description:
      'Doğal boyalı ahşap halka kulesi. Neredeyse hiç kullanılmadı, kutusunda. Bebek ve yürüme dönemi için ideal.',
    image: resolveImage('montessori-rings'),
    gallery: resolveGallery(['montessori-rings', 'rings-close', 'wooden-blocks']),
    favorite: true,
  },
  {
    id: 'rings-natural',
    title: 'Doğal ahşap denge halkaları',
    points: 300,
    condition: 'Az kullanılmış',
    category: 'Oyun & Oyuncak',
    subCategory: 'Gelişim & duyu',
    location: 'Şişli',
    distanceKm: 6.7,
    rating: 4.8,
    marketValue: '~350–410 ₺',
    hasDamage: false,
    seller: { name: 'Can A.', initials: 'CA', trust: 89, trades: 17 },
    description:
      'Doğal yağ ile cilalanmış denge ve istifleme halkaları. Hafif kullanım izi var, tüm parçalar mevcut.',
    image: resolveImage('rings-close'),
    gallery: resolveGallery(['rings-close', 'montessori-rings', 'wooden-close']),
  },
];
