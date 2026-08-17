/**
 * Desi kademeleri — `shipping_rates` tablosunun aynası.
 *
 * Buradaki değerler yalnızca ilan formunda seçim göstermek ve kabaca kargo
 * bedelini önizlemek içindir. Alıcının ödeyeceği gerçek tutarı HER ZAMAN
 * sunucu hesaplar (`quote_trade_price`); bu dosyadaki rakamlar hiçbir ödemeye
 * girdi olmaz. Tarife değişirse burası da elle güncellenir.
 *
 * ## Santimetreler nereden geliyor
 *
 * Türkiye'de kargo desisi `en × boy × yükseklik / 3000` ile bulunuyor.
 * Her kademenin `enCm/boyCm/yukseklikCm` değeri o kademenin **üst sınırını**
 * veren kutudur ve tam da kademe tavanına oturur:
 *
 * | Kademe | Kutu | Hesap | Kademe |
 * |---|---|---|---|
 * | XS | 20×15×10 | 3.000/3000 = 1 | 0–1 desi |
 * | S | 30×20×15 | 9.000/3000 = 3 | 2–3 desi |
 * | M | 40×30×25 | 30.000/3000 = 10 | 4–10 desi |
 * | L | 50×40×30 | 60.000/3000 = 20 | 11–20 desi |
 * | XL | 60×50×30 | 90.000/3000 = 30 | 21–30 desi |
 * | XXL | 70×50×40 | 46,7 | 30+ desi (tavan yok) |
 *
 * Kademeleri "0–1 desi" diye göstermek doğru ama işe yaramıyordu: kimse
 * elindeki kutunun kaç desi olduğunu bilmiyor. Santimetre ve kilogram
 * herkesin ölçebildiği iki şey, desi ise türetilmiş bir birim — o yüzden
 * ekranda önce kutu çiziliyor, desi altına küçük yazılıyor.
 *
 * `maxKg` ayrı bir alan çünkü kargo şirketi **desi ile kilonun büyüğünden**
 * ücretlendiriyor. Hafif ama hacimli bir park yatak desiden, küçük ama ağır
 * bir kutu kilodan ücretlenir; kullanıcı ikisini de görmeli.
 */
export const SIZE_CLASSES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;

export type SizeClass = (typeof SIZE_CLASSES)[number];

interface SizeInfo {
  /** Kullanıcının tanıyacağı bir örnek — desi soyut bir kavram. */
  ornek: string;
  desi: string;
  /** Alıcıya yansıyan kargo bedeli, TL. Yalnızca önizleme. */
  kargoTl: number;
  /** Kademenin üst sınırındaki kutu, santimetre. Teknik çizim bunu kullanıyor. */
  enCm: number;
  boyCm: number;
  yukseklikCm: number;
  /** Bu kademede taşınabilecek en yüksek ağırlık, kilogram. */
  maxKg: number;
  /** Tavanı olmayan kademe — çizimin altına "ve üzeri" yazılıyor. */
  ustSinirsiz?: boolean;
}

export const SIZE_INFO: Record<SizeClass, SizeInfo> = {
  XS: {
    ornek: 'Kitap, küçük oyuncak',
    desi: '0–1 desi',
    kargoTl: 38,
    enCm: 20,
    boyCm: 15,
    yukseklikCm: 10,
    maxKg: 1,
  },
  S: {
    ornek: 'Ayakkabı kutusu',
    desi: '2–3 desi',
    kargoTl: 52,
    enCm: 30,
    boyCm: 20,
    yukseklikCm: 15,
    maxKg: 3,
  },
  M: {
    ornek: 'Orta koli',
    desi: '4–10 desi',
    kargoTl: 78,
    enCm: 40,
    boyCm: 30,
    yukseklikCm: 25,
    maxKg: 10,
  },
  L: {
    ornek: 'Büyük koli',
    desi: '11–20 desi',
    kargoTl: 115,
    enCm: 50,
    boyCm: 40,
    yukseklikCm: 30,
    maxKg: 20,
  },
  XL: {
    ornek: 'Mama sandalyesi',
    desi: '21–30 desi',
    kargoTl: 175,
    enCm: 60,
    boyCm: 50,
    yukseklikCm: 30,
    maxKg: 30,
  },
  XXL: {
    ornek: 'Bebek arabası, park yatak',
    desi: '30+ desi',
    kargoTl: 250,
    enCm: 70,
    boyCm: 50,
    yukseklikCm: 40,
    maxKg: 30,
    ustSinirsiz: true,
  },
};

/**
 * Bütün kademelerin ortak ölçeği — çizimler birbiriyle kıyaslanabilsin diye.
 *
 * Her kutuyu kendi tuvaline sığdırsaydık XS ile XXL ekranda aynı büyüklükte
 * görünürdü ve çizimin tek işi olan "benimki hangisi" sorusuna cevap vermezdi.
 */
export const EN_BUYUK_KUTU = {
  en: SIZE_INFO.XXL.enCm,
  boy: SIZE_INFO.XXL.boyCm,
  yukseklik: SIZE_INFO.XXL.yukseklikCm,
};
