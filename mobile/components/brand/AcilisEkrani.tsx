import React from 'react';
import { ActivityIndicator, Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { BRAND, SLOGAN } from '../../lib/brand';
import { colors } from '../../theme/tokens';

/**
 * Uygulama açılış ekranı — JS tarafı.
 *
 * ## Neden ayrı bir bileşen var
 *
 * Açılışta üç ayrı ekran arka arkaya geliyor ve üçü de farklı yerden
 * besleniyor:
 *
 * 1. **Expo Go'nun yükleme ekranı** — `app.json` içindeki `icon` + `name`.
 *    `splash.png`'yi *hiç* göstermez. Expo Go'da gördüğün ilk kare budur ve
 *    buradan değiştirilemez; simge dosyası değişmeden değişmez.
 * 2. **Yerel açılış ekranı** — `splash.png`. Yalnızca kendi derlemende
 *    (dev-client / mağaza derlemesi) çıkar.
 * 3. **Bu ekran** — paket yüklendikten sonra, oturum çözülene kadar. Her iki
 *    ortamda da çıkar.
 *
 * Buranın eskiden gösterdiği şey, krem zeminde çıplak bir dönen çemberdi:
 * marka açılışın en görünür saniyesinde hiç yoktu.
 *
 * ## Neden kilit parçalardan kurulmuyor
 *
 * İlk hâli amblemi, kelime logosunu ve sloganı ayrı ayrı diziyordu. Sorun
 * slogandı: `splash.png` onu Nunito 800 ile pişiriyor, uygulama ise Nunito'yu
 * yüklemiyor — metin sistem yazı tipiyle çiziliyordu. Yerel açılış ekranından
 * bu ekrana geçerken aynı cümle iki farklı yüzle görünüyordu.
 *
 * Bu yüzden burası aynı `splash.png` dosyasını çiziyor. Yerleşim de yerel
 * açılış ekranıyla birebir eşleşsin diye aynı kuralı uyguluyor: kare görsel
 * `contain` ile sığdırılıyor, yani dar kenar kadar genişleyip dikeyde
 * ortalanıyor. İki kare üst üste binince geçiş görünmüyor.
 *
 * Zemin `colors.surface`, `app.json`'daki `splash.backgroundColor` ile aynı
 * değer olmak zorunda; ayrışırsa geçişte bir kare zemin sıçraması görünür.
 */
export function AcilisEkrani() {
  const { width, height } = useWindowDimensions();
  /* `resizeMode: contain` kare görseli dar kenara oturtur. */
  const kenar = Math.min(width, height);

  return (
    <View style={styles.root}>
      <Image
        source={require('../../assets/app/splash.png')}
        style={{ width: kenar, height: kenar }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
        accessible
        accessibilityRole="image"
        /* Ekran okuyucu logoyu göremiyor; kilit ne diyorsa onu söylüyor. */
        accessibilityLabel={`${BRAND} — ${SLOGAN}`}
      />
      {/* Dönen çember markanın altında değil, ekranın dibinde: yükleniyor
          bilgisi logoyla yarışmasın. */}
      <ActivityIndicator style={styles.spinner} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: { position: 'absolute', bottom: 64 },
});
