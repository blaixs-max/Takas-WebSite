import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { sifirlamaBayragiOkuVeSil } from '../lib/auth';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { colors, shape } from '../theme/tokens';

/**
 * `eldenele://auth-callback` — dışarıdan dönen kimlik bağlantılarının indiği yer.
 *
 * ## Bu ekran neden yoktu ve neden şimdi gerekli
 *
 * Rota `_layout.tsx` içindeki `AUTH_ROUTES` listesinde baştan beri sayılıydı
 * ama **dosyası hiç yazılmamıştı.** Bugüne kadar patlamamasının sebebi
 * Google/Apple akışının dönüş adresini `openAuthSessionAsync` ile kendi
 * yakalaması: tarayıcı kapanıyor, kod uygulamanın içinde işleniyor, rotaya
 * hiç gidilmiyor.
 *
 * **Şifre sıfırlama böyle çalışmıyor.** Kullanıcı e-postadaki bağlantıya
 * telefonun tarayıcısında basıyor; Supabase doğruladıktan sonra sistem
 * uygulamayı bu rotayla açıyor. Dosya olmasaydı posta çalışır, bağlantı
 * çalışır, kullanıcı boş bir ekrana inerdi.
 *
 * ## Üç bağlantı biçimi de karşılanıyor
 *
 * İstemci `flowType: 'pkce'` ile kurulu, yani beklenen biçim `?code=`. Ama
 * biçim Supabase'in e-posta şablonuna ve proje ayarına göre değişebiliyor ve
 * bu ekran bir kez yanlış çalışırsa kullanıcı hesabına giremez. Üçü de
 * karşılanıyor:
 *
 * | Biçim | Nereden | Ne yapılıyor |
 * |---|---|---|
 * | `?code=…` | PKCE (varsayılan) | `exchangeCodeForSession` |
 * | `?token_hash=…&type=…` | doğrulama bağlantısı | `verifyOtp` |
 * | `#access_token=…&refresh_token=…` | örtük akış | `setSession` |
 *
 * Parça (`#…`) bilerek `Linking` ile okunuyor: expo-router'ın
 * `useLocalSearchParams`'ı yalnızca sorgu dizesini görür, parçayı görmez.
 *
 * ## Sıfırlamada neden başka bir rotaya gidiliyor
 *
 * Kod oturuma çevrildiği anda `useProtectedRoute` devreye giriyor: oturum var
 * ve rota `AUTH_ROUTES` içinde olduğu için kullanıcıyı `/(tabs)`'a atıyor.
 * Şifre formu burada çizilseydi görünür görünmez kaybolurdu. Bu yüzden
 * sıfırlama `/yeni-sifre` rotasına devrediliyor — orada oturum var, rota da
 * `AUTH_ROUTES` dışında, kapı karışmıyor.
 */
export default function AuthCallback() {
  const router = useRouter();
  const url = Linking.useURL();
  const [hata, setHata] = useState<string | null>(null);
  /* Derin bağlantı aynı oturumda iki kez gelebiliyor (soğuk açılış + olay).
     Kod tek kullanımlık: ikinci deneme "code already used" ile döner ve
     kullanıcı başarılı bir girişin ardından hata görürdü. */
  const islendi = useRef(false);

  const isle = useCallback(
    async (gelen: string) => {
      if (islendi.current) return;
      islendi.current = true;

      if (!supabaseConfigured || !supabase) {
        setHata('Sunucu bağlantısı yok.');
        return;
      }

      const ayristir = (s: string) => Object.fromEntries(new URLSearchParams(s));
      const sorgu = ayristir(gelen.split('?')[1]?.split('#')[0] ?? '');
      const parca = ayristir(gelen.split('#')[1] ?? '');
      const p: Record<string, string> = { ...sorgu, ...parca };

      /* Supabase hatayı da dönüş adresine yazıyor — en sık görüleni süresi
         dolmuş bağlantı. Sessizce girişe atmak yerine sebebi söylüyoruz. */
      if (p.error || p.error_description) {
        setHata(
          p.error_code === 'otp_expired'
            ? 'Bağlantının süresi dolmuş. Giriş ekranından yeni bir bağlantı iste.'
            : (p.error_description ?? 'Bağlantı doğrulanamadı.'),
        );
        return;
      }

      let hataMesaji: string | null = null;

      if (p.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(p.code);
        hataMesaji = error?.message ?? null;
      } else if (p.token_hash && p.type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: p.token_hash,
          type: p.type as 'recovery' | 'signup' | 'email_change' | 'magiclink',
        });
        hataMesaji = error?.message ?? null;
      } else if (p.access_token && p.refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token: p.access_token,
          refresh_token: p.refresh_token,
        });
        hataMesaji = error?.message ?? null;
      } else {
        hataMesaji = 'Bağlantıda doğrulama bilgisi yok.';
      }

      if (hataMesaji) {
        setHata(hataMesaji);
        return;
      }

      /* Sıfırlamada şifre formuna; diğer her durumda hiçbir şey yapmıyoruz —
         oturum açıldığı için kapı zaten `/(tabs)`'a alıyor.

         `type` tek başına yeterli değil: PKCE akışında Supabase dönüş adresine
         yalnızca `?code=` yazabiliyor. Bayrak, sıfırlamayı bu cihazdan
         isteyen kullanıcı için o boşluğu kapatıyor. */
      const sifirlamaBekleniyor = await sifirlamaBayragiOkuVeSil();
      if (p.type === 'recovery' || sifirlamaBekleniyor) router.replace('/yeni-sifre');
    },
    [router],
  );

  useEffect(() => {
    if (url) {
      isle(url);
      return;
    }
    /* Uygulama bağlantıyla soğuk açıldıysa `useURL` ilk karede henüz boş
       olabiliyor; başlangıç adresini ayrıca soruyoruz. */
    Linking.getInitialURL().then((ilk) => {
      if (ilk) isle(ilk);
    });
  }, [url, isle]);

  if (hata) {
    return (
      <View style={styles.kok}>
        <View style={styles.daire}>
          <MaterialIcons name="link-off" size={26} color={colors.error} />
        </View>
        <Text style={styles.baslik}>Bağlantı açılamadı</Text>
        <Text style={styles.metin}>{hata}</Text>
        <Pressable style={styles.cta} onPress={() => router.replace('/sign-in')}>
          <Text style={styles.ctaText}>Giriş ekranına dön</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.kok}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.metin}>Bağlantı doğrulanıyor…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kok: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
    gap: 14,
  },
  daire: {
    width: 64,
    height: 64,
    borderRadius: shape.full,
    backgroundColor: colors.errorContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baslik: { fontSize: 18, fontWeight: '800', color: colors.onSurface },
  metin: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  cta: {
    height: 46,
    paddingHorizontal: 34,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  ctaText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
