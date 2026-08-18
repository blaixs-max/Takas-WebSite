import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BosDurum } from '../components/BosDurum';
import { uyar } from '../components/Dialog';
import { imzaliBaglantilar } from '../lib/admin';
import { MyListing, deleteListing, loadMyListings } from '../lib/listings';
import { binlik } from '../lib/profile';
import { colors, elevation, shape } from '../theme/tokens';

/**
 * Yayındaki ilanlarım.
 *
 * Profil ekranındaki "N ilanın yayında" kutusu bugüne kadar rafa götürüyordu:
 * kullanıcının **kendi** ilanlarını değil, herkesin ilanlarını. Kendi ilanını
 * bulmak için vitrinde kaydırmak gerekiyordu ve bulduğunda da yapabileceği
 * bir şey yoktu — ilanı kaldırmanın hiçbir yolu yoktu.
 *
 * Taslaklardan ayrı ekran: taslak "bitmemiş iş", buradakiler "biten iş". Aynı
 * listede yan yana dursalardı yayına alma düğmesiyle kaldırma düğmesi aynı
 * satırda görünürdü.
 */
export default function MyListings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [liste, setListe] = useState<MyListing[]>([]);
  const [kapaklar, setKapaklar] = useState<Record<string, string>>({});
  const [yukleniyor, setYukleniyor] = useState(true);
  const [tazeleniyor, setTazeleniyor] = useState(false);
  const [siliniyor, setSiliniyor] = useState<string | null>(null);

  const tazele = useCallback(async () => {
    const satirlar = await loadMyListings();
    setListe(satirlar);
    /* Kapak kareleri özel kovada; imzalı bağlantı üretilemezse kart
       fotoğrafsız çizilir. Paketli bir demo görsele düşmek, kullanıcıya
       başka bir ürünün fotoğrafını kendi ilanı diye göstermek olurdu. */
    const yollar = satirlar
      .map((s) => s.imageKey)
      .filter((k): k is string => Boolean(k && k.includes('/')));
    setKapaklar(yollar.length ? await imzaliBaglantilar('listing-photos', yollar) : {});
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    tazele();
  }, [tazele]);

  function sil(l: MyListing) {
    uyar(
      'İlanı kaldır',
      `“${l.title}” vitrinden kaldırılacak. İlan bir daha görünmez ve bu geri alınamaz.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Kaldır',
          style: 'destructive',
          onPress: async () => {
            setSiliniyor(l.id);
            const sonuc = await deleteListing(l.id);
            setSiliniyor(null);
            if (!sonuc.ok) {
              uyar('Kaldırılamadı', sonuc.message);
              return;
            }
            await tazele();
          },
        },
      ],
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>İlanlarım</Text>
      </View>

      {yukleniyor ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={
            <RefreshControl
              refreshing={tazeleniyor}
              onRefresh={async () => {
                setTazeleniyor(true);
                await tazele();
                setTazeleniyor(false);
              }}
              tintColor={colors.primary}
            />
          }
        >
          {liste.length === 0 ? (
            <BosDurum
              ikon="storefront"
              baslik="Yayında ilanın yok"
              metin="Yayına aldığın ilanlar burada listelenir."
              cta="Yeni ilan oluştur"
              onCta={() => router.replace('/add-listing')}
            />
          ) : (
            liste.map((l) => {
              const kapak = l.imageKey ? kapaklar[l.imageKey] : undefined;
              const d = durum(l.status);
              return (
                <Pressable
                  key={l.id}
                  style={[styles.card, siliniyor === l.id && styles.cardOff]}
                  disabled={siliniyor === l.id}
                  onPress={() => router.push(`/product/${l.id}`)}
                >
                  <View style={styles.kare}>
                    {kapak ? (
                      <Image source={{ uri: kapak }} style={styles.kareImg} resizeMode="cover" />
                    ) : (
                      <MaterialIcons name="image" size={20} color={colors.outline} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={1}>
                      {l.title}
                    </Text>
                    <Text style={styles.sub}>{binlik(l.points)} Takas Puanı</Text>
                    <View style={[styles.rozet, { backgroundColor: d.zemin }]}>
                      <Text style={[styles.rozetText, { color: d.yazi }]}>{d.metin}</Text>
                    </View>
                  </View>
                  {/* Satılmış ilanda kaldırma düğmesi hiç çizilmiyor: sunucu
                      zaten reddediyor ve basılabilen ama hep hata veren bir
                      düğme, olmayan düğmeden kötü. */}
                  {l.status !== 'SOLD' && (
                    <Pressable
                      onPress={() => sil(l)}
                      hitSlop={10}
                      style={styles.silBtn}
                      disabled={siliniyor === l.id}
                      accessibilityLabel={`${l.title} ilanını kaldır`}
                    >
                      {siliniyor === l.id ? (
                        <ActivityIndicator size="small" color={colors.error} />
                      ) : (
                        <MaterialIcons name="delete-outline" size={19} color={colors.error} />
                      )}
                    </Pressable>
                  )}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

/**
 * Durum rozeti.
 *
 * `RESERVED` ile `SOLD` ayrı gösteriliyor çünkü kullanıcı için farklı şeyler:
 * biri "puan havuzda, kargoyu bekliyorum", öteki "bitti". İkisine birden
 * "takasta" demek, satıcının hâlâ yapması gereken bir iş olduğunu gizlerdi.
 */
function durum(s: MyListing['status']): { metin: string; zemin: string; yazi: string } {
  if (s === 'RESERVED') {
    return { metin: 'Takas sürüyor', zemin: colors.tertiaryContainer, yazi: colors.onTertiaryContainer };
  }
  if (s === 'SOLD') {
    return { metin: 'Takas tamamlandı', zemin: colors.surfaceContainerHigh, yazi: colors.onSurfaceVariant };
  }
  return { metin: 'Yayında', zemin: colors.primaryContainer, yazi: colors.primary };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.surface,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: colors.onSurface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 18, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: shape.lg,
    backgroundColor: colors.surfaceContainerLowest,
    ...elevation.level1,
  },
  cardOff: { opacity: 0.5 },
  kare: {
    width: 52,
    height: 52,
    borderRadius: shape.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHighest,
  },
  kareImg: { width: '100%', height: '100%' },
  title: { fontSize: 14, fontWeight: '800', color: colors.onSurface },
  sub: { fontSize: 11.5, fontWeight: '600', color: colors.primary, marginTop: 2 },
  rozet: {
    alignSelf: 'flex-start',
    height: 20,
    paddingHorizontal: 8,
    borderRadius: shape.full,
    justifyContent: 'center',
    marginTop: 6,
  },
  rozetText: { fontSize: 10, fontWeight: '800' },
  silBtn: {
    width: 36,
    height: 36,
    borderRadius: shape.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorContainer,
  },
});
