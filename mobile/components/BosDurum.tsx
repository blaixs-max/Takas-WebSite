import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, shape } from '../theme/tokens';

/**
 * Boş durum — sepet, favoriler, mesajlar, bildirimler, takaslar, sohbet,
 * taslaklar ve cüzdan hareketleri hep bunu çiziyor.
 *
 * ## Neden tek bir bileşen
 *
 * Altı ekranın her birinde ayrı bir kopya vardı ve hiçbiri diğerine benzemi-
 * yordu: başlık kimi yerde 16 kimi yerde 18, daire kimi yerde 80 kimi yerde
 * hiç yok, biri "Henüz favori yok" derken öbürü "Henüz mesajınız yok" —
 * yani biri senli, biri sizli. Tasarımda altısı **birebir aynı** kare:
 * 64 pt'lik krem daire, 17 pt başlık, iki satır açıklama, altında hap CTA.
 *
 * Ölçüler `18_13_Favorilerim.png` ve `20_15_Mesajlarim.png` üzerinden alındı.
 *
 * ## Metinler
 *
 * Başlık ve açıklama çağıran ekrandan geliyor ama hepsi rehberin ilgili
 * bölümünden birebir alınmış durumda (07 sepet, 11 taslaklar, 12 takaslar,
 * 13 favoriler, 14 cüzdan, 15 mesajlar, 16 bildirimler, 18 sohbet). Rehber
 * baştan sona **senli** yazıyor; buradaki eski "mesajınız yok" gibi sizli
 * kalıplar onunla birlikte düştü.
 *
 * CTA isteğe bağlı: bildirimlerde ve sohbette tasarımda düğme yok — kullanıcı
 * zaten gitmesi gereken yerde, oraya bir "keşfet" koymak onu geri gönderirdi.
 */
export function BosDurum({
  ikon,
  baslik,
  metin,
  cta,
  onCta,
}: {
  ikon: keyof typeof MaterialIcons.glyphMap;
  baslik: string;
  metin: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <View style={styles.kok}>
      <View style={styles.daire}>
        <MaterialIcons name={ikon} size={26} color={colors.onSurfaceVariant} />
      </View>
      <Text style={styles.baslik}>{baslik}</Text>
      <Text style={styles.metin}>{metin}</Text>
      {cta && onCta ? (
        <Pressable style={styles.cta} onPress={onCta} accessibilityRole="button">
          <Text style={styles.ctaText}>{cta}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  kok: { alignItems: 'center', paddingHorizontal: 34, paddingTop: 96 },
  daire: {
    width: 64,
    height: 64,
    borderRadius: shape.full,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baslik: { fontSize: 17, fontWeight: '800', color: colors.onSurface, marginTop: 18 },
  metin: {
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 18,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 8,
  },
  cta: {
    height: 46,
    paddingHorizontal: 34,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  ctaText: { color: '#fff', fontSize: 13.5, fontWeight: '800' },
});
