import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  TradeRow,
  TradeStatus,
  confirmDelivery,
  loadMyTrades,
  openDispute,
} from '../lib/trades';
import { supabaseConfigured } from '../lib/supabase';
import { colors, elevation, shape } from '../theme/tokens';

/**
 * Takaslarım — canlı `trades` tablosundan.
 *
 * Ekranın iki işi var: puanın nerede olduğunu göstermek ve alıcıya iki
 * aksiyonu vermek — teslim onayı ve itiraz. Onay puanı satıcıya geçirir,
 * itiraz 48 saatlik sayacı durdurur. İkisi de sunucudaki RPC'ye gider;
 * burada hiçbir durum değişikliği hesaplanmaz.
 */

interface DurumBilgi {
  etiket: string;
  aciklama: string;
  ikon: keyof typeof MaterialIcons.glyphMap;
  ton: 'bekliyor' | 'yolda' | 'iyi' | 'dikkat';
}

const DURUM: Record<TradeStatus, DurumBilgi> = {
  CREATED: {
    etiket: 'Başlatıldı',
    aciklama: 'Takas açıldı, puan havuza alınıyor.',
    ikon: 'hourglass-empty',
    ton: 'bekliyor',
  },
  POINTS_HELD: {
    etiket: 'Puan havuzda',
    aciklama: 'Kargo bedelini ödeyince satıcıya gönderim bildirilir.',
    ikon: 'lock',
    ton: 'bekliyor',
  },
  SHIPPED: {
    etiket: 'Kargoda',
    aciklama: 'Ürün yolda. Elinize ulaşınca teslim onayı verin.',
    ikon: 'local-shipping',
    ton: 'yolda',
  },
  DELIVERED: {
    etiket: 'Teslim edildi',
    aciklama: '48 saat içinde onaylamazsanız puan satıcıya otomatik geçer.',
    ikon: 'inventory',
    ton: 'yolda',
  },
  COMPLETED: {
    etiket: 'Tamamlandı',
    aciklama: 'Puan satıcıya geçti.',
    ikon: 'check-circle',
    ton: 'iyi',
  },
  DISPUTED: {
    etiket: 'İtiraz açık',
    aciklama: 'Sayaç durdu. Ekibimiz inceliyor.',
    ikon: 'gavel',
    ton: 'dikkat',
  },
  REFUNDED: {
    etiket: 'İade edildi',
    aciklama: 'Puan hesabınıza geri döndü.',
    ikon: 'undo',
    ton: 'dikkat',
  },
};

/** Kalan süreyi Hermes'te Intl'e güvenmeden yazar. */
function kalanSure(deadline: string | null): string | null {
  if (!deadline) return null;
  const fark = new Date(deadline).getTime() - Date.now();
  if (fark <= 0) return 'süre doldu';
  const saat = Math.floor(fark / 3_600_000);
  if (saat >= 24) {
    const gun = Math.floor(saat / 24);
    return `${gun} gün ${saat % 24} saat kaldı`;
  }
  if (saat >= 1) return `${saat} saat kaldı`;
  return `${Math.max(1, Math.floor(fark / 60_000))} dakika kaldı`;
}

