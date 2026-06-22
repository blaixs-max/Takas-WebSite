import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useCart } from '../lib/cart';
import { colors, elevation, shape } from '../theme/tokens';

const LABELS: Record<string, string> = {
  index: 'Anasayfa',
  cart: 'Sepetim',
  favorites: 'Favoriler',
  profile: 'Hesabım',
};
const ICON: Record<string, { on: keyof typeof MaterialIcons.glyphMap; off: keyof typeof MaterialIcons.glyphMap }> = {
  index: { on: 'home', off: 'home' },
  cart: { on: 'shopping-cart', off: 'shopping-cart' },
  favorites: { on: 'favorite', off: 'favorite-border' },
  profile: { on: 'person', off: 'person-outline' },
};

/**
 * Özel alt menü: Anasayfa · Sepetim · [Ürün Ekle] · Favoriler · Hesabım
 * Ortadaki "Ürün Ekle" yükseltilmiş, primary renkli dairesel buton; gerçek
 * sekme değil — /add-listing modalını açar. Diğer 4'ü gerçek sekme.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { count } = useCart();

  // routes sırası: index, cart, favorites, profile
  const byName = Object.fromEntries(state.routes.map((r, i) => [r.name, { route: r, index: i }]));
  const activeName = state.routes[state.index]?.name;

  const Tab = ({ name }: { name: string }) => {
    const entry = byName[name];
    if (!entry) return <View style={styles.slot} />;
    const focused = activeName === name;
    const color = focused ? colors.primary : colors.onSurfaceVariant;
    const badge = name === 'cart' && count > 0 ? count : undefined;
    return (
      <Pressable
        style={styles.slot}
        onPress={() => {
          const ev = navigation.emit({ type: 'tabPress', target: entry.route.key, canPreventDefault: true });
          if (!focused && !ev.defaultPrevented) navigation.navigate(entry.route.name);
        }}
      >
        <View>
          <MaterialIcons name={focused ? ICON[name].on : ICON[name].off} size={24} color={color} />
          {badge !== undefined && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.label, { color }]} numberOfLines={1}>
          {LABELS[name]}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: 72 + insets.bottom }]}>
      <Tab name="index" />
      <Tab name="cart" />

      {/* Ortadaki yükseltilmiş "Ürün Ekle" butonu */}
      <View style={styles.slot}>
        <Pressable style={styles.fab} onPress={() => router.push('/add-listing')}>
          <MaterialIcons name="add-a-photo" size={26} color={colors.onPrimary} />
        </Pressable>
        <Text style={[styles.label, styles.fabLabel]} numberOfLines={1}>
          Ürün Ekle
        </Text>
      </View>

      <Tab name="favorites" />
      <Tab name="profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceContainer,
    borderTopLeftRadius: shape.xl,
    borderTopRightRadius: shape.xl,
    paddingTop: 10,
    ...elevation.level2,
  },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', gap: 4, paddingTop: 4 },
  label: { fontSize: 11.5, fontWeight: '600' },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surfaceContainer,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  fab: {
    width: 58,
    height: 58,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    borderWidth: 5,
    borderColor: colors.surface,
    ...elevation.level3,
  },
  fabLabel: { color: colors.primary, fontWeight: '700', marginTop: 2 },
});
