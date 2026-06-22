import { Pressable, Share, StyleSheet, Text, View, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, elevation, shape } from '../theme/tokens';

const CODE = 'KIDS-EMRAH';
const INVITED = [
  { name: 'Ayşe K.', status: 'Katıldı · +100 puan', done: true },
  { name: 'Mehmet T.', status: 'Davet gönderildi', done: false },
];

export default function Invite() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  async function share() {
    try {
      await Share.share({
        message: `KIDS TRADE'e katıl, çocuk ürünlerini puanla takas et! Davet kodum: ${CODE}\nhttps://kidstrade.app/davet/${CODE}`,
      });
    } catch {}
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Davet et</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.giftIc}>
            <MaterialIcons name="card-giftcard" size={32} color={colors.onPrimaryContainer} />
          </View>
          <Text style={styles.heroTitle}>Her arkadaşın +100 puan</Text>
          <Text style={styles.heroSub}>Davet ettiğin arkadaş ilk takasını yapınca ikinize de 100 Takas Puanı.</Text>
        </View>

        <Text style={styles.label}>DAVET KODUN</Text>
        <View style={styles.codeBox}>
          <Text style={styles.code}>{CODE}</Text>
          <Pressable style={styles.copyBtn}>
            <MaterialIcons name="content-copy" size={18} color={colors.primary} />
            <Text style={styles.copyText}>Kopyala</Text>
          </Pressable>
        </View>

        <Pressable style={styles.shareBtn} onPress={share}>
          <MaterialIcons name="share" size={20} color="#fff" />
          <Text style={styles.shareText}>Davet bağlantısını paylaş</Text>
        </Pressable>

        <Text style={styles.section}>Davet ettiklerin</Text>
        <View style={styles.group}>
          {INVITED.map((f, i) => (
            <View key={i}>
              <View style={styles.row}>
                <View style={styles.av}>
                  <Text style={styles.avText}>{f.name.slice(0, 1)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{f.name}</Text>
                  <Text style={styles.rowStatus}>{f.status}</Text>
                </View>
                <MaterialIcons
                  name={f.done ? 'check-circle' : 'schedule'}
                  size={22}
                  color={f.done ? colors.primary : colors.onSurfaceVariant}
                />
              </View>
              {i < INVITED.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 6 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: colors.primaryContainer, borderRadius: shape.lg, padding: 20, alignItems: 'center', gap: 8, marginBottom: 18 },
  giftIc: { width: 60, height: 60, borderRadius: shape.full, backgroundColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 19, fontWeight: '800', color: colors.onPrimaryContainer, marginTop: 4 },
  heroSub: { fontSize: 13, color: colors.onPrimaryContainer, fontWeight: '500', textAlign: 'center', lineHeight: 19 },
  label: { fontSize: 12, fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 0.4, marginBottom: 8 },
  codeBox: { flexDirection: 'row', alignItems: 'center', height: 56, paddingLeft: 18, paddingRight: 8, borderRadius: shape.sm, borderWidth: 1.5, borderColor: colors.outline, borderStyle: 'dashed', marginBottom: 12 },
  code: { flex: 1, fontSize: 20, fontWeight: '800', letterSpacing: 2, color: colors.onSurface },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 40, paddingHorizontal: 14, borderRadius: shape.full, backgroundColor: colors.surfaceContainerHigh },
  copyText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: shape.full, backgroundColor: colors.primary, ...elevation.level1 },
  shareText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  section: { fontSize: 15, fontWeight: '700', color: colors.onSurface, marginTop: 24, marginBottom: 10 },
  group: { backgroundColor: colors.surfaceContainerLow, borderRadius: shape.md, paddingHorizontal: 14, ...elevation.level1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  av: { width: 40, height: 40, borderRadius: shape.full, backgroundColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' },
  avText: { fontWeight: '800', fontSize: 15, color: colors.onSecondaryContainer },
  rowName: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  rowStatus: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500', marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.outlineVariant, opacity: 0.5 },
});
