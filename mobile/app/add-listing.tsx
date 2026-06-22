import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Category, Condition } from '../data/products';
import { resolveImage } from '../data/productImages';
import { colors, elevation, shape } from '../theme/tokens';

const CONDITIONS: Condition[] = ['İyi durumda', 'Az kullanılmış', 'Yeni gibi'];
const COND_MULT: Record<Condition, number> = { 'İyi durumda': 0.8, 'Az kullanılmış': 0.9, 'Yeni gibi': 1.0 };
const CATEGORIES: Category[] = ['Oyuncak', 'Kitap', 'Montessori', 'Kutu oyunu'];
const BASE = 500;

export default function AddListing() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [condition, setCondition] = useState<Condition>('Az kullanılmış');
  const [category, setCategory] = useState<Category>('Montessori');
  const [title, setTitle] = useState('');

  const mult = COND_MULT[condition];
  const photoBonus = 20;
  const total = Math.round(BASE * mult) + photoBonus;

  return (
    <View style={styles.root}>
      <View style={[styles.appbar, { paddingTop: insets.top }]}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.appTitle}>Ürün ekle</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.draft}>Taslak</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {/* Adım çubuğu */}
        <View style={styles.stepbar}>
          <View style={[styles.step, styles.stepOn]} />
          <View style={[styles.step, styles.stepOn]} />
          <View style={styles.step} />
        </View>

        {/* Fotoğraf yükleme */}
        <View style={styles.upload}>
          <View style={styles.uploadIc}>
            <MaterialIcons name="add-a-photo" size={30} color={colors.onPrimaryContainer} />
          </View>
          <Text style={styles.uploadTitle}>Kapak fotoğrafını çek</Text>
          <Text style={styles.uploadSub}>Gerçek çekim · AI kalite kontrolünden geçer</Text>
        </View>

        <View style={styles.thumbs}>
          <View style={styles.thumb}>
            <Image source={resolveImage('wooden-close')} style={styles.thumbImg} />
            <View style={styles.thumbX}>
              <MaterialIcons name="close" size={14} color="#fff" />
            </View>
          </View>
          <View style={styles.thumb}>
            <Image source={resolveImage('wooden-blocks')} style={styles.thumbImg} />
            <View style={styles.thumbX}>
              <MaterialIcons name="close" size={14} color="#fff" />
            </View>
          </View>
          <View style={[styles.thumb, styles.thumbAdd]}>
            <MaterialIcons name="add" size={24} color={colors.outline} />
          </View>
          <View style={[styles.thumb, styles.thumbAdd]}>
            <MaterialIcons name="add" size={24} color={colors.outline} />
          </View>
        </View>

        {/* AI kontrol */}
        <View style={styles.ai}>
          <View style={styles.aiIc}>
            <MaterialIcons name="auto-awesome" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.aiTitle}>AI fotoğraf kontrolü</Text>
            <Text style={styles.aiSub}>Gerçek çekim · kategori önerisi: Montessori / ahşap</Text>
          </View>
          <MaterialIcons name="check-circle" size={26} color={colors.primary} />
        </View>

        {/* Başlık */}
        <Text style={styles.flabel}>BAŞLIK</Text>
        <View style={styles.field}>
          <TextInput
            style={styles.input}
            placeholder="Örn. Montessori ahşap blok seti"
            placeholderTextColor={colors.onSurfaceVariant}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Kategori */}
        <Text style={styles.flabel}>KATEGORİ</Text>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => {
            const sel = c === category;
            return (
              <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, sel && styles.chipSel]}>
                <Text style={[styles.chipText, sel && styles.chipTextSel]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Kondisyon */}
        <Text style={styles.flabel}>KONDİSYON</Text>
        <View style={styles.seg}>
          {CONDITIONS.map((c) => {
            const sel = c === condition;
            return (
              <Pressable key={c} onPress={() => setCondition(c)} style={[styles.segBtn, sel && styles.segSel]}>
                {sel && <MaterialIcons name="check" size={16} color={colors.onSecondaryContainer} />}
                <Text style={[styles.segText, sel && styles.segTextSel]} numberOfLines={1}>
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Puan hesabı */}
        <Text style={styles.flabel}>PUAN HESABI</Text>
        <View style={styles.calc}>
          <Row label="Kategori taban puanı" value={`${BASE}`} />
          <Row label={`Kondisyon: ${condition.toLowerCase()}`} value={`× ${mult.toFixed(2)}`} />
          <Row label="Gerçek fotoğraf bonusu" value={`+ ${photoBonus}`} last />
        </View>
        <View style={styles.total}>
          <View>
            <Text style={styles.totalLabel}>Önerilen takas değeri</Text>
            <Text style={styles.totalBig}>{total}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.totalBand}>tahmini bant</Text>
            <Text style={styles.totalBandVal}>
              {total - 30} – {total + 30}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.actionbar, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable style={styles.cta} onPress={() => router.back()}>
          <MaterialIcons name="check" size={20} color="#fff" />
          <Text style={styles.ctaText}>Rafa ekle</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  appTitle: { flex: 1, fontSize: 18, fontWeight: '700', paddingLeft: 8, color: colors.onSurface },
  draft: { color: colors.primary, fontWeight: '700', fontSize: 14, paddingHorizontal: 12 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepbar: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  step: { flex: 1, height: 4, borderRadius: shape.full, backgroundColor: colors.surfaceContainerHighest },
  stepOn: { backgroundColor: colors.primary },
  upload: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.outline,
    borderRadius: shape.lg,
    backgroundColor: colors.surfaceContainerLow,
    aspectRatio: 16 / 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  uploadIc: {
    width: 62,
    height: 62,
    borderRadius: shape.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  uploadSub: { fontSize: 12, fontWeight: '500', color: colors.onSurfaceVariant },
  thumbs: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  thumb: { flex: 1, aspectRatio: 1, borderRadius: shape.sm, overflow: 'hidden', backgroundColor: colors.surfaceContainerHigh },
  thumbImg: { width: '100%', height: '100%' },
  thumbX: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 22,
    height: 22,
    borderRadius: shape.full,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbAdd: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.outlineVariant, backgroundColor: 'transparent' },
  ai: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: shape.md,
    backgroundColor: colors.surfaceContainerLow,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    ...elevation.level1,
  },
  aiIc: { width: 42, height: 42, borderRadius: shape.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  aiTitle: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  aiSub: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500', marginTop: 2 },
  flabel: { fontSize: 12, fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 0.4, marginBottom: 8, marginTop: 6 },
  field: { height: 52, paddingHorizontal: 16, borderRadius: shape.sm, backgroundColor: colors.surfaceContainerHigh, justifyContent: 'center', marginBottom: 6 },
  input: { fontSize: 15, color: colors.onSurface },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: shape.xs, borderWidth: 1, borderColor: colors.outlineVariant, justifyContent: 'center' },
  chipSel: { backgroundColor: colors.secondaryContainer, borderColor: 'transparent' },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },
  chipTextSel: { color: colors.onSecondaryContainer, fontWeight: '700' },
  seg: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  segBtn: {
    flex: 1,
    height: 42,
    borderRadius: shape.xs,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  segSel: { backgroundColor: colors.secondaryContainer, borderColor: 'transparent' },
  segText: { fontSize: 12.5, fontWeight: '600', color: colors.onSurfaceVariant },
  segTextSel: { color: colors.onSecondaryContainer, fontWeight: '700' },
  calc: { backgroundColor: colors.surfaceContainerLow, borderRadius: shape.md, paddingHorizontal: 16, marginBottom: 14, ...elevation.level1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
  rowLabel: { fontSize: 13, color: colors.onSurfaceVariant, fontWeight: '500', flex: 1 },
  rowValue: { fontSize: 13, color: colors.onSurface, fontWeight: '700' },
  total: { backgroundColor: colors.primary, borderRadius: shape.md, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...elevation.level1 },
  totalLabel: { color: 'rgba(255,255,255,0.82)', fontWeight: '600', fontSize: 12 },
  totalBig: { color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: -1, marginTop: 3 },
  totalBand: { color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: '600' },
  totalBandVal: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 2 },
  actionbar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 14, backgroundColor: colors.surfaceContainer },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    ...elevation.level1,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
