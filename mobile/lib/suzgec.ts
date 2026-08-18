import { Condition, Product } from '../data/products';
import { ALL_CATEGORIES } from '../data/categories';
import { aramaEslesir } from './arama';

/**
 * Vitrin süzgeci ve sıralaması.
 *
 * ## Neden ekranın içinde değil
 *
 * Süzme bir tur boyunca `index.tsx` içinde üç satırlık bir `filter` idi ve o
 * kadarken doğru yerdeydi. Sıralama, puan aralığı, kondisyon ve il eklenince
 * ekranın çizim mantığıyla iş mantığı iç içe geçmeye başladı — ve bu iki şey
 * bozulunca farklı görünüyor: yanlış çizim gözle yakalanır, yanlış süzgeç
 * yakalanmaz, yalnızca "aradığımı bulamadım" olarak yaşanır.
 *
 * Buradaki her şey **saf**: girdi ürün dizisi ve süzgeç, çıktı ürün dizisi.
 * Ekran, ağ ve depolama yok.
 *
 * ## Neden istemcide süzüyoruz
 *
 * Vitrin zaten tamamı çekiliyor (`loadProducts` bütün ACTIVE ilanları alıyor)
 * ve şu an birkaç düzine ilan var. Sunucuya süzdürmek her çip dokunuşunda bir
 * gidiş dönüş demek olurdu; kullanıcı çipe basıp beklerdi. İlan sayısı
 * binleri bulduğunda bu karar yeniden bakılmalı — o gün süzgecin sorguya
 * çevrilmesi gerekecek ve bu dosya o dönüşümün tek yeri olacak.
 */

export type Siralama = 'onerilen' | 'yeni' | 'puanArtan' | 'puanAzalan' | 'yakin';

export const SIRALAMA_SECENEKLERI: { deger: Siralama; etiket: string; aciklama: string }[] = [
  { deger: 'onerilen', etiket: 'Önerilen', aciklama: 'Öne çıkanlar ve yeni ilanlar birlikte' },
  { deger: 'yeni', etiket: 'En yeniler', aciklama: 'Son eklenen ilanlar önce' },
  { deger: 'puanArtan', etiket: 'Takas puanı: düşükten yükseğe', aciklama: '' },
  { deger: 'puanAzalan', etiket: 'Takas puanı: yüksekten düşüğe', aciklama: '' },
  { deger: 'yakin', etiket: 'Bana en yakın', aciklama: 'Mesafeye göre' },
];

/** Kondisyon süzgecinin seçenekleri — `Condition` ile birebir. */
export const KONDISYONLAR: Condition[] = [
  'Yeni gibi',
  'Az kullanılmış',
  'İyi durumda',
  'Hasarlı',
];

export interface Suzgec {
  kategori: string;
  altKategori: string;
  /** Boş küme = hepsi. Seçim yapılınca yalnızca seçilenler kalır. */
  kondisyonlar: Condition[];
  /** null = sınır yok. Kullanıcı yalnızca alt ya da yalnızca üst verebilir. */
  enAzPuan: number | null;
  enCokPuan: number | null;
  /** "Kadıköy, İstanbul" biçiminde tam etiket; boşsa süzmüyor. */
  konum: string;
  /** Yalnızca hasar beyanı olmayan ilanlar. */
  hasarsiz: boolean;
}

export const BOS_SUZGEC: Suzgec = {
  kategori: ALL_CATEGORIES,
  altKategori: ALL_CATEGORIES,
  kondisyonlar: [],
  enAzPuan: null,
  enCokPuan: null,
  konum: '',
  hasarsiz: false,
};

/**
 * Kaç süzgeç açık.
 *
 * Rozet bu sayıyı gösteriyor ve gösterme sebebi somut: süzgeç paneli
 * kapalıyken raf boş kalabiliyor ve kullanıcı bunu bir kusur sanıyor.
 * "Filtrele (3)" yazan bir düğme, boş rafın sebebini söylüyor.
 *
 * **Kategori ve alt kategori sayılmıyor** — onlar ekranda çip satırı olarak
 * zaten görünüyor. Görünen bir şeyi ikinci kez saymak, rozeti kullanıcının
 * göremediği şeylerin sayacı olmaktan çıkarırdı.
 */
export function acikSuzgecSayisi(s: Suzgec): number {
  let n = 0;
  if (s.kondisyonlar.length > 0) n++;
  if (s.enAzPuan !== null || s.enCokPuan !== null) n++;
  if (s.konum) n++;
  if (s.hasarsiz) n++;
  return n;
}

