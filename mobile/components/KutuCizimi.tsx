import { memo } from 'react';
import Svg, { G, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme/tokens';
import { EN_BUYUK_KUTU } from '../data/sizeClasses';

/**
 * Kargo kademesinin teknik çizimi — izometrik bir koli, kenarları ölçülü.
 *
 * ## Neden çizim
 *
 * Kademe seçimi altı harften ibaretti (XS…XXL) ve altında "4–10 desi" yazıyordu.
 * Desi türetilmiş bir birim: kimse elindeki kutuya bakıp desisini bilmiyor.
 * Yanlış kademe seçmenin bedeli de küçük değil — kargo bedelini alıcı ödüyor
 * ve eksik seçilen kademe teslimatta farkı satıcıya bırakıyor. Santimetre
 * herkesin ölçebildiği bir şey; ekran onu göstermeli.
 *
 * ## Neden ortak ölçek
 *
 * Her kutuyu kendi tuvaline sığdırmak en kolay yol ama en yanlışı: XS ile XXL
 * ekranda aynı büyüklükte görünür ve çizimin tek işi olan "benimki hangisi"
 * sorusu cevapsız kalır. Ölçek `EN_BUYUK_KUTU`'dan geliyor, yani bütün
 * kademeler tek bir cetvelle çiziliyor ve XS gerçekten küçücük duruyor.
 *
 * Aynı sebeple, seçili kutu XXL değilken arkasına en büyük kutunun kesik
 * çizgili silueti düşüyor: kıyas için bir referans olmadan "küçük" göreli bir
 * kelime.
 *
 * ## İzdüşüm
 *
 * Gerçek izometri değil, kabinet izdüşümü: derinlik ekseni sağa yukarı
 * `(+0.5, −0.35)` gidiyor ve **kısaltılıyor**. Tam izometride üç kenar da eşit
 * ölçekte çizilir ve 70×50 bir koli neredeyse kare görünür; kısaltma, öndeki
 * yüzü baskın tutuyor — kullanıcının kafasındaki "koli" görüntüsü bu.
 */
const DERINLIK_X = 0.5;
const DERINLIK_Y = 0.35;

/** Etiket payları: sol ölçü yazısı, alt ölçü yazısı, derinlik yazısı. */
const SOL = 30;
const SAG = 40;
const UST = 12;
const ALT = 22;

interface Props {
  enCm: number;
  boyCm: number;
  yukseklikCm: number;
  /** Tuvalin kullanabileceği genişlik, piksel. */
  genislik: number;
  /** Seçili kutu vurgulu, seçili olmayan soluk çiziliyor. */
  secili?: boolean;
}

function Cizim({ enCm, boyCm, yukseklikCm, genislik, secili = true }: Props) {
  /* Ölçek en büyük kutudan: tuval genişliği, XXL'in izdüşüm genişliğine
     bölünüyor. Böylece hangi kademe çizilirse çizilsin cetvel aynı. */
  const refGenislik = EN_BUYUK_KUTU.en + EN_BUYUK_KUTU.boy * DERINLIK_X;
  const refYukseklik = EN_BUYUK_KUTU.yukseklik + EN_BUYUK_KUTU.boy * DERINLIK_Y;
  const s = (genislik - SOL - SAG) / refGenislik;

  const tuvalG = genislik;
  const tuvalY = refYukseklik * s + UST + ALT;

  const kutu = (en: number, boy: number, yuk: number) => {
    const E = en * s;
    const Y = yuk * s;
    const Dx = boy * s * DERINLIK_X;
    const Dy = boy * s * DERINLIK_Y;
    /* Taban her zaman tuvalin altına oturuyor: kutular ortalansaydı küçük
       kademeler havada asılı görünür ve boy kıyası bozulurdu. */
    const y0 = UST + refYukseklik * s - Y - Dy;
    return {
      E,
      Y,
      Dx,
      Dy,
      // ön yüz
      A: [SOL, y0 + Y + Dy],
      B: [SOL + E, y0 + Y + Dy],
      C: [SOL + E, y0 + Dy],
      D: [SOL, y0 + Dy],
      // arka üst kenarlar
      Dust: [SOL + Dx, y0],
      Cust: [SOL + E + Dx, y0],
      Barka: [SOL + E + Dx, y0 + Y],
    };
  };

  const k = kutu(enCm, boyCm, yukseklikCm);
  const p = (v: number[]) => `${v[0]},${v[1]}`;

  const ref =
    enCm === EN_BUYUK_KUTU.en &&
    boyCm === EN_BUYUK_KUTU.boy &&
    yukseklikCm === EN_BUYUK_KUTU.yukseklik
      ? null
      : kutu(EN_BUYUK_KUTU.en, EN_BUYUK_KUTU.boy, EN_BUYUK_KUTU.yukseklik);

  const cizgi = secili ? colors.primary : colors.outline;
  const onYuz = secili ? colors.primaryContainer : colors.surfaceContainerHigh;
  const olcuRengi = secili ? colors.onPrimaryContainer : colors.onSurfaceVariant;

  return (
    <Svg width={tuvalG} height={tuvalY} viewBox={`0 0 ${tuvalG} ${tuvalY}`}>
      {/* En büyük kademenin silueti — kıyas referansı, ölçü yazısı yok. */}
      {ref ? (
        <Polygon
          points={[
            p(ref.A),
            p(ref.B),
            p(ref.Barka),
            p(ref.Cust),
            p(ref.Dust),
            p(ref.D),
          ].join(' ')}
          fill="none"
          stroke={colors.outlineVariant}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      ) : null}

      <G>
        {/* Üst yüz en açık, yan yüz en koyu: ışık soldan üstten geliyor
            varsayımı. Üç yüz aynı tonda olsaydı kutu düz bir altıgen olurdu. */}
        <Polygon
          points={[p(k.D), p(k.Dust), p(k.Cust), p(k.C)].join(' ')}
          fill={onYuz}
          fillOpacity={0.55}
          stroke={cizgi}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        <Polygon
          points={[p(k.C), p(k.Cust), p(k.Barka), p(k.B)].join(' ')}
          fill={cizgi}
          fillOpacity={0.16}
          stroke={cizgi}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        <Polygon
          points={[p(k.A), p(k.B), p(k.C), p(k.D)].join(' ')}
          fill={onYuz}
          stroke={cizgi}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      </G>

      {/* Ölçü çizgileri — teknik çizim dilinde: kenardan ayrı, uçları kertikli. */}
      <Line
        x1={k.A[0]}
        y1={k.A[1] + 9}
        x2={k.B[0]}
        y2={k.B[1] + 9}
        stroke={olcuRengi}
        strokeWidth={0.9}
      />
      <SvgText
        x={(k.A[0] + k.B[0]) / 2}
        y={k.A[1] + 20}
        fontSize={10}
        fontWeight="700"
        fill={olcuRengi}
        textAnchor="middle"
      >
        {`${enCm} cm`}
      </SvgText>

      <Line
        x1={k.A[0] - 8}
        y1={k.A[1]}
        x2={k.D[0] - 8}
        y2={k.D[1]}
        stroke={olcuRengi}
        strokeWidth={0.9}
      />
      <SvgText
        x={k.A[0] - 12}
        y={(k.A[1] + k.D[1]) / 2}
        fontSize={10}
        fontWeight="700"
        fill={olcuRengi}
        textAnchor="middle"
        transform={`rotate(-90 ${k.A[0] - 12} ${(k.A[1] + k.D[1]) / 2})`}
      >
        {`${yukseklikCm} cm`}
      </SvgText>

      {/* Derinlik yazısı kutunun sağ üst köşesinden dışarı taşıyor: derinlik
          kenarının üstüne yazılsaydı kısa kademelerde çizginin içine düşerdi. */}
      <SvgText
        x={k.Cust[0] + 4}
        y={k.Cust[1] + 10}
        fontSize={10}
        fontWeight="700"
        fill={olcuRengi}
        textAnchor="start"
      >
        {`${boyCm} cm`}
      </SvgText>
    </Svg>
  );
}

export const KutuCizimi = memo(Cizim);
