import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme/tokens';

/**
 * Takas Puanı işareti — iki parçaya bölünmüş dolu bir taş.
 *
 * Konturlar sitedeki `src/components/icons/Diamond.tsx` ile **birebir aynı**
 * (aynı `viewBox`, aynı iki `d`). İki dosya aynı adı taşıyor ki parite
 * arandığında ikisi birden bulunsun; biri değişirse öteki de değişir.
 *
 * Tek faset çizgisi çizilmiş bir çizgi değil, dolgudaki boşluk: zemin arasından
 * görünüyor. Bu yüzden hazır bir mücevher ikonunun çizdiği üç çizgi yerine tek
 * çizgi kalıyor ve işaret her zeminde çalışıyor.
 *
 * ## Neden `MaterialIcons name="paid"` değil
 *
 * Uygulama puanı daire içinde bir **dolar işaretiyle** gösteriyordu. Eldenele
 * kapalı devre bir puan sistemi: Takas Puanı para değil, para birimine
 * çevrilmiyor ve çekilemiyor. Ürünün yanında duran bir `$`, kullanıcıya
 * ürünün fiyatını okuduğunu söyler. Site bu yüzden en başından beri bu taşı
 * kullanıyor; uygulama geride kalmıştı.
 */
export function Diamond({
  size = 16,
  color = colors.onPrimaryContainer,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M6 3h12l3.73 5.6H2.27Z" />
      <Path fill={color} d="M2.31 9.4h19.38L12 22Z" />
    </Svg>
  );
}
