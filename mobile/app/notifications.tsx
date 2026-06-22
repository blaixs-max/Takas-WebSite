import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shape } from '../theme/tokens';

type Notif = {
  icon: keyof typeof MaterialIcons.glyphMap;
  tone: 'primary' | 'tertiary' | 'neutral';
  title: string;
  body: string;
  time: string;
  unread?: boolean;
};

const NOTIFS: Notif[] = [
  { icon: 'swap-horiz', tone: 'primary', title: 'Takas isteği', body: 'Elif T. "Montessori halka kulesi" için takas başlattı.', time: '5 dk', unread: true },
  { icon: 'local-shipping', tone: 'tertiary', title: 'Kargoda', body: 'Ahşap blok seti yola çıktı — tahmini 2 gün.', time: '2 sa', unread: true },
  { icon: 'verified', tone: 'primary', title: 'AI onayı', body: 'Renk ayırma oyunu ilanın yayında, +260 puan.', time: '1 gün' },
  { icon: 'workspace-premium', tone: 'tertiary', title: 'Güven skoru arttı', body: 'Sorunsuz takas — güven skorun 96 oldu.', time: '2 gün' },
  { icon: 'card-giftcard', tone: 'neutral', title: 'Davet bonusu', body: 'Arkadaşın katıldı, +100 puan kazandın.', time: '5 gün' },
];

export default function Notifications() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.appTitle}>Bildirimler</Text>
        <Pressable style={styles.iconBtn}>
          <MaterialIcons name="done-all" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        {NOTIFS.map((n, i) => {
          const bg =
            n.tone === 'primary' ? colors.primaryContainer : n.tone === 'tertiary' ? colors.tertiaryContainer : colors.surfaceContainerHigh;
          const fg =
            n.tone === 'primary' ? colors.onPrimaryContainer : n.tone === 'tertiary' ? colors.onTertiaryContainer : colors.onSurfaceVariant;
          return (
            <View key={i} style={[styles.item, n.unread && styles.unread]}>
              <View style={[styles.ic, { backgroundColor: bg }]}>
                <MaterialIcons name={n.icon} size={22} color={fg} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.title}>{n.title}</Text>
                  <Text style={styles.time}>{n.time}</Text>
                </View>
                <Text style={styles.body}>{n.body}</Text>
              </View>
              {n.unread && <View style={styles.dot} />}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 6 },
  appTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', gap: 13, padding: 12, borderRadius: shape.md, alignItems: 'flex-start' },
  unread: { backgroundColor: colors.surfaceContainerLow },
  ic: { width: 44, height: 44, borderRadius: shape.full, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  time: { fontSize: 11, color: colors.onSurfaceVariant, fontWeight: '600' },
  body: { fontSize: 13, color: colors.onSurfaceVariant, fontWeight: '500', lineHeight: 18, marginTop: 3 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 },
});
