import { Tabs } from 'expo-router';
import { TabBar } from '../../components/TabBar';

/**
 * Alt menü (özel TabBar):
 *   Anasayfa · Sepetim · [Ürün Ekle] · Favoriler · Hesabım
 * "Ürün Ekle" ortadaki yükseltilmiş buton; /add-listing modalını açar (sekme değil).
 */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Anasayfa' }} />
      <Tabs.Screen name="cart" options={{ title: 'Sepetim' }} />
      <Tabs.Screen name="favorites" options={{ title: 'Favoriler' }} />
      <Tabs.Screen name="profile" options={{ title: 'Hesabım' }} />
    </Tabs>
  );
}
