import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, shape } from '../../theme/tokens';

/** M3 Navigation Bar — aktif sekmede pill (secondary container) göstergesi. */
export default function TabsLayout() {
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
        name="discover"
        options={{
          title: 'Keşfet',
          tabBarIcon: ({ color }) => <MaterialIcons name="search" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="trades"
        options={{
          title: 'Takaslar',
          tabBarIcon: ({ color }) => <MaterialIcons name="swap-horiz" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Cüzdan',
          tabBarIcon: ({ color }) => <MaterialIcons name="account-balance-wallet" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <MaterialIcons name="person" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
