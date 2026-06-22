import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, shape } from '../../theme/tokens';
import { useCart } from '../../lib/cart';

/** M3 Navigation Bar — Raf · Sepet · Profil (Takaslar & Cüzdan, Profil altında) */
export default function TabsLayout() {
  const { count } = useCart();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.onSurface,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: colors.surfaceContainer,
          borderTopWidth: 0,
          height: 80,
          paddingTop: 12,
          paddingBottom: 16,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarItemStyle: { borderRadius: shape.full },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Raf',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="storefront" size={24} color={focused ? colors.onSecondaryContainer : color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Sepet',
          tabBarBadge: count > 0 ? count : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, fontSize: 10 },
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="shopping-cart" size={24} color={focused ? colors.onSecondaryContainer : color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="person" size={24} color={focused ? colors.onSecondaryContainer : color} />
          ),
        }}
      />
    </Tabs>
  );
}
