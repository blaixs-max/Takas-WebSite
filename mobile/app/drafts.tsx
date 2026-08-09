import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { DraftListing, loadDrafts } from '../lib/listings';
import { colors, elevation, shape } from '../theme/tokens';

/**
 * Yarım kalmış ilanlar.
 *
 * Bu ekran bir çıkmazı kapatıyor. Çekim akışına yalnızca ilan oluşturulduktan
 * hemen sonra giriliyordu; oradan çıkan kullanıcı taslak ilanına bir daha
 * ulaşamıyor, yayına alacak düğmeyi hiçbir yerde bulamıyordu. İlan veri
 * tabanında DRAFT olarak kalıyor, kullanıcı ise ilanını verdiğini sanıyordu.
 *
 * Her satır kaç karenin tamam olduğunu ve neyin beklendiğini söyler: eksik
 * kare mi var, inceleme mi sürüyor, yoksa bir kare reddedilip yeniden mi
 * çekilmesi gerekiyor.
 */
export default function Drafts() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [liste, setListe] = useState<DraftListing[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [tazeleniyor, setTazeleniyor] = useState(false);

  const tazele = useCallback(async () => {
    setListe(await loadDrafts());
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    tazele();
  }, [tazele]);

  function ac(d: DraftListing) {
    router.push({
      pathname: '/listing-photos',
      params: {
        id: d.id,
        hasDamage: d.hasDamage ? '1' : '0',
        isSet: d.isSet ? '1' : '0',
        title: d.title,
      },
    });
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Yarım kalan ilanlar</Text>
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
            <View style={styles.bos}>
              <MaterialIcons name="inventory-2" size={40} color={colors.outline} />
              <Text style={styles.bosText}>Yarım kalan ilanınız yok.</Text>
            </View>
          ) : (
            liste.map((d) => (
              <Pressable key={d.id} style={styles.card} onPress={() => ac(d)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{d.title}</Text>
                  <Text style={styles.sub}>{durumMetni(d)}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

/** Kullanıcıya sıradaki işi söyler — "taslak" demek tek başına bir şey anlatmaz. */
function durumMetni(d: DraftListing): string {
  if (d.reddedilenKare > 0) {
    return `${d.reddedilenKare} kare reddedildi · yeniden çekilmeli`;
  }
  if (d.cekilenKare < d.gerekenKare) {
    return `${d.cekilenKare}/${d.gerekenKare} kare çekildi`;
  }
  if (d.bekleyenKare > 0) {
    return `${d.bekleyenKare} kare incelemede`;
  }
  return 'Kareler hazır · yayına alınabilir';
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
  headerTitle: { fontSize: 20, fontWeight: '600', color: colors.onSurface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, gap: 12 },
  bos: { alignItems: 'center', gap: 12, paddingTop: 64 },
  bosText: { color: colors.onSurfaceVariant, fontSize: 15 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: shape.lg,
    backgroundColor: colors.surfaceContainer,
    ...elevation.level1,
  },
  title: { fontSize: 16, fontWeight: '600', color: colors.onSurface },
  sub: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 2 },
});
