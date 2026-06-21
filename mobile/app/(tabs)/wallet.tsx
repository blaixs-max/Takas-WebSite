import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, elevation, shape } from '../../theme/tokens';

const QUICK = [
  { icon: 'add-a-photo', label: 'Puan kazan' },
  { icon: 'swap-horiz', label: 'Takas yap' },
  { icon: 'card-giftcard', label: 'Davet et' },
] as const;

type Tx = {
  title: string;
  sub: string;
  subIcon: keyof typeof MaterialIcons.glyphMap;
  value: string;
  tone: 'pos' | 'pool';
  img?: any;
  icon?: keyof typeof MaterialIcons.glyphMap;
};

const TX: Tx[] = [
  {
    title: 'Renk ayırma oyunu eklendi',
    sub: '21 Haz · AI onaylı',
    subIcon: 'verified',
    value: '+260',
    tone: 'pos',
    img: require('../../assets/products/product-color-sorter.jpg'),
  },
  {
    title: 'Halka kulesi · havuzda',
    sub: 'Teslim onayı bekliyor',
    subIcon: 'schedule',
    value: '−340',
    tone: 'pool',
    icon: 'lock',
  },
  {
    title: 'Ahşap blok takası tamamlandı',
    sub: '18 Haz · güven +2',
    subIcon: 'trending-up',
    value: '+420',
    tone: 'pos',
    img: require('../../assets/products/product-wooden-blocks.jpg'),
  },
  {
    title: 'Davet bonusu',
    sub: '15 Haz · arkadaş katıldı',
    subIcon: 'group-add',
    value: '+100',
    tone: 'pos',
    icon: 'card-giftcard',
  },
];

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Text style={styles.appTitle}>Cüzdan</Text>
        <View style={styles.iconBtn}>
          <MaterialIcons name="history" size={24} color={colors.onSurface} />
        </View>
        <View style={styles.iconBtn}>
          <MaterialIcons name="more-vert" size={24} color={colors.onSurface} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Bakiye kartı */}
        <LinearGradient
          colors={colors.balanceGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balance}
        >
          <View style={styles.balTop}>
            <View style={styles.brand}>
              <MaterialIcons name="change-circle" size={18} color="#fff" />
              <Text style={styles.brandText}>KIDS TRADE</Text>
            </View>
            <MaterialIcons name="visibility" size={20} color="rgba(255,255,255,0.7)" />
          </View>
          <Text style={styles.balLabel}>Kullanılabilir Takas Puanı</Text>
          <Text style={styles.balAmt}>1.260</Text>
          <View style={styles.balSub}>
            <SubStat label="Havuzda" value="360" />
            <SubStat label="Bu ay kazanılan" value="+540" />
            <SubStat label="Güven skoru" value="96" />
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
        {TX.map((t, i) => (
          <View key={i}>
            <View style={styles.litem}>
              <View style={[styles.lic, t.tone === 'pool' && styles.licPool]}>
                {t.img ? (
                  <Image source={t.img} style={styles.licImg} />
                ) : (
                  <MaterialIcons
                    name={t.icon!}
                    size={22}
                    color={t.tone === 'pool' ? colors.onTertiaryContainer : colors.onSurfaceVariant}
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lt}>{t.title}</Text>
                <View style={styles.lsRow}>
                  <MaterialIcons name={t.subIcon} size={13} color={colors.onSurfaceVariant} />
                  <Text style={styles.ls}>{t.sub}</Text>
                </View>
              </View>
              <Text style={[styles.lv, t.tone === 'pool' ? styles.lvPool : styles.lvPos]}>{t.value}</Text>
            </View>
            {i < TX.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </ScrollView>

      {/* Snackbar */}
      <View style={[styles.snack, { bottom: insets.bottom + 96 }]}>
        <MaterialIcons name="check-circle" size={20} color={colors.primaryContainer} />
        <Text style={styles.snackText}>360 puan havuza alındı</Text>
        <Text style={styles.snackAction}>GERİ AL</Text>
      </View>
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
  litem: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13 },
  lic: {
    width: 46,
    height: 46,
    borderRadius: shape.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  licPool: { backgroundColor: colors.tertiaryContainer },
  licImg: { width: '100%', height: '100%' },
  lt: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  lsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  ls: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500' },
  lv: { fontWeight: '800', fontSize: 15 },
  lvPos: { color: colors.primary },
  lvPool: { color: colors.tertiary },
  divider: { height: 1, backgroundColor: colors.outlineVariant, opacity: 0.55 },
  snack: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#2c322c',
    borderRadius: shape.xs,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...elevation.level3,
  },
  snackText: { color: '#edf1ea', fontSize: 13, fontWeight: '500', flex: 1 },
  snackAction: { color: '#a8f2cd', fontWeight: '800', fontSize: 13 },
});
