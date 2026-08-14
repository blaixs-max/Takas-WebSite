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
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  NotificationRow,
  gecenSure,
  gorunum,
  hedef,
  loadNotifications,
  markAllRead,
} from '../lib/notifications';
import { supabaseConfigured } from '../lib/supabase';
import { colors, shape } from '../theme/tokens';

/**
 * Bildirimler — canlı kuyruktan.
 *
 * Metinleri sunucu yazıyor; burada yalnızca gösteriliyor. Kullanıcı bir
 * bildirime dokununca ilgili ekrana gidiyor, çünkü haber vermenin amacı bir
 * şey yapılmasıysa o şeyin bir tık uzakta olması gerekir.
 */
export default function Notifications() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [liste, setListe] = useState<NotificationRow[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);

  /**
   * Listeyi getirir ve **görüleni okundu sayar.**
   *
   * Okundu işaretlemenin tek yolu başlıktaki küçük `done-all` simgesiydi.
   * Kimse onu bulmuyordu: kullanıcı bildirimleri açıp okuyor, geri dönüyor ve
   * kırmızı rozet duruyordu. Rozet yanlış değildi — sunucuda gerçekten
   * okunmamışlardı — ama kullanıcının yaptığı şey okumaktı. Listeyi açmak
   * artık okumak sayılıyor.
   *
   * Yerel liste bilerek yeniden çekilmiyor: bu ziyarette hangilerinin yeni
   * olduğu vurgulu kalsın diye. Bir sonraki açılışta okunmuş görünürler.
   */
  const getir = useCallback(async () => {
    const yeni = await loadNotifications();
    setListe(yeni);
    setYukleniyor(false);
    if (yeni.some((n) => !n.okundu)) markAllRead().catch(() => {});
  }, []);

  useEffect(() => {
    getir();
  }, [getir]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.appTitle}>Bildirimler</Text>
        {/* "Tümünü okundu işaretle" düğmesi kalktı: açmak zaten okundu
            sayıyor, düğme hiçbir şey yapmayan bir düğme olurdu. */}
        <View style={styles.iconBtn} />
      </View>

      {yukleniyor ? (
        <View style={styles.orta}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={yenileniyor}
              onRefresh={async () => {
                setYenileniyor(true);
                await getir();
                setYenileniyor(false);
              }}
              tintColor={colors.primary}
            />
          }
        >
          {liste.length === 0 && (
            <View style={styles.bos}>
              <MaterialIcons name="notifications-none" size={44} color={colors.outline} />
              <Text style={styles.bosBaslik}>Bildiriminiz yok</Text>
              <Text style={styles.bosMetin}>
                {supabaseConfigured
                  ? 'Takaslarınızda bir gelişme olduğunda burada göreceksiniz.'
                  : 'Sunucu bağlantısı yok.'}
              </Text>
            </View>
          )}

          {liste.map((n) => {
            const g = gorunum(n.kind);
            const git = hedef(n);
            return (
              <Pressable
                key={n.id}
                style={[styles.satir, !n.okundu && styles.satirOkunmamis]}
                onPress={() => {
                  if (git) router.push(git as Href);
                }}
              >
                <View style={[styles.ikon, styles[`ton_${g.ton}`]]}>
                  <MaterialIcons name={g.ikon} size={20} color={colors.onSurface} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.basliksatir}>
                    <Text style={styles.baslik}>{n.title}</Text>
                    <Text style={styles.zaman}>{gecenSure(n.createdAt)}</Text>
                  </View>
                  <Text style={styles.metin}>{n.body}</Text>
                </View>
                {!n.okundu && <View style={styles.nokta} />}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  orta: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 6 },
  appTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.onSurface,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  satir: {
    flexDirection: 'row',
    gap: 12,
    padding: 13,
    borderRadius: shape.md,
    backgroundColor: colors.surfaceContainerLow,
    marginBottom: 9,
    alignItems: 'center',
  },
  satirOkunmamis: { backgroundColor: colors.surfaceContainerHigh },
  ikon: {
    width: 42,
    height: 42,
    borderRadius: shape.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ton_primary: { backgroundColor: colors.primaryContainer },
  ton_tertiary: { backgroundColor: colors.tertiaryContainer },
  ton_dikkat: { backgroundColor: colors.errorContainer },
  basliksatir: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  baslik: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.onSurface },
  zaman: { fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant, marginLeft: 8 },
  metin: {
    fontSize: 12.5,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 3,
  },
  nokta: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  bos: { alignItems: 'center', gap: 8, paddingTop: 80, paddingHorizontal: 30 },
  bosBaslik: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  bosMetin: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 19,
  },
});
