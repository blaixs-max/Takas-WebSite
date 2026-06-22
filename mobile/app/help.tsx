import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, elevation, shape } from '../theme/tokens';

const STEPS = [
  { icon: 'lock', title: 'Puan havuza alınır', body: 'Takas başlayınca alıcının puanı güvenli havuzda kilitlenir.' },
  { icon: 'inventory-2', title: 'Paketleme kanıtı', body: 'Satıcı kargo öncesi fotoğraf ve barkod yükler.' },
  { icon: 'local-shipping', title: 'Kargo', body: 'Anlaşmalı kargo ile gönderim takip edilir.' },
  { icon: 'verified', title: 'Teslim & aktarım', body: '48 saat içinde sorun olmazsa puan satıcıya geçer.' },
] as const;

const FAQ = [
  { q: 'Takas Puanı nedir?', a: 'Ürünlerini değerlendirip kazandığın, başka ürünleri almak için kullandığın puandır. Parayla satın alınmaz.' },
  { q: 'Güvenli havuz neyi korur?', a: 'Alıcının puanı, ürün teslim edilip onaylanana kadar havuzda bekler; satıcı göndermeden puan geçmez, alıcı da ürün gelmeden puanını kaybetmez.' },
  { q: 'Kargo ücretini kim öder?', a: 'Kargo bedeli alıcı tarafından ödenir; platform anlaşmalı kargo ile indirimli gönderim sağlar.' },
  { q: 'Ürünüm beyana uymazsa?', a: 'Teslim sonrası 48 saat içinde itiraz edebilirsin; inceleme sonucu puan iade edilir.' },
];

export default function Help() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Yardım & güvenli havuz</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <MaterialIcons name="verified-user" size={28} color={colors.onPrimaryContainer} />
          <Text style={styles.heroTitle}>Güvenli havuz nasıl çalışır?</Text>
          <Text style={styles.heroSub}>Hem alıcıyı hem satıcıyı koruyan 4 adımlı akış.</Text>
        </View>

        {STEPS.map((s, i) => (
          <View key={i} style={styles.step}>
            <View style={styles.stepIc}>
              <MaterialIcons name={s.icon} size={20} color={colors.onPrimaryContainer} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>
                {i + 1}. {s.title}
              </Text>
              <Text style={styles.stepBody}>{s.body}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.section}>Sık sorulanlar</Text>
        <View style={styles.faqGroup}>
          {FAQ.map((f, i) => (
            <View key={i}>
              <Pressable style={styles.faqQ} onPress={() => setOpen(open === i ? null : i)}>
                <Text style={styles.faqQText}>{f.q}</Text>
                <MaterialIcons name={open === i ? 'expand-less' : 'expand-more'} size={22} color={colors.onSurfaceVariant} />
              </Pressable>
              {open === i && <Text style={styles.faqA}>{f.a}</Text>}
              {i < FAQ.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        <Pressable style={styles.support}>
          <MaterialIcons name="support-agent" size={20} color="#fff" />
          <Text style={styles.supportText}>Destek ekibine yaz</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 6 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: colors.primaryContainer, borderRadius: shape.lg, padding: 18, marginBottom: 16, gap: 6 },
  heroTitle: { fontSize: 18, fontWeight: '800', color: colors.onPrimaryContainer, marginTop: 4 },
  heroSub: { fontSize: 13, color: colors.onPrimaryContainer, fontWeight: '500' },
  step: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stepIc: { width: 40, height: 40, borderRadius: shape.full, backgroundColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  stepBody: { fontSize: 13, color: colors.onSurfaceVariant, fontWeight: '500', lineHeight: 18, marginTop: 2 },
  section: { fontSize: 15, fontWeight: '700', color: colors.onSurface, marginTop: 12, marginBottom: 10 },
  faqGroup: { backgroundColor: colors.surfaceContainerLow, borderRadius: shape.md, paddingHorizontal: 16, ...elevation.level1 },
  faqQ: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15 },
  faqQText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.onSurface },
  faqA: { fontSize: 13, color: colors.onSurfaceVariant, fontWeight: '500', lineHeight: 19, paddingBottom: 14 },
  divider: { height: 1, backgroundColor: colors.outlineVariant, opacity: 0.5 },
  support: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: shape.full, backgroundColor: colors.primary, marginTop: 18 },
  supportText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
