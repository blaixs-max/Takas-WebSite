import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
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
  value: string;
  tone: 'pos' | 'pool';
  img?: any;
  icon?: keyof typeof MaterialIcons.glyphMap;
};

const TX: Tx[] = [
  {
    title: 'Renk ayırma oyunu eklendi',
    sub: '21 Haz · AI onaylı',
    value: '+260',
    tone: 'pos',
    img: require('../../assets/products/product-color-sorter.jpg'),
  },
  {
    title: 'Halka kulesi · havuzda',
    sub: 'Teslim onayı bekliyor',
    value: '−340',
    tone: 'pool',
    icon: 'lock',
  },
  {
    title: 'Ahşap blok takası tamamlandı',
    sub: '18 Haz · güven +2',
    value: '+420',
    tone: 'pos',
    img: require('../../assets/products/product-wooden-blocks.jpg'),
  },
  {
    title: 'Davet bonusu',
    sub: '15 Haz · arkadaş katıldı',
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

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Bakiye kartı */}
        <View style={styles.balance}>
          <Text style={styles.balanceLabel}>Kullanılabilir Takas Puanı</Text>
          <Text style={styles.balanceAmt}>1.260</Text>
          <View style={styles.balanceSub}>
            <View>
              <Text style={styles.subLabel}>Havuzda</Text>
              <Text style={styles.subVal}>360</Text>
            </View>
            <View>
              <Text style={styles.subLabel}>Bu ay kazanılan</Text>
              <Text style={styles.subVal}>+540</Text>
            </View>
            <View>
              <Text style={styles.subLabel}>Güven skoru</Text>
              <Text style={styles.subVal}>96</Text>
            </View>
          </View>
        </View>

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

        <Text style={styles.section}>Son hareketler</Text>
        {TX.map((t, i) => (
          <View key={i}>
            <View style={styles.litem}>
              <View style={styles.lic}>
                {t.img ? (
                  <Image source={t.img} style={styles.licImg} />
                ) : (
                  <MaterialIcons name={t.icon!} size={22} color={colors.onSurfaceVariant} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lt}>{t.title}</Text>
                <Text style={styles.ls}>{t.sub}</Text>
              </View>
              <Text style={[styles.lv, t.tone === 'pool' ? styles.lvPool : styles.lvPos]}>{t.value}</Text>
            </View>
            {i < TX.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', height: 60, paddingHorizontal: 6 },
  appTitle: { flex: 1, fontSize: 22, fontWeight: '700', paddingLeft: 10, color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  balance: {
    backgroundColor: colors.primary,
    borderRadius: shape.lg,
    padding: 22,
    marginBottom: 18,
    ...elevation.level2,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.78)', fontWeight: '600', fontSize: 13 },
  balanceAmt: { color: '#fff', fontSize: 44, fontWeight: '900', letterSpacing: -1, marginVertical: 2 },
  balanceSub: { flexDirection: 'row', gap: 20, marginTop: 14 },
  subLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '600' },
  subVal: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 2 },
  quick: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: shape.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
  },
  quickIc: {
    width: 42,
    height: 42,
    borderRadius: shape.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { fontWeight: '600', fontSize: 12, color: colors.onSurface },
  section: { fontSize: 15, fontWeight: '700', marginVertical: 12, color: colors.onSurface },
  litem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  lic: {
    width: 44,
    height: 44,
    borderRadius: shape.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  licImg: { width: '100%', height: '100%' },
  lt: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  ls: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500', marginTop: 2 },
  lv: { fontWeight: '800', fontSize: 15 },
  lvPos: { color: colors.primary },
  lvPool: { color: colors.tertiary },
  divider: { height: 1, backgroundColor: colors.outlineVariant, opacity: 0.5 },
});
