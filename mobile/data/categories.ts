import { MaterialIcons } from '@expo/vector-icons';

/**
 * Kategori yapısının tek kaynağı **"ELDENELE · Ürün Mimarisi — Kategori ve
 * Filtreleme Matrisi"** dokümanıdır (Nihai, 12 Ağustos 2026). Doküman hem mobil
 * hem web için geçerli; iki repo da onu aynalar, birbirini değil.
 *
 * Dokümanın kurduğu üç kural:
 *
 *  - **Dokuz ana kategori.** "Bebek Ekipmanları" ayrı bir ana kategori
 *    değildir: ana kucağı ve salıncak Oda & Uyku, yürüteç ve aktivite merkezi
 *    Oyun & Oyuncak, oyun çiti Bakım & Güvenlik altındadır.
 *  - **Her ürün tek bir ana ve tek bir alt kategoriye aittir.** Yaş, beden,
 *    marka, durum, konum ve teslimat kategori olarak çoğaltılmaz; bunlar
 *    süzgeçtir.
 *  - **"Tümü" kategori değil, gezinme filtresidir.** Bu yüzden `CATEGORIES`
 *    içinde yoktur; ekranlar başa kendileri ekler.
 *
 * Karşı repodaki `src/data/categories.ts` aynı ağacı taşır. İkonlar burada
 * MaterialIcons, orada lucide-react; anlam aynı, çizim ailesi farklı. Bir
 * kategori eklenir ya da adı değişirse iki dosya aynı turda güncellenir.
 */
export interface CategoryDef {
  readonly name: string;
  readonly icon: keyof typeof MaterialIcons.glyphMap;
  readonly subs: readonly string[];
}

export const CATEGORY_TREE = [
  {
    name: 'Bebek Arabası & Puset',
    icon: 'child-friendly',
    subs: ['Bebek arabaları', 'Puset & portbebe', 'Bebek taşıyıcıları', 'Aksesuarlar'],
  },
  {
    name: 'Oto Koltuğu & Seyahat',
    icon: 'airline-seat-recline-normal',
    subs: [
      'Bebek oto koltukları',
      'Çocuk oto koltukları',
      'Yükseltici & baza',
      'Oto aksesuarları',
      'Seyahat ürünleri',
    ],
  },
  {
    name: 'Oda & Uyku',
    icon: 'bed',
    subs: [
      'Beşik & yatak',
      'Dinlenme',
      'Mobilya',
      'Düzenleme',
      'Uyku tekstili',
      'Aydınlatma & dekor',
    ],
  },
  {
    name: 'Beslenme',
    icon: 'restaurant',
    subs: [
      'Mama sandalyesi',
      'Öğrenme & destek',
      'Hazırlama cihazları',
      'Sofra ürünleri',
      'Saklama & taşıma',
      'Emzirme & sağım',
    ],
  },
  {
    name: 'Bakım & Güvenlik',
    icon: 'health-and-safety',
    subs: [
      'Banyo',
      'Alt değiştirme',
      'Tuvalet eğitimi',
      'Bakım cihazları',
      'İzleme',
      'Ev güvenliği',
      'Güvenli oyun alanı',
      'Çocuk takibi',
    ],
  },
  {
    name: 'Oyun & Oyuncak',
    icon: 'toys',
    subs: [
      'Bebek aktivite',
      'Bebek oyuncakları',
      'Gelişim & duyu',
      'Yapı & inşa',
      'Puzzle & zekâ',
      'Rol oyunu',
      'Bebek, figür & pelüş',
      'Araç & pist',
      'Müzik & elektronik',
      'Kutu & kart oyunları',
    ],
  },
  {
    name: 'Kitap & Eğitim',
    icon: 'menu-book',
    subs: [
      'Kitaplar',
      'Eğitim materyalleri',
      'STEM & deney',
      'Okul ürünleri',
      'Sanat & hobi',
      'Eğitici elektronik',
    ],
  },
  {
    name: 'Giyim & Ayakkabı',
    icon: 'checkroom',
    subs: [
      'Temel giyim',
      'Üst giyim',
      'Alt giyim',
      'Elbise & etek',
      'Uyku giyimi',
      'Dış giyim',
      'Spor & plaj',
      'Kostüm',
      'Ayakkabı',
      'Aksesuar',
    ],
  },
  {
    name: 'Spor & Dış Mekân',
    icon: 'directions-bike',
    subs: [
      'Bisiklet',
      'Scooter & binilebilir araç',
      'Paten & kaykay',
      'Spor ekipmanları',
      'Koruyucu ekipman',
      'Bahçe & açık hava',
      'Deniz & kamp',
    ],
  },
] as const satisfies readonly CategoryDef[];

export type Category = (typeof CATEGORY_TREE)[number]['name'];
export type SubCategory = (typeof CATEGORY_TREE)[number]['subs'][number];

/** Yalnızca ana kategori adları, dokümandaki sırayla. */
export const CATEGORIES: readonly Category[] = CATEGORY_TREE.map((c) => c.name);

/** Her ana kategori için Material ikon — eski `CATEGORY_ICONS` sözleşmesi. */
export const CATEGORY_ICONS = Object.fromEntries(
  CATEGORY_TREE.map((c) => [c.name, c.icon]),
) as Record<Category, keyof typeof MaterialIcons.glyphMap>;

/**
 * Ana kategori adından tanımına. Anahtar `string`, `Category` değil: seçili
 * kategori ekranlarda düz metin olarak dolaşıyor ('Tümü' de olabiliyor) ve dar
 * bir anahtar her çağrı yerinde daraltma zorunluluğu getirirdi. Karşılığı
 * olmayan ad `undefined` döner, çağıran onu ele alır.
 */
export const CATEGORY_BY_NAME: Record<string, CategoryDef | undefined> = Object.fromEntries(
  CATEGORY_TREE.map((c) => [c.name, c]),
);

/** Bir ana kategorinin alt kategorileri; bilinmeyen ad boş dizi döner. */
export function subsOf(category: string): readonly string[] {
  return CATEGORY_BY_NAME[category]?.subs ?? [];
}

/** Alt kategori gerçekten o ana kategoriye mi ait? Formda ve süzgeçte kullanılır. */
export function isValidPair(category: string, sub: string): boolean {
  return subsOf(category).includes(sub);
}

/** Vitrindeki 'Tümü' bir kategori değil, filtrenin kapalı hâlidir. */
export const ALL_CATEGORIES = 'Tümü';
