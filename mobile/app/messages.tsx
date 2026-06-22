import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shape } from '../theme/tokens';

const THREADS = [
  { id: 'ET', name: 'Elif T.', img: require('../assets/products/product-montessori-rings.jpg'), last: 'Harika, takas başlatıyorum 🙂', time: '14:06', unread: 2 },
  { id: 'ZD', name: 'Zeynep D.', img: require('../assets/products/product-wooden-blocks.jpg'), last: 'Kargoyu yarın veriyorum.', time: 'Dün', unread: 0 },
  { id: 'MK', name: 'Murat K.', img: require('../assets/products/product-color-sorter.jpg'), last: 'Parçalar tam mı?', time: 'Pzt', unread: 0 },
];

export default function Messages() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Mesajlarım</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={{ paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
        {THREADS.map((t) => (
          <Pressable key={t.id} style={styles.row} onPress={() => router.push(`/chat/${t.id}`)}>
            <Image source={t.img} style={styles.img} />
            <View style={{ flex: 1 }}>
              <View style={styles.line1}>
                <Text style={styles.name}>{t.name}</Text>
                <Text style={styles.time}>{t.time}</Text>
              </View>
              <View style={styles.line2}>
                <Text style={[styles.last, t.unread > 0 && styles.lastUnread]} numberOfLines={1}>
                  {t.last}
                </Text>
                {t.unread > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{t.unread}</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 6 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 18, paddingVertical: 12 },
  img: { width: 54, height: 54, borderRadius: shape.full },
  line1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  time: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500' },
  line2: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  last: { flex: 1, fontSize: 13, color: colors.onSurfaceVariant, fontWeight: '500' },
  lastUnread: { color: colors.onSurface, fontWeight: '600' },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: shape.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
