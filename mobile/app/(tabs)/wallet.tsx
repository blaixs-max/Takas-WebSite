import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWallet } from '../../hooks/useWallet';
import { WalletTx } from '../../lib/wallet';
import { colors, elevation, shape } from '../../theme/tokens';

const QUICK = [
  { icon: 'add-a-photo', label: 'Puan kazan' },
  { icon: 'swap-horiz', label: 'Takas yap' },
  { icon: 'card-giftcard', label: 'Davet et' },
] as const;

/** Binlik ayraçlı sayı (Hermes'te Intl'e bağımlı olmadan). */
const nf = {
  format: (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
};

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { data, loading, refreshing, refresh } = useWallet();
  const { balance, entries, source } = data;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Text style={styles.appTitle}>Cüzdan</Text>
        {source === 'demo' && (
          <View style={styles.demoChip}>
            <MaterialIcons name="science" size={13} color={colors.onTertiaryContainer} />
            <Text style={styles.demoText}>Demo</Text>
          </View>
        )}
        <View style={styles.iconBtn}>
          <MaterialIcons name="history" size={24} color={colors.onSurface} />
        </View>
        <View style={styles.iconBtn}>
          <MaterialIcons name="more-vert" size={24} color={colors.onSurface} />
        </View>
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
            <View style={styles.brand}>
              <MaterialIcons name="change-circle" size={18} color="#fff" />
              <Text style={styles.brandText}>KIDS TRADE</Text>
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
            <SubStat label="Havuzda" value={nf.format(balance.held)} />
            <SubStat label="Bu ay kazanılan" value={`+${nf.format(balance.earnedThisMonth)}`} />
            <SubStat label="Güven skoru" value={String(balance.trustScore)} />
          </View>
        </LinearGradient>

        {/* Hızlı işlemler */}
        <View style={styles.quick}>
          {QUICK.map((q) => (
            <View key={q.label} style={styles.quickBtn}>
              <View style={styles.quickIc}>
                <MaterialIcons name={q.icon} size={22} color={colors.onPrimaryContainer} />
              </View>
              <Text style={styles.quickLabel}>{q.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sec}>
          <Text style={styles.secTitle}>Son hareketler</Text>
          <Text style={styles.secLink}>Tümü</Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : entries.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="receipt-long" size={32} color={colors.onSurfaceVariant} />
            <Text style={styles.emptyText}>Henüz hareket yok</Text>
          </View>
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
  appTitle: { flex: 1, fontSize: 22, fontWeight: '700', paddingLeft: 10, color: colors.onSurface },
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
  balance: { borderRadius: shape.xl, padding: 22, marginBottom: 16, ...elevation.level2, overflow: 'hidden' },
  balTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },
  balLabel: { color: 'rgba(255,255,255,0.78)', fontWeight: '500', fontSize: 13, marginTop: 16 },
  balAmt: { color: '#fff', fontSize: 46, fontWeight: '900', letterSpacing: -1.5, marginTop: 2 },
  balSub: { flexDirection: 'row', gap: 10, marginTop: 18 },
  subStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: shape.sm, paddingVertical: 10, paddingHorizontal: 12 },
  subLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '500' },
  subVal: { color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 3 },
  quick: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 9,
    paddingVertical: 14,
    borderRadius: shape.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
  },
  quickIc: {
    width: 44,
    height: 44,
    borderRadius: shape.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { fontWeight: '600', fontSize: 12, color: colors.onSurface },
  sec: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, marginTop: 2 },
  secTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  secLink: { fontSize: 13, fontWeight: '700', color: colors.primary },
  center: { paddingVertical: 28, alignItems: 'center' },
  empty: { paddingVertical: 32, alignItems: 'center', gap: 8 },
  emptyText: { color: colors.onSurfaceVariant, fontSize: 13, fontWeight: '600' },
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