/** Kategori dışındaki her şey sıfırlanır; kategori çip satırının işi. */
export function suzgeciTemizle(s: Suzgec): Suzgec {
  return { ...BOS_SUZGEC, kategori: s.kategori, altKategori: s.altKategori };
}

/**
 * Süzer ve sıralar.
 *
 * Sıra önemli: önce süzülüyor, sonra sıralanıyor. Tersi aynı sonucu verirdi
 * ama gereksiz iş olurdu — elenecek ürünleri sıralamak.
 */
export function uygula(
  urunler: Product[],
  s: Suzgec,
  sorgu: string,
  siralama: Siralama,
): Product[] {
  const suzulmus = urunler.filter((p) => {
    if (s.kategori !== ALL_CATEGORIES && p.category !== s.kategori) return false;
    if (s.altKategori !== ALL_CATEGORIES && p.subCategory !== s.altKategori) return false;
    if (s.kondisyonlar.length > 0 && !s.kondisyonlar.includes(p.condition)) return false;
    if (s.enAzPuan !== null && p.points < s.enAzPuan) return false;
    if (s.enCokPuan !== null && p.points > s.enCokPuan) return false;
    if (s.konum && p.location !== s.konum) return false;
    if (s.hasarsiz && p.hasDamage) return false;
    /* Arama `aramaEslesir` üzerinden: `toLowerCase()` Türkçe'yi bozuyor ve
       şapkasız yazan kullanıcı hiçbir şey bulamıyordu. */
    return aramaEslesir(sorgu, [p.title, p.category, p.subCategory, p.location, p.description]);
  });

  /* Kopya üzerinde sıralanıyor: `sort` yerinde çalışıyor ve `urunler`
     `useProducts`in tuttuğu dizi. Onu karıştırmak, sıralamayı değiştirdikten
     sonra "önerilen"e dönen kullanıcıya artık başka bir sıra gösterirdi. */
  const liste = [...suzulmus];

  switch (siralama) {
    case 'yeni':
      return liste.sort((a, b) => zaman(b) - zaman(a));
    case 'puanArtan':
      return liste.sort((a, b) => a.points - b.points);
    case 'puanAzalan':
      return liste.sort((a, b) => b.points - a.points);
    case 'yakin':
      return liste.sort((a, b) => a.distanceKm - b.distanceKm);
    case 'onerilen':
    default:
      /* "Önerilen" bir puanlama değil: rozetli ilanlar öne, gerisi geliş
         sırasında. Arkasında bir öneri motoru olmadığı hâlde ürünleri
         karıştırmak, kullanıcıya olmayan bir zekâyı varmış gibi gösterirdi.
         Sıralama kararı `SIRALAMA_SECENEKLERI` içinde de böyle anlatılıyor. */
      return liste.sort((a, b) => rozet(b) - rozet(a) || zaman(b) - zaman(a));
  }
}

/**
 * Sıralanabilir zaman damgası.
 *
 * `createdAt` yoksa 0: demo ilanlarda bu alan boş ve `NaN` üretmek bütün
 * sıralamayı bozardı — `NaN` içeren bir karşılaştırıcı tanımsız bir sıra verir,
 * hata vermez. Sessizce yanlış sıralanan bir liste, boş listeden zor fark
 * edilir.
 */
function zaman(p: Product): number {
  if (!p.createdAt) return 0;
  const t = Date.parse(p.createdAt);
  return Number.isNaN(t) ? 0 : t;
}

function rozet(p: Product): number {
  return p.badge ? 1 : 0;
}

/**
 * Süzgeç panelindeki il listesi.
 *
 * Sabit 81 il yerine **rafta gerçekten bulunan** konumlar listeleniyor.
 * Tam liste, kullanıcıya sonucu boş dönecek 70 seçenek sunardı — ve boş
 * sonucun sebebini süzgecin kendisi yaratmış olurdu.
 */
export function mevcutKonumlar(urunler: Product[]): string[] {
  const küme = new Set<string>();
  for (const p of urunler) {
    if (p.location && p.location !== 'Belirtilmedi') küme.add(p.location);
  }
  return [...küme].sort((a, b) => a.localeCompare(b, 'tr'));
}

/** Rafta bulunan en yüksek puan — aralık girdisine ipucu olarak yazılıyor. */
export function enYuksekPuan(urunler: Product[]): number {
  return urunler.reduce((en, p) => Math.max(en, p.points), 0);
}
