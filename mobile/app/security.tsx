import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, elevation, shape } from '../theme/tokens';

const VERIFY = [
  { icon: 'mail', label: 'E-posta', value: 'blaixs@gmail.com', done: true },
  { icon: 'smartphone', label: 'Telefon', value: '0532 *** ** 41', done: true },
  { icon: 'badge', label: 'T.C. Kimlik doğrulaması', value: 'Onaylandı', done: true },
  { icon: 'account-balance', label: 'IBAN (kargo iadeleri)', value: 'Eklenmedi', done: false },
] as const;

export default function Security() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [twoFA, setTwoFA] = useState(true);
  const [biometric, setBiometric] = useState(false);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Güvenlik & doğrulama</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <View style={styles.scoreCard}>
          <MaterialIcons name="verified-user" size={26} color={colors.onPrimaryContainer} />
          <View style={{ flex: 1 }}>
            <Text style={styles.scoreTitle}>Hesabın güvende</Text>
            <Text style={styles.scoreSub}>3/4 doğrulama tamamlandı · güven skoruna katkı sağlar</Text>
          </View>
        </View>

        <Text style={styles.section}>Doğrulamalar</Text>
        <View style={styles.group}>
          {VERIFY.map((v, i) => (
            <View key={v.label}>
              <View style={styles.row}>
                <View style={styles.ic}>
                  <MaterialIcons name={v.icon} size={20} color={colors.onSurfaceVariant} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{v.label}</Text>
                  <Text style={styles.rowSub}>{v.value}</Text>
                </View>
                {v.done ? (
                  <MaterialIcons name="check-circle" size={22} color={colors.primary} />
                ) : (
                  <View style={styles.addPill}>
                    <Text style={styles.addPillText}>Ekle</Text>
                  </View>
                )}
              </View>
              {i < VERIFY.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        <Text style={styles.section}>Oturum güvenliği</Text>
        <View style={styles.group}>
          <View style={styles.row}>
            <View style={styles.ic}>
              <MaterialIcons name="lock" size={20} color={colors.onSurfaceVariant} />
            </View>
            <Text style={[styles.rowTitle, { flex: 1 }]}>İki adımlı doğrulama</Text>
            <Switch value={twoFA} onValueChange={setTwoFA} trackColor={{ true: colors.primary }} thumbColor="#fff" />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.ic}>
              <MaterialIcons name="fingerprint" size={20} color={colors.onSurfaceVariant} />
            </View>
            <Text style={[styles.rowTitle, { flex: 1 }]}>Biyometrik giriş</Text>
            <Switch value={biometric} onValueChange={setBiometric} trackColor={{ true: colors.primary }} thumbColor="#fff" />
          </View>
          <View style={styles.divider} />
          <Pressable style={styles.row}>
            <View style={styles.ic}>
              <MaterialIcons name="password" size={20} color={colors.onSurfaceVariant} />
            </View>
            <Text style={[styles.rowTitle, { flex: 1 }]}>Şifre değiştir</Text>
            <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 6 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scoreCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: shape.md, backgroundColor: colors.primaryContainer, marginBottom: 18 },
  scoreTitle: { fontSize: 15, fontWeight: '700', color: colors.onPrimaryContainer },
  scoreSub: { fontSize: 12.5, color: colors.onPrimaryContainer, fontWeight: '500', marginTop: 3, lineHeight: 17 },
  section: { fontSize: 13, fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 0.3, marginBottom: 10 },
  group: { backgroundColor: colors.surfaceContainerLow, borderRadius: shape.md, paddingHorizontal: 14, marginBottom: 20, ...elevation.level1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14 },
  ic: { width: 40, height: 40, borderRadius: shape.sm, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  rowSub: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500', marginTop: 2 },
  addPill: { height: 30, paddingHorizontal: 14, borderRadius: shape.full, backgroundColor: colors.secondaryContainer, justifyContent: 'center' },
  addPillText: { fontSize: 12, fontWeight: '700', color: colors.onSecondaryContainer },
  divider: { height: 1, backgroundColor: colors.outlineVariant, opacity: 0.5 },
});
