/**
 * ELDENELE — Material Design 3 tema tokenları (v3).
 *
 * Kaynak marka dokümanının 6. bölümü: **sekiz renk sabittir, yenisi eklenmez.**
 * Ana turkuaz `#008BAA`, turuncu `#FFA726`, koyu metin `#1F2937`, mor
 * `#8B5CF6`, mercan `#FF6B6B`, yeşil `#7AC943`, sarı `#FFD23F`, mavi `#3B82F6`.
 * Ara tonlar (`#00718A` koyu turkuaz, `#5FC8DE` açık vurgu, `#FDF8EF` krem
 * zemin, `#EFE6D6` ayraç) paletten türetilmiştir, yeni renk sayılmaz.
 *
 * Buradaki tonal basamaklar göz kararı seçilmedi: OKLCH'te hue ve kroma
 * sabit tutulup ton ekseni CIE L* üzerinden yürütülerek hesaplandı, gamut
 * dışına taşan ton hue kaydırmamak için kroma düşürülerek geri çekildi.
 * (Sitede turkuazı bir kez göz kararı kestirmiştim ve yanlış çıkmıştı.)
 *
 * ## primary neden `#00718A`, `#008BAA` değil
 *
 * M3'te `primary`, tanımı gereği `onPrimary`nin — yani beyazın — üstüne
 * oturduğu renktir. Beyaz metin `#008BAA` üzerinde **3.98** kontrast veriyor;
 * bu WCAG AA'nın normal metin eşiği olan 4.5'in altında ve uygulamadaki
 * doldurulmuş düğmelerin çoğu 15–16 piksel metin taşıyor. Aynı ölçüm
 * `#00718A` için **5.63**. İkisi de marka değeri, ikisi de aynı turkuaz;
 * biri okunuyor, diğeri okunmuyor.
 *
 * Marka kimliğini taşıyan yüzeyler — gradyan, uygulama simgesi, logo zemini —
 * `brand` ile hâlâ tam `#008BAA`. Küçük beyaz metin yalnızca `primary`
 * üzerinde duruyor.
 *
 * Not: web sitesi doldurulmuş CTA'sında `#008BAA` + beyaz 12 piksel metin
 * kullanıyor, yani aynı kontrast açığı orada da var. Bu dosya siteyi takip
 * etmiyor, marka dokümanını takip ediyor; site tarafı ayrıca ele alınmalı.
 */
export const colors = {
  /** Marka kimliği — gradyan, simge, logo zemini. Küçük metin taşımaz. */
  brand: '#008BAA',
  /** Açık vurgu türevi; koyu zeminde ikon ve altı çizili vurgu. */
  brandLight: '#5FC8DE',

  primary: '#00718A',
  onPrimary: '#ffffff',
  primaryContainer: '#b7edff',
  onPrimaryContainer: '#002029',

  secondary: '#49636c',
  secondaryContainer: '#c9e9f4',
  onSecondaryContainer: '#002029',

  /** Sıcak vurgu — marka turuncusu. Sınırlı ama görünür. */
  tertiary: '#9e6300',
  tertiaryContainer: '#ffdcb5',
  onTertiaryContainer: '#2f1a00',

  /** Geri bildirim — mercandan türetildi; `#FF6B6B` metin olarak okunmuyor. */
  error: '#b4202e',
  errorContainer: '#ffe0dd',

  /** Zemin ailesi krem eksende: marka kremi ve ayracı basamak olarak duruyor. */
  surface: '#faf7f2',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#fdf8ef',
  surfaceContainer: '#f7f0e3',
  surfaceContainerHigh: '#efe6d6',
  surfaceContainerHighest: '#e6dbc8',

  onSurface: '#1f2937',
  onSurfaceVariant: '#4b5563',
  outline: '#87837c',
  outlineVariant: '#dbd7cf',

  /** Rozet altını — marka sarısından okunur tona çekildi. */
  gold: '#8b6e00',

  /**
   * Marka gradyanları. Değerler sitedeki uygulama bandından birebir alındı
   * (`linear-gradient(115deg, #007A96 0%, #009BBB 52%, #00B2C9 100%)`), yani
   * iki üründe aynı turkuaz akışı görünüyor.
   */
  balanceGradient: ['#007a96', '#009bbb', '#00b2c9'] as const,
  coverGradient: ['#009bbb', '#00718a'] as const,
  onDark: '#ffffff',
} as const;

/** M3 shape scale */
export const shape = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  full: 999,
} as const;

/** M3 elevation (RN shadow + Android elevation eşlemesi) */
export const elevation = {
  level1: {
    shadowColor: '#1f2937',
    shadowOpacity: 0.16,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  level2: {
    shadowColor: '#1f2937',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  level3: {
    shadowColor: '#1f2937',
    shadowOpacity: 0.2,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
} as const;
