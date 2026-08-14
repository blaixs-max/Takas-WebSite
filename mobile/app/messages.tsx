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
import { BosDurum } from '../components/BosDurum';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConversationRow, loadConversations } from '../lib/messages';
import { gecenSure } from '../lib/notifications';
import { supabaseConfigured } from '../lib/supabase';
import { colors, shape } from '../theme/tokens';

/** Mesajlarım — canlı sohbet listesi. */
export default function Messages() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [liste, setListe] = useState<ConversationRow[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);

  const getir = useCallback(async () => {
    setListe(await loadConversations());
    setYukleniyor(false);
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
        <Text style={styles.appTitle}>Mesajlarım</Text>
        <View style={styles.iconBtn} />
      </View>

      {yukleniyor ? (
        <View style={styles.orta}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
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
            /* Rehber 15'in uygulama notu: "Sunucu bağlantısı yok" boş
               durumdan kaldırılır. Bağlantı yoksa bu bir boş kutu değil bir
               hata — kullanıcıya "hiç mesajın yok" demek yanlış bilgi. */
            supabaseConfigured ? (
              <BosDurum
                ikon="forum"
                baslik="Henüz mesajın yok"
                metin="Bir ürün hakkında mesaj gönderdiğinde sohbetlerin burada görünür."
                cta="Ürünleri keşfet"
                onCta={() => router.replace('/(tabs)')}
              />
            ) : (
              <BosDurum
                ikon="cloud-off"
                baslik="Mesajlar yüklenemedi"
                metin="Bağlantını kontrol edip yeniden dene."
                cta="Yeniden dene"
                onCta={getir}
              />
            )
          )}

          {liste.map((c) => (
            <Pressable
              key={c.id}
              style={styles.satir}
              onPress={() => router.push(`/chat/${c.id}`)}
            >
              <View style={styles.avatar}>
                <MaterialIcons
                  name={c.benAliciyim ? 'storefront' : 'person'}
                  size={20}
                  color={colors.onPrimaryContainer}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.ust}>
                  <Text style={styles.ad} numberOfLines={1}>
                    {c.karsiTaraf}
                  </Text>
                  {c.sonMesajAt && <Text style={styles.zaman}>{gecenSure(c.sonMesajAt)}</Text>}
                </View>
                <Text style={styles.urun} numberOfLines={1}>
                  {c.productTitle}
                </Text>
                <Text style={styles.onizleme} numberOfLines={1}>
                  {c.sonMesaj ?? 'Henüz mesaj yok'}
                </Text>
              </View>
              {c.okunmamis > 0 && (
                <View style={styles.rozet}>
                  <Text style={styles.rozetText}>{c.okunmamis > 9 ? '9+' : c.okunmamis}</Text>
                </View>
              )}
            </Pressable>
          ))}
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
    fontSize: 15,
    fontWeight: '800',
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: shape.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ust: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ad: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.onSurface },
  zaman: { fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant, marginLeft: 8 },
  urun: { fontSize: 12, fontWeight: '600', color: colors.primary, marginTop: 2 },
  onizleme: {
    fontSize: 12.5,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
    marginTop: 2,
  },
  rozet: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rozetText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
