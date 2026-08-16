import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { colors, elevation, shape } from '../theme/tokens';

/** Supabase'in kendi alt sınırı. Aynı sayıyı burada da tutuyoruz ki kullanıcı
 *  altı karakter yazıp sunucudan İngilizce bir hata almasın. */
const EN_AZ = 6;

/**
 * Sıfırlama bağlantısından sonra yeni şifrenin yazıldığı ekran.
 *
 * `auth-callback` kodu oturuma çevirdikten sonra buraya devrediyor. Kendi
 * rotası olmasının sebebi teknik: oturum açıldığı anda `_layout.tsx`'teki kapı
 * `AUTH_ROUTES` içindeki her rotayı `/(tabs)`'a atıyor, yani form orada
 * çizilseydi görünür görünmez kaybolurdu. Burası o listenin dışında.
 *
 * **Eski şifre sorulmuyor** — kullanıcı zaten onu unuttuğu için burada.
 * Yetkiyi veren şey e-posta kutusuna erişebilmiş olması; bağlantı tek
 * kullanımlık ve süreli.
 *
 * İki alan var, ikincisi doğrulama. Tek alan bırakmak burada yanlış olurdu:
 * yanlış yazılan bir şifre kullanıcıyı doğrudan hesabının dışında bırakır ve
 * geri dönüşü yine bu akıştan geçiyor.
 */
export default function YeniSifre() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sifreBelirle } = useAuth();

  const [sifre, setSifre] = useState('');
  const [tekrar, setTekrar] = useState('');
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function kaydet() {
    setHata(null);
    if (sifre.length < EN_AZ) {
      setHata(`Şifre en az ${EN_AZ} karakter olmalı.`);
      return;
    }
    if (sifre !== tekrar) {
      setHata('İki şifre aynı değil.');
      return;
    }

    setBusy(true);
    const res = await sifreBelirle(sifre);
    setBusy(false);

    if (res.error) {
      setHata(res.error);
      return;
    }
    /* Oturum sıfırlama bağlantısıyla zaten açıldı; kullanıcıyı bir daha giriş
       yapmaya zorlamak gereksiz bir adım olurdu. */
    router.replace('/(tabs)');
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: insets.top + 40 }}>
        <View style={styles.daire}>
          <MaterialIcons name="lock-reset" size={28} color={colors.onPrimaryContainer} />
        </View>

        <Text style={styles.h2}>Yeni şifreni belirle</Text>
        <Text style={styles.sub}>
          Bağlantı doğrulandı. Yeni şifreni yaz, hesabına buradan devam edeceksin.
        </Text>

        <Text style={styles.label}>YENİ ŞİFRE</Text>
        <View style={styles.field}>
          <MaterialIcons name="lock-outline" size={20} color={colors.onSurfaceVariant} />
          <TextInput
            style={styles.input}
            placeholder={`En az ${EN_AZ} karakter`}
            placeholderTextColor={colors.onSurfaceVariant}
            secureTextEntry
            autoFocus
            value={sifre}
            onChangeText={setSifre}
          />
        </View>

        <Text style={styles.label}>YENİ ŞİFRE (TEKRAR)</Text>
        <View style={styles.field}>
          <MaterialIcons name="lock-outline" size={20} color={colors.onSurfaceVariant} />
          <TextInput
            style={styles.input}
            placeholder="Aynısını bir kez daha yaz"
            placeholderTextColor={colors.onSurfaceVariant}
            secureTextEntry
            value={tekrar}
            onChangeText={setTekrar}
          />
        </View>

        {hata && (
          <View style={styles.alert}>
            <MaterialIcons name="error-outline" size={18} color={colors.error} />
            <Text style={styles.alertText}>{hata}</Text>
          </View>
        )}

        <Pressable style={styles.primary} onPress={kaydet} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="check" size={20} color="#fff" />
              <Text style={styles.primaryText}>Şifreyi kaydet</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  daire: {
    width: 60,
    height: 60,
    borderRadius: shape.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  h2: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, color: colors.onSurface },
  sub: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.4,
    marginBottom: 8,
    marginTop: 14,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 54,
    paddingHorizontal: 16,
    borderRadius: shape.sm,
    backgroundColor: colors.surfaceContainerHigh,
  },
  input: { flex: 1, fontSize: 15, color: colors.onSurface },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.errorContainer,
    borderRadius: shape.sm,
    padding: 12,
    marginTop: 16,
  },
  alertText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.error },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    marginTop: 24,
    ...elevation.level1,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
