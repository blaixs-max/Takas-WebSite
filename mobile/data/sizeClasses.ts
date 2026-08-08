/**
 * Desi kademeleri — `shipping_rates` tablosunun aynası.
 *
 * Buradaki değerler yalnızca ilan formunda seçim göstermek ve kabaca kargo
 * bedelini önizlemek içindir. Alıcının ödeyeceği gerçek tutarı HER ZAMAN
 * sunucu hesaplar (`quote_trade_price`); bu dosyadaki rakamlar hiçbir ödemeye
 * girdi olmaz. Tarife değişirse burası da elle güncellenir.
 */
export const SIZE_CLASSES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;

export type SizeClass = (typeof SIZE_CLASSES)[number];

interface SizeInfo {
  /** Kullanıcının tanıyacağı bir örnek — desi soyut bir kavram. */
  ornek: string;
  desi: string;
  /** Alıcıya yansıyan kargo bedeli, TL. Yalnızca önizleme. */
  kargoTl: number;
}

export const SIZE_INFO: Record<SizeClass, SizeInfo> = {
  XS: { ornek: 'Kitap, küçük oyuncak', desi: '0–1 desi', kargoTl: 38 },
  S: { ornek: 'Ayakkabı kutusu', desi: '2–3 desi', kargoTl: 52 },
  M: { ornek: 'Orta koli', desi: '4–10 desi', kargoTl: 78 },
  L: { ornek: 'Büyük koli', desi: '11–20 desi', kargoTl: 115 },
  XL: { ornek: 'Mama sandalyesi', desi: '21–30 desi', kargoTl: 175 },
  XXL: { ornek: 'Bebek arabası, park yatak', desi: '30+ desi', kargoTl: 250 },
};
