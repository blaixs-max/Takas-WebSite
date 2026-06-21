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

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail } = useAuth();

  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setInfo(null);
    if (!email.includes('@') || password.length < 6) {
      setError('Geçerli e-posta ve en az 6 karakter şifre girin.');
      return;
    }
    setBusy(true);
    const res = mode === 'in' ? await signInWithEmail(email, password) : await signUpWithEmail(email, password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
    } else if (mode === 'up') {
      setInfo('Hesap oluşturuldu. E-postanı doğrulayıp giriş yapabilirsin.');
      setMode('in');
    }
    // Başarılı girişte yönlendirmeyi _layout (oturum dinleyicisi) yapar.
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.appbar, { paddingTop: insets.top }]}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.appTitle}>{mode === 'in' ? 'Giriş yap' : 'Kayıt ol'}</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}>
          <MaterialIcons name="change-circle" size={30} color="#fff" />
        </View>
        <Text style={styles.h2}>{mode === 'in' ? 'Tekrar hoş geldin' : 'Aramıza katıl'}</Text>
        <Text style={styles.sub}>Takas Puanı'nı yönetmek için hesabına eriş.</Text>

        <Text style={styles.label}>E-POSTA</Text>
        <View style={styles.field}>
          <MaterialIcons name="mail-outline" size={20} color={colors.onSurfaceVariant} />
          <TextInput
            style={styles.input}
            placeholder="ornek@eposta.com"
            placeholderTextColor={colors.onSurfaceVariant}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <Text style={styles.label}>ŞİFRE</Text>
        <View style={styles.field}>
          <MaterialIcons name="lock-outline" size={20} color={colors.onSurfaceVariant} />
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.onSurfaceVariant}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {error && (
          <View style={styles.alert}>
            <MaterialIcons name="error-outline" size={18} color={colors.error} />
            <Text style={styles.alertText}>{error}</Text>
          </View>
        )}
        {info && (
          <View style={[styles.alert, styles.alertOk]}>
            <MaterialIcons name="check-circle" size={18} color={colors.primary} />
            <Text style={[styles.alertText, { color: colors.onPrimaryContainer }]}>{info}</Text>
          </View>
        )}

        <Pressable style={styles.primary} onPress={submit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name={mode === 'in' ? 'login' : 'person-add'} size={20} color="#fff" />
              <Text style={styles.primaryText}>{mode === 'in' ? 'Giriş yap' : 'Kayıt ol'}</Text>
            </>
          )}
        </Pressable>

        <Pressable onPress={() => setMode(mode === 'in' ? 'up' : 'in')} style={styles.toggle}>
          <Text style={styles.toggleText}>
            {mode === 'in' ? 'Hesabın yok mu? ' : 'Zaten hesabın var mı? '}
            <Text style={styles.toggleLink}>{mode === 'in' ? 'Kayıt ol' : 'Giriş yap'}</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  appTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  logo: {
    width: 56,
    height: 56,
    borderRadius: shape.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  h2: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, color: colors.onSurface },
  sub: { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '500', marginTop: 6, marginBottom: 22 },
  label: { fontSize: 12, fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 0.4, marginBottom: 8, marginTop: 14 },
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
  alertOk: { backgroundColor: colors.primaryContainer },
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
  toggle: { alignItems: 'center', marginTop: 18 },
  toggleText: { color: colors.onSurfaceVariant, fontSize: 14, fontWeight: '500' },
  toggleLink: { color: colors.primary, fontWeight: '700' },
});
