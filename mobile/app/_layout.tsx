import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { FavoritesProvider } from '../lib/favorites';
import { CartProvider } from '../lib/cart';
import { AcilisEkrani } from '../components/brand/AcilisEkrani';
import { colors } from '../theme/tokens';

/**
 * Yerel açılış ekranı kendiliğinden kapanmasın: paket yüklenip ilk kare
 * çizilene kadar açık kalsın, sonra `AcilisEkrani`'na devretsin. Kapanmasını
 * engellemezsek arada bir kare boş beyaz görünüyor.
 *
 * Expo Go'da bu çağrının görünür bir etkisi yok — orada yükleme ekranını
 * `app.json`'daki simge ve ad çiziyor, `splash.png` hiç kullanılmıyor.
 */
SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Açılış ekranının en az görünme süresi.
 *
 * Oturum çözümü çoğu açılışta 100 ms'nin altında bitiyor; süre konmazsa logo
 * göz kırpması gibi geçip gidiyor ve marka anı diye bir şey kalmıyor. Alt
 * sınır giriş animasyonunun (520 ms) bitmesine yetiyor, bekletme hissi
 * verecek kadar uzun değil.
 */
const ACILIS_EN_AZ_MS = 1100;

function useEnAzSure(ms: number): boolean {
  const [doldu, setDoldu] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDoldu(true), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return doldu;
}

const AUTH_ROUTES = ['onboarding', 'sign-in', 'auth-callback'];

/** Oturuma göre yönlendirme. Supabase yapılandırılmamışsa (demo) kapı uygulanmaz. */
function useProtectedRoute() {
  const { session, loading, configured } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading || !configured) return;
    const inAuthGroup = AUTH_ROUTES.includes(segments[0] ?? '');
    if (!session && !inAuthGroup) {
      router.replace('/onboarding');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, configured, segments]);
}

function RootNavigator() {
  const { loading } = useAuth();
  const sureDoldu = useEnAzSure(ACILIS_EN_AZ_MS);
  useProtectedRoute();

  /* İlk kare çizildi; yerel açılış ekranı artık kapanabilir. Kapanınca
     altından bu ekran çıkıyor ve ikisi aynı krem zemini paylaştığı için
     geçiş görünmüyor. */
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (loading || !sureDoldu) return <AcilisEkrani />;

  return (
    <Stack
      initialRouteName="onboarding"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="trades" options={{ presentation: 'card' }} />
      <Stack.Screen name="wallet" options={{ presentation: 'card' }} />
      <Stack.Screen name="product/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="add-listing" options={{ presentation: 'modal' }} />
      <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
      <Stack.Screen name="notifications" options={{ presentation: 'card' }} />
      <Stack.Screen name="messages" options={{ presentation: 'card' }} />
      <Stack.Screen name="addresses" options={{ presentation: 'card' }} />
      <Stack.Screen name="security" options={{ presentation: 'card' }} />
      <Stack.Screen name="help" options={{ presentation: 'card' }} />
      <Stack.Screen name="invite" options={{ presentation: 'card' }} />
      <Stack.Screen name="chat/[id]" options={{ presentation: 'card' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <FavoritesProvider>
          <CartProvider>
            <RootNavigator />
          </CartProvider>
        </FavoritesProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
