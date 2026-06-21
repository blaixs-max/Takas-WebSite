import { ScrollView, StyleSheet, Text, View, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, elevation, shape } from '../../theme/tokens';

type StepState = 'done' | 'active' | 'todo';
const STEPS: { state: StepState; title: string; desc: string; status?: string; icon?: keyof typeof MaterialIcons.glyphMap }[] = [
  { state: 'done', title: 'Alıcı puanı havuza alındı', desc: '340 puan güvenli havuzda kilitlendi.', status: 'Tamamlandı', icon: 'check-circle' },
  { state: 'done', title: 'Paketleme kanıtı yüklendi', desc: 'Satıcı kargo öncesi fotoğraf ve barkodu ekledi.', status: 'Tamamlandı', icon: 'check-circle' },
  { state: 'active', title: 'Kargoda', desc: 'Ürün yolda. Teslimat tahmini: 2 gün içinde.', status: 'Devam ediyor', icon: 'local-shipping' },
  { state: 'todo', title: 'Teslim onayı · puan aktarımı', desc: '48 saat içinde sorun bildirilmezse puan satıcıya geçer.' },
];

export default function TradesScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Text style={styles.appTitle}>Takas durumu</Text>
        <View style={styles.iconBtn}>
          <MaterialIcons name="help-outline" size={24} color={colors.onSurface} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.summary}>
          <View style={styles.summaryImg}>
            <Image source={require('../../assets/products/product-montessori-rings.jpg')} style={{ width: '100%', height: '100%' }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryTitle}>Montessori halka kulesi</Text>
            <Text style={styles.summarySub}>Elif T. ile takas · 340 puan</Text>
          </View>
          <View style={styles.poolPill}>
            <MaterialIcons name="lock" size={14} color={colors.onPrimaryContainer} />
            <Text style={styles.poolPillText}>Havuzda</Text>
          </View>
        </View>

        {STEPS.map((s, i) => (
          <View key={i} style={styles.step}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  s.state === 'done' && styles.dotDone,
                  s.state === 'active' && styles.dotActive,
                  s.state === 'todo' && styles.dotTodo,
                ]}
              >
                {s.state === 'done' ? (
                  <MaterialIcons name="check" size={18} color="#fff" />
                ) : (
                  <Text style={[styles.dotNum, s.state === 'active' && { color: colors.onPrimaryContainer }]}>{i + 1}</Text>
                )}
              </View>
              {i < STEPS.length - 1 && <View style={[styles.line, s.state === 'done' && styles.lineDone]} />}
            </View>
            <View style={styles.sc}>
              <Text style={styles.scTitle}>{s.title}</Text>
              <Text style={styles.scDesc}>{s.desc}</Text>
              {s.status && (
                <View
                  style={[
                    styles.statusPill,
                    s.state === 'done' ? styles.statusDone : styles.statusActive,
                  ]}
                >
                  <MaterialIcons name={s.icon!} size={14} color={s.state === 'done' ? colors.onPrimaryContainer : colors.onTertiaryContainer} />
                  <Text style={[styles.statusText, { color: s.state === 'done' ? colors.onPrimaryContainer : colors.onTertiaryContainer }]}>{s.status}</Text>
                </View>
              )}
            </View>
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
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: shape.md,
    backgroundColor: colors.surfaceContainerLow,
    marginBottom: 18,
    ...elevation.level1,
  },
  summaryImg: { width: 56, height: 56, borderRadius: shape.sm, overflow: 'hidden' },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  summarySub: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500', marginTop: 2 },
  poolPill: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 10, borderRadius: shape.xs, backgroundColor: colors.primaryContainer },
  poolPillText: { fontSize: 12, fontWeight: '700', color: colors.onPrimaryContainer },
  step: { flexDirection: 'row', gap: 14 },
  rail: { alignItems: 'center', width: 36 },
  dot: { width: 36, height: 36, borderRadius: shape.full, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: colors.primary },
  dotActive: { backgroundColor: colors.primaryContainer, borderWidth: 2, borderColor: colors.primary },
  dotTodo: { backgroundColor: colors.surfaceContainerHigh },
  dotNum: { fontWeight: '700', fontSize: 14, color: colors.onSurfaceVariant },
  line: { flex: 1, width: 2, backgroundColor: colors.outlineVariant, marginVertical: 2 },
  lineDone: { backgroundColor: colors.primary },
  sc: { flex: 1, paddingBottom: 18 },
  scTitle: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  scDesc: { fontSize: 13, color: colors.onSurfaceVariant, lineHeight: 18, fontWeight: '500', marginTop: 4 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', height: 26, paddingHorizontal: 10, borderRadius: shape.full, marginTop: 8 },
  statusDone: { backgroundColor: colors.primaryContainer },
  statusActive: { backgroundColor: colors.tertiaryContainer },
  statusText: { fontSize: 11, fontWeight: '700' },
});