export default function TradesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [takaslar, setTakaslar] = useState<TradeRow[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [islemde, setIslemde] = useState<string | null>(null);
  const [itiraz, setItiraz] = useState<TradeRow | null>(null);
  const [gerekce, setGerekce] = useState('');

  const getir = useCallback(async () => {
    const liste = await loadMyTrades();
    setTakaslar(liste);
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    getir();
  }, [getir]);

  async function onayla(t: TradeRow) {
    Alert.alert(
      'Teslim aldınız mı?',
      `${t.points} puan satıcıya geçecek. Onayladıktan sonra itiraz edemezsiniz.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Teslim aldım',
          style: 'default',
          onPress: async () => {
            setIslemde(t.id);
            const s = await confirmDelivery(t.id);
            setIslemde(null);
            if (!s.ok) Alert.alert('Onaylanamadı', s.message);
            await getir();
          },
        },
      ],
    );
  }

  async function itirazGonder() {
    if (!itiraz) return;
    const hedef = itiraz;
    setIslemde(hedef.id);
    const s = await openDispute(hedef.id, gerekce);
    setIslemde(null);
    if (!s.ok) {
      Alert.alert('İtiraz açılamadı', s.message);
      return;
    }
    setItiraz(null);
    setGerekce('');
    await getir();
  }

  const bos = !yukleniyor && takaslar.length === 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.appTitle}>Takaslarım</Text>
        <Pressable style={styles.iconBtn} onPress={() => router.push('/help')}>
          <MaterialIcons name="help-outline" size={24} color={colors.onSurface} />
        </Pressable>
      </View>

      {yukleniyor ? (
        <View style={styles.orta}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
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
          {bos && (
            <View style={styles.bos}>
              <MaterialIcons name="swap-horiz" size={44} color={colors.outline} />
              <Text style={styles.bosBaslik}>Henüz takasınız yok</Text>
              <Text style={styles.bosMetin}>
                {supabaseConfigured
                  ? 'Beğendiğiniz bir ürünü takas ettiğinizde durumu burada takip edersiniz.'
                  : 'Sunucu bağlantısı yok; takaslar görüntülenemiyor.'}
              </Text>
            </View>
          )}

          {takaslar.map((t) => {
            const d = DURUM[t.status];
            const sure = kalanSure(t.deadlineAt);
            const onaylanabilir =
              t.benAliciyim && (t.status === 'SHIPPED' || t.status === 'DELIVERED');
            const itirazEdilebilir = onaylanabilir;

            return (
              <View key={t.id} style={styles.kart}>
                <View style={styles.kartUst}>
                  <View style={[styles.rozet, styles[`ton_${d.ton}`]]}>
                    <MaterialIcons name={d.ikon} size={15} color={colors.onSurface} />
                    <Text style={styles.rozetText}>{d.etiket}</Text>
                  </View>
                  <Text style={styles.puan}>{t.points} puan</Text>
                </View>

                <Text style={styles.baslik}>{t.productTitle ?? 'İlan kaldırılmış'}</Text>
                <Text style={styles.rol}>
                  {t.benAliciyim ? 'Alıyorsunuz' : 'Satıyorsunuz'}
                </Text>
                <Text style={styles.aciklama}>{d.aciklama}</Text>

                {t.status === 'DISPUTED' && t.disputeReason && (
                  <Text style={styles.gerekce}>Gerekçeniz: {t.disputeReason}</Text>
                )}

                {sure && (
                  <View style={styles.sayac}>
                    <MaterialIcons name="schedule" size={14} color={colors.onSurfaceVariant} />
                    <Text style={styles.sayacText}>{sure}</Text>
                  </View>
                )}

                {onaylanabilir && (
                  <View style={styles.aksiyonlar}>
                    <Pressable
                      style={styles.birincil}
                      disabled={islemde === t.id}
                      onPress={() => onayla(t)}
                    >
                      {islemde === t.id ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <MaterialIcons name="check" size={18} color="#fff" />
                          <Text style={styles.birincilText}>Teslim aldım</Text>
                        </>
                      )}
                    </Pressable>
                    {itirazEdilebilir && (
                      <Pressable
                        style={styles.ikincil}
                        disabled={islemde === t.id}
                        onPress={() => {
                          setGerekce('');
                          setItiraz(t);
                        }}
                      >
                        <Text style={styles.ikincilText}>Sorun var</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* İtiraz gerekçesi — sunucu boş gerekçeyi reddediyor, burada da soruyoruz */}
      <Modal
        visible={itiraz !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setItiraz(null)}
      >
        <Pressable style={styles.perde} onPress={() => setItiraz(null)}>
          <Pressable
            style={styles.sheet}
            onPress={(e) => e.stopPropagation()}
            accessibilityViewIsModal
          >
            <Text style={styles.sheetBaslik}>Neyi bildirmek istiyorsunuz?</Text>
            <Text style={styles.sheetMetin}>
              İtiraz açınca 48 saatlik sayaç durur ve puanınız havuzda kalır. Ekibimiz
              kanıtları inceleyip karar verir.
            </Text>
            <TextInput
              style={styles.giris}
              placeholder="Örn. üründe ilanda görünmeyen bir kırık var"
              placeholderTextColor={colors.onSurfaceVariant}
              value={gerekce}
              onChangeText={setGerekce}
              multiline
            />
            <View style={styles.sheetButonlar}>
              <Pressable style={styles.ikincil} onPress={() => setItiraz(null)}>
                <Text style={styles.ikincilText}>Vazgeç</Text>
              </Pressable>
              <Pressable
                style={[styles.birincil, gerekce.trim().length === 0 && styles.kapali]}
                disabled={gerekce.trim().length === 0 || islemde !== null}
                onPress={itirazGonder}
              >
                <Text style={styles.birincilText}>İtirazı gönder</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 6 },
  appTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  orta: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bos: { alignItems: 'center', gap: 8, paddingTop: 80, paddingHorizontal: 30 },
  bosBaslik: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  bosMetin: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 19,
  },
  kart: {
    padding: 15,
    borderRadius: shape.md,
    backgroundColor: colors.surfaceContainerLow,
    marginBottom: 14,
    ...elevation.level1,
  },
  kartUst: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rozet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 28,
    paddingHorizontal: 11,
    borderRadius: shape.full,
  },
  ton_bekliyor: { backgroundColor: colors.surfaceContainerHighest },
  ton_yolda: { backgroundColor: colors.tertiaryContainer },
  ton_iyi: { backgroundColor: colors.primaryContainer },
  ton_dikkat: { backgroundColor: colors.errorContainer },
  rozetText: { fontSize: 12, fontWeight: '700', color: colors.onSurface },
  puan: { fontSize: 14, fontWeight: '800', color: colors.primary },
  baslik: { fontSize: 15, fontWeight: '700', color: colors.onSurface, marginTop: 11 },
  rol: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant, marginTop: 2 },
  aciklama: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 7,
  },
  gerekce: { fontSize: 12.5, color: colors.onSurface, fontWeight: '600', marginTop: 7 },
  sayac: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 9 },
  sayacText: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant },
  aksiyonlar: { flexDirection: 'row', gap: 10, marginTop: 14 },
  birincil: {
    flex: 1,
    height: 46,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  birincilText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  ikincil: {
    flex: 1,
    height: 46,
    borderRadius: shape.full,
    borderWidth: 1.5,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ikincilText: { color: colors.onSurface, fontWeight: '700', fontSize: 14 },
  kapali: { opacity: 0.45 },
  perde: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surfaceContainer,
    borderTopLeftRadius: shape.lg,
    borderTopRightRadius: shape.lg,
    padding: 20,
    paddingBottom: 34,
    gap: 10,
  },
  sheetBaslik: { fontSize: 17, fontWeight: '800', color: colors.onSurface },
  sheetMetin: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
    lineHeight: 19,
  },
  giris: {
    minHeight: 88,
    borderRadius: shape.sm,
    backgroundColor: colors.surfaceContainerHigh,
    padding: 13,
    fontSize: 14,
    color: colors.onSurface,
    textAlignVertical: 'top',
    marginTop: 4,
  },
  sheetButonlar: { flexDirection: 'row', gap: 10, marginTop: 6 },
});
