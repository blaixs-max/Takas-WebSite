import { StyleSheet, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, shape } from '../theme/tokens';

/**
 * Eşleşmeyen adres.
 *
 * ## Neden gerekli
 *
 * Expo Router'ın kendi varsayılan ekranı var ama o bir geliştirici ekranı:
 * İngilizce, gri, "Unmatched Route" yazıyor ve altında dosya yolu gösteriyor.
 * Kullanıcının bunu göreceği yer teorik değil — uygulama derin bağlantı
 * alıyor: e-posta doğrulaması (`auth-callback`), şifre sıfırlama
 * (`yeni-sifre`), ödeme dönüşü (`payment-result`) ve paylaşılan ilan
 * bağlantıları. Bunlardan biri eski, kırık ya da elle kırpılmış geldiğinde
 * kullanıcı doğrudan buraya düşüyor.
 *
 * Kaldırılmış bir ilanın bağlantısı da buraya gelmiyor — `product/[id]`
 * eşleşiyor ve kendi "ilan bulunamadı" durumunu çiziyor. Burası gerçekten
 * hiçbir ekrana karşılık gelmeyen adres için.
 *
 * ## Neden "ana sayfa" değil de geri dönüş
 *
 * `Link` `href="/"` sekmelere gidiyor ve `replace` kullanıyor: geçmişte
 * kırık adresin kalması, geri tuşunun kullanıcıyı tekrar bu ekrana
 * getirmesi demekti.
 */
export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'Sayfa bulunamadı' }} />
      <View style={styles.kok}>
        <View style={styles.daire}>
          <MaterialIcons name="link-off" size={26} color={colors.onSurfaceVariant} />
        </View>
        <Text style={styles.baslik}>Bu bağlantı çalışmıyor</Text>
        <Text style={styles.metin}>
          Aradığın sayfa taşınmış ya da bağlantı eksik olabilir. Ana sayfaya dönüp devam
          edebilirsin.
        </Text>
        <Link href="/" replace style={styles.cta}>
          <Text style={styles.ctaText}>Ana sayfaya dön</Text>
        </Link>
      </View>
    </>
  );
}

/* Ölçüler `components/BosDurum.tsx` ile aynı: 64 pt krem daire, 17 pt başlık,
   iki satır açıklama, hap CTA. Bileşenin kendisi kullanılmadı çünkü buradaki
   eylem bir `Link` olmalı — `BosDurum` düğmeye `onPress` veriyor ve
   `router.replace` çağırmak için önce yönlendiriciyi beklemek gerekirdi;
   eşleşmeyen adreste yönlendirici zaten tuhaf bir durumda. */
const styles = StyleSheet.create({
  kok: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
    backgroundColor: colors.surface,
  },
  daire: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  baslik: { fontSize: 17, fontWeight: '800', color: colors.onSurface, textAlign: 'center' },
  metin: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '500',
  },
  cta: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: shape.full,
  },
  ctaText: { fontSize: 14, fontWeight: '800', color: colors.onPrimary },
});
