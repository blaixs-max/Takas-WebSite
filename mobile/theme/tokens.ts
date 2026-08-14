/**
 * ELDENELE — tema tokenları (v4).
 *
 * Değerler **yeni UI tasarımından ölçüldü**: `tasarim/yeni ekran UI'ları/`
 * altındaki 24 ekranın baskın renkleri sayılarak çıkarıldı, göz kararı
 * seçilmedi. Marka dokümanının sekiz rengi değişmedi — "App Metin ve UX
 * Rehberi" (14 Ağustos 2026) aynı sekizliyi ve "yeni ana renk eklenmez"
 * kuralını tekrarlıyor. Değişen şey, o sekiz rengin çevresindeki krem ve
 * turkuaz basamaklar.
 *
 * Ölçülen değerler:
 *
 * | Rol | Değer | Nerede |
 * |---|---|---|
 * | Sayfa zemini | `#FBF8F2` | her ekranın %23–86'sı |
 * | Kart | `#FFFFFF` | ürün kartı, satıcı kartı |
 * | Alt bar / yumuşak yüzey | `#FFF9EF` | sekme çubuğu |
 * | Ayraç / nötr çip | `#F3EBDD` | kalp dairesi, kenarlıklar |
 * | Arama alanı | `#E7E1D5` | anasayfa arama çubuğu |
 * | Açık turkuaz | `#DDF5F8` | puan hapı, bilgi kartları |
 * | İkincil metin | `#5E6876` | konum satırı, açıklamalar |
 *
 * ## primary neden `#00718A`
 *
 * Değişmedi ve değişmiyor: beyaz metin `#008BAA` üzerinde **3.98** kontrast
 * veriyor, WCAG AA'nın normal metin eşiği 4.5. Aynı ölçüm `#00718A` için
 * 5.63. Tasarımdaki seçili çipin metni de ölçtüğümde `#006F84` çıktı — yani
 * tasarım da aynı koyu turkuazı kullanıyor.
 *
 * Kimlik yüzeyleri (gradyan, simge, logo zemini) `brand` ile tam `#008BAA`.
 */
export const colors = {
  /** Marka kimliği — gradyan, simge, logo zemini. Küçük metin taşımaz. */
  brand: '#008BAA',
  /** Açık vurgu türevi; koyu zeminde ikon ve altı çizili vurgu. */
  brandLight: '#5FC8DE',

  primary: '#00718A',
  onPrimary: '#ffffff',
  /** Ölçüm: puan hapı ve bilgi kartlarının zemini. Eski `#b7edff`ten
      belirgin daha yumuşak ve krem zeminle uyumlu. */
  primaryContainer: '#DDF5F8',
  onPrimaryContainer: '#00485A',

  secondary: '#49636c',
  secondaryContainer: '#c9e9f4',
  onSecondaryContainer: '#002029',

  /** Sıcak vurgu — marka turuncusu `#FFA726`. Rehber "sınırlı ama
      görünür" diyor: arama çubuğundaki eylem düğmesi ve uyarı çipleri. */
  tertiary: '#9e6300',
  tertiaryOn: '#FFA726',
  tertiaryContainer: '#FFF0DA',
  onTertiaryContainer: '#5A3A00',

  /** Geri bildirim — mercandan türetildi; `#FF6B6B` metin olarak okunmuyor. */
  error: '#b4202e',
  errorContainer: '#ffe0dd',

  /** Zemin ailesi — hepsi yeni tasarımdan ölçüldü. */
  surface: '#FBF8F2',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#FFF9EF',
  surfaceContainer: '#F6F3ED',
  surfaceContainerHigh: '#F3EBDD',
  surfaceContainerHighest: '#E7E1D5',

  onSurface: '#1F2937',
  onSurfaceVariant: '#5E6876',
  outline: '#9A9384',
  outlineVariant: '#F3EBDD',

  /** Rozet altını — marka sarısından okunur tona çekildi. */
  gold: '#8b6e00',

  /**
   * Marka gradyanları. Değerler sitedeki uygulama bandından birebir alındı
   * (`linear-gradient(115deg, #007A96 0%, #009BBB 52%, #00B2C9 100%)`), yani
   * iki üründe aynı turkuaz akışı görünüyor.
   */
  /** Cüzdan kartı. Tasarımda ölçülen iki uç: `#008BAA` → `#1896B2`. */
  balanceGradient: ['#008BAA', '#1896B2'] as const,
  coverGradient: ['#1896B2', '#00718A'] as const,
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
