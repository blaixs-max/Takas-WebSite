import { useEffect, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWallet } from '../hooks/useWallet';
import { loadProfileStats } from '../lib/profile';
import { WalletTx } from '../lib/wallet';
import { Mark } from '../components/brand/Mark';
import { BRAND } from '../lib/brand';
import { colors, elevation, shape } from '../theme/tokens';

const QUICK = [
  { icon: 'add-a-photo', label: 'Ürün ekle', href: '/add-listing' },
  { icon: 'shopping-cart', label: 'Sepetim', href: '/cart' },
  { icon: 'card-giftcard', label: 'Davet et', href: null },
] as const;

/** Binlik ayraçlı sayı (Hermes'te Intl'e bağımlı olmadan). */
const nf = {
  format: (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
};

export default function WalletScreen() {
  const [trustSkor, setTrustSkor] = useState<number | null>(null);
  useEffect(() => {
    let iptal = false;
    loadProfileStats().then((st) => {
      if (!iptal) setTrustSkor(st?.trustSkor ?? null);
    });
    return () => {
      iptal = true;
    };
  }, []);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, loading, refreshing, refresh } = useWallet();
  const { balance, entries, source } = data;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.appTitle}>Cüzdan</Text>
        {source === 'demo' && (
          <View style={styles.demoChip}>
            <MaterialIcons name="science" size={13} color={colors.onTertiaryContainer} />
            <Text style={styles.demoText}>Demo</Text>
          </View>
        )}
        {/* Başlıktaki "geçmiş" ve "daha fazla" simgeleri kalktı. İkisi de
            `View`di — dokunmaya cevap vermeyen, çizilmiş resimler. Arkalarında
            ne ayrı bir geçmiş ekranı vardı ne de bir menü. */}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* Bakiye kartı */}
        <LinearGradient colors={colors.balanceGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balance}>
          <View style={styles.balTop}>
            {/* Doygun turkuaz gradyanın üstünde çok renkli kelime logosu
                çakışıyor; kart tek renk beyaz işaret + ad taşıyor. */}
            <View style={styles.brand}>
              <Mark size={18} color="#fff" />
              <Text style={styles.brandText}>{BRAND}</Text>
            </View>
            <MaterialIcons name="visibility" size={20} color="rgba(255,255,255,0.7)" />
          </View>
          <Text style={styles.balLabel}>Kullanılabilir Takas Puanı</Text>
          {loading ? (
            <ActivityIndicator color="#fff" style={{ alignSelf: 'flex-start', marginVertical: 14 }} />
          ) : (
            <Text style={styles.balAmt}>{nf.format(balance.available)}</Text>
          )}
          <View style={styles.balSub}>
            <SubStat label="Güvenli Havuz’da" value={nf.format(balance.held)} />
            <SubStat label="Bu ay kazanılan" value={`+${nf.format(balance.earnedThisMonth)}`} />
            {/* Skor yoksa em dash. Uydurma bir 96, uydurma bir 100 kadar yanlış. */}
            <SubStat label="Güven skoru" value={trustSkor === null ? '—' : String(trustSkor)} />
          </View>
        </LinearGradient>

        {/* Hızlı işlemler */}
        <View style={styles.quick}>
          {QUICK.map((q) => (
            <Pressable key={q.label} style={styles.quickBtn} onPress={() => q.href && router.push(q.href)}>
              <View style={styles.quickIc}>
                <MaterialIcons name={q.icon} size={19} color={colors.primary} />
              </View>
              <Text style={styles.quickLabel}>{q.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* "Tümü" kalktı: liste zaten son 50 hareketin hepsini çiziyor
            (`lib/wallet.ts`, `.limit(50)`) ve ayrı bir geçmiş ekranı yok.
            Elli hareketi geçen bir hesap çıkarsa sayfalama gerçek bir iş
            olarak eklenir. */}
        <View style={styles.sec}>
          <Text style={styles.secTitle}>Son hareketler</Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : entries.length === 0 ? (
          <BosDurum
            ikon="receipt-long"
            baslik="Henüz cüzdan hareketin yok"
            metin="İlk takasını tamamladığında hareketlerin burada görünür."
          />
        ) : (
          entries.map((t, i) => (
            <View key={t.id}>
              <Row tx={t} />
              {i < entries.length - 1 && <View style={styles.divider} />}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Row({ tx }: { tx: WalletTx }) {
  return (
    <View style={styles.litem}>
      <View style={[styles.lic, tx.tone === 'pool' && styles.licPool]}>
        <MaterialIcons
          name={tx.icon}
          size={22}
          color={tx.tone === 'pool' ? colors.onTertiaryContainer : colors.onSurfaceVariant}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.lt}>{tx.title}</Text>
        <View style={styles.lsRow}>
          <MaterialIcons name={tx.subIcon} size={13} color={colors.onSurfaceVariant} />
          <Text style={styles.ls} numberOfLines={1}>
            {tx.sub}
          </Text>
        </View>
      </View>
      <Text
        style={[
          styles.lv,
          tx.tone === 'pos' && styles.lvPos,
          tx.tone === 'pool' && styles.lvPool,
          tx.tone === 'neutral' && styles.lvNeutral,
        ]}
      >
        {tx.value}
      </Text>
    </View>
  );
}

function SubStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.subStat}>
      <Text style={styles.subLabel}>{label}</Text>
      <Text style={styles.subVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 6 },
  appTitle: { flex: 1, fontSize: 15, fontWeight: '800', paddingLeft: 10, color: colors.onSurface },
  demoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: shape.full,
    backgroundColor: colors.tertiaryContainer,
    marginRight: 4,
  },
  demoText: { fontSize: 11, fontWeight: '700', color: colors.onTertiaryContainer },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  balance: { borderRadius: shape.lg, padding: 18, marginBottom: 16, ...elevation.level2, overflow: 'hidden' },
  balTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },
  balLabel: { color: 'rgba(255,255,255,0.82)', fontWeight: '500', fontSize: 12, marginTop: 14 },
  balAmt: { color: '#fff', fontSize: 37, fontWeight: '800', letterSpacing: -1, marginTop: 2 },
  balSub: { flexDirection: 'row', gap: 10, marginTop: 18 },
  subStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: shape.sm, paddingVertical: 10, paddingHorizontal: 12 },
  subLabel: { color: 'rgba(255,255,255,0.82)', fontSize: 10, fontWeight: '600' },
  subVal: { color: '#fff', fontSize: 15, fontWeight: '800', marginTop: 3 },
  quick: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 9,
    paddingVertical: 14,
    borderRadius: shape.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  quickIc: {
    width: 44,
    height: 44,
    borderRadius: shape.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { fontWeight: '800', fontSize: 11.5, color: colors.onSurface },
  sec: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, marginTop: 2 },
  secTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  secLink: { fontSize: 13, fontWeight: '700', color: colors.primary },
  center: { paddingVertical: 28, alignItems: 'center' },
  litem: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13 },
  lic: {
    width: 46,
    height: 46,
    borderRadius: shape.md,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  licPool: { backgroundColor: colors.tertiaryContainer },
  lt: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  lsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  ls: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500', flex: 1 },
  lv: { fontWeight: '800', fontSize: 15, color: colors.onSurface },
  lvPos: { color: colors.primary },
  lvPool: { color: colors.tertiary },
  lvNeutral: { color: colors.onSurfaceVariant },
  divider: { height: 1, backgroundColor: colors.outlineVariant, opacity: 0.55 },
});
