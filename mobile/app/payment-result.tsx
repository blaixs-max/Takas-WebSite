import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, shape } from '../theme/tokens';

/**
 * `eldenele://payment-result` — ödeme dönüşünün indiği rota.
 *
 * ## Neden gerekli
 *
 * Normal akışta bu ekran **hiç görünmez**: `openCheckout`,
 * `openAuthSessionAsync` ile tarayıcıyı kendi açtığı için dönüş adresini de
 * kendisi yakalar, tarayıcı kapanır ve kullanıcı `payment.tsx`'te kalır.
 *
 * Ama uygulama tarayıcı açıkken **öldürülürse** — Android'de düşük bellekte
 * sık olur — o oturum yok olur. Kullanıcı ödemeyi tamamlar, sistem
 * `eldenele://payment-result?status=...` ile uygulamayı soğuk açar ve
 * yakalayacak bir oturum kalmamıştır. Rota olmadığı için Expo Router
 * eşleşmeyen bir ekran gösteriyordu: kişi parasını ödemiş, hiçbir yere
 * inmiş oluyordu.
 *
 * `auth-callback` ile tam olarak aynı kusurdu; o bugün yazıldı, bu da.
 *
 * ## Buradaki sonuç bir iddia değil, bir bilgilendirme
 *
 * `status` adres çubuğundan geliyor ve **kanıt değildir** — herhangi bir
 * uygulama bu adresi `status=success` ile açabilir. Bu yüzden ekran hiçbir
 * şey yazmıyor, hiçbir durumu değiştirmiyor: yalnızca cümle kuruyor ve
 * kullanıcıyı gerçeği sunucudan okuyan `Takaslarım`a gönderiyor. Ödemenin
 * alındığına iyzico'ya RETRIEVE ile soran `iyzico-callback` karar verir.
 */
export default function PaymentResult() {
  const router = useRouter();
  const { status } = useLocalSearchParams<{ status?: string; trade?: string }>();
  const [gecikti, setGecikti] = useState(false);

  /* Parametre ilk karede boş gelebiliyor (soğuk açılış). Kısa bir an bekleyip
     yine boşsa "bilinmiyor" muamelesi yapıyoruz — sonsuza kadar dönen bir
     çark, ödeme sonrası görülecek en kötü şey. */
  useEffect(() => {
    const t = setTimeout(() => setGecikti(true), 1200);
    return () => clearTimeout(t);
  }, []);

  if (!status && !gecikti) {
    return (
      <View style={styles.kok}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const goruntu =
    status === 'success'
      ? {
          ikon: 'check-circle' as const,
          renk: colors.primary,
          zemin: colors.primaryContainer,
          baslik: 'Ödeme alındı',
          metin:
            'Satıcıya bildirildi. Ürün kargoya verilince Takaslarım ekranından takip edebilirsin.',
        }
      : status === 'failure'
        ? {
            ikon: 'error-outline' as const,
            renk: colors.error,
            zemin: colors.errorContainer,
            baslik: 'Ödeme tamamlanmadı',
            metin:
              'Kart işlemi onaylanmadı. Takas Puanın Güvenli Havuz’da bekliyor; ödemeyi yeniden deneyebilirsin.',
          }
        : {
            /* `pending` ve bilinmeyen durum aynı yere düşüyor: ikisinde de
               sonucu bilmiyoruz ve "başarılı" ya da "başarısız" demek
               kullanıcıyı yanıltırdı. */
            ikon: 'hourglass-empty' as const,
            renk: colors.onSurfaceVariant,
            zemin: colors.surfaceContainerHigh,
            baslik: 'Ödeme durumu doğrulanıyor',
            metin:
              'Sonucu bankandan teyit ediyoruz. Takaslarım ekranı güncel durumu gösterir; birkaç dakika içinde netleşir.',
          };

  return (
    <View style={styles.kok}>
      <View style={[styles.daire, { backgroundColor: goruntu.zemin }]}>
        <MaterialIcons name={goruntu.ikon} size={30} color={goruntu.renk} />
      </View>
      <Text style={styles.baslik}>{goruntu.baslik}</Text>
      <Text style={styles.metin}>{goruntu.metin}</Text>
      <Pressable style={styles.cta} onPress={() => router.replace('/trades')}>
        <Text style={styles.ctaText}>Takaslarıma git</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  kok: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
    gap: 12,
  },
  daire: {
    width: 68,
    height: 68,
    borderRadius: shape.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  baslik: { fontSize: 19, fontWeight: '800', color: colors.onSurface },
  metin: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  cta: {
    height: 48,
    paddingHorizontal: 32,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
