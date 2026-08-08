import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Condition } from '../data/products';
import { CATEGORIES, Category } from '../data/categories';
import { SIZE_CLASSES, SIZE_INFO, SizeClass } from '../data/sizeClasses';
import { createListing } from '../lib/listings';
import { useAuth } from '../lib/auth';
import { colors, elevation, shape } from '../theme/tokens';

const CONDITIONS: Condition[] = ['İyi durumda', 'Az kullanılmış', 'Yeni gibi'];
const COND_MULT: Record<Condition, number> = { 'İyi durumda': 0.8, 'Az kullanılmış': 0.9, 'Yeni gibi': 1.0 };
const BASE = 500;

export default function AddListing() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [condition, setCondition] = useState<Condition>('Az kullanılmış');
  const [category, setCategory] = useState<Category>('Oyuncak');
  const [sizeClass, setSizeClass] = useState<SizeClass>('S');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [hasDamage, setHasDamage] = useState(false);
  const [isSet, setIsSet] = useState(false);
  const [saving, setSaving] = useState(false);

  const mult = COND_MULT[condition];
  const photoBonus = 20;
  const total = Math.round(BASE * mult) + photoBonus;

  const baslikTamam = title.trim().length >= 3;
  const gonderilebilir = baslikTamam && !saving;

  async function rafaEkle() {
    if (!user) {
      Alert.alert('Giriş gerekli', 'İlan vermek için önce giriş yapın.', [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Giriş yap', onPress: () => router.push('/sign-in') },
      ]);
      return;
    }
    setSaving(true);
    const sonuc = await createListing({
      title: title.trim(),
      category,
      condition,
      sizeClass,
      points: total,
      location: location.trim() || undefined,
      hasDamage,
      isSet,
    });
    setSaving(false);

    if (!sonuc.ok) {
      Alert.alert('İlan kaydedilemedi', sonuc.message);
      return;
    }
    // İlan taslak olarak açıldı. Yayına girmesi için kareler gerekiyor;
    // kullanıcıyı doğrudan çekim akışına alıyoruz.
    router.replace({
      pathname: '/listing-photos',
      params: {
        id: sonuc.id,
        hasDamage: hasDamage ? '1' : '0',
        isSet: isSet ? '1' : '0',
        title: title.trim(),
      },
    });
  }

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

        {/* Fotoğraflar bir sonraki adımda, yönlendirmeli çekimle alınır. */}
        <View style={styles.fotoNot}>
          <MaterialIcons name="photo-camera" size={22} color={colors.onPrimaryContainer} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fotoNotBaslik}>Fotoğraflar sırada</Text>
            <Text style={styles.fotoNotAlt}>
              Bu adımdan sonra ürünü yedi açıdan, adım adım çekeceğiz. İlan ancak
              kareler tamamlanınca yayına girer.
            </Text>
          </View>
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

        {/* Beyanlar — hangi karelerin zorunlu olacağını bunlar belirler */}
        <Text style={styles.flabel}>DURUM BEYANI</Text>
        <Pressable style={styles.beyan} onPress={() => setHasDamage(!hasDamage)}>
          <MaterialIcons
            name={hasDamage ? 'check-box' : 'check-box-outline-blank'}
            size={24}
            color={hasDamage ? colors.primary : colors.outline}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.beyanText}>Üründe hasar veya kusur var</Text>
            <Text style={styles.beyanAlt}>İşaretlerseniz hasarın yakın çekimini isteyeceğiz</Text>
          </View>
        </Pressable>
        <Pressable style={styles.beyan} onPress={() => setIsSet(!isSet)}>
          <MaterialIcons
            name={isSet ? 'check-box' : 'check-box-outline-blank'}
            size={24}
            color={isSet ? colors.primary : colors.outline}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.beyanText}>Ürün bir set (birden çok parça)</Text>
            <Text style={styles.beyanAlt}>Parçaların tamamını gösteren bir kare isteyeceğiz</Text>
          </View>
        </Pressable>

        {/* Boyut — kargo bedeli buradan hesaplanır, bu yüzden zorunlu */}
        <Text style={styles.flabel}>BOYUT (KARGO)</Text>
        <View style={styles.chips}>
          {SIZE_CLASSES.map((sc) => {
            const sel = sc === sizeClass;
            return (
              <Pressable key={sc} onPress={() => setSizeClass(sc)} style={[styles.chip, sel && styles.chipSel]}>
                <Text style={[styles.chipText, sel && styles.chipTextSel]}>{sc}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.sizeHint}>
          {SIZE_INFO[sizeClass].ornek} · {SIZE_INFO[sizeClass].desi} · alıcı yaklaşık{' '}
          {SIZE_INFO[sizeClass].kargoTl} ₺ kargo öder
        </Text>

        {/* Konum */}
        <Text style={styles.flabel}>KONUM</Text>
        <View style={styles.field}>
          <TextInput
            style={styles.input}
            placeholder="Örn. Kadıköy"
            placeholderTextColor={colors.onSurfaceVariant}
            value={location}
            onChangeText={setLocation}
          />
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
        <Pressable
          style={[styles.cta, !gonderilebilir && styles.ctaOff]}
          disabled={!gonderilebilir}
          onPress={rafaEkle}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="photo-camera" size={20} color="#fff" />
              <Text style={styles.ctaText}>Devam et · fotoğraflar</Text>
            </>
          )}
        </Pressable>
        {!baslikTamam && <Text style={styles.ctaHint}>Devam etmek için bir başlık yazın</Text>}
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
  ctaOff: { opacity: 0.45 },
  ctaHint: { textAlign: 'center', color: colors.onSurfaceVariant, fontSize: 12, fontWeight: '500', marginTop: 8 },
  sizeHint: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500', marginBottom: 4, marginTop: -2 },
  beyan: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  beyanText: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  beyanAlt: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500', marginTop: 2 },
  fotoNot: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: shape.md,
    backgroundColor: colors.primaryContainer,
    marginBottom: 16,
  },
  fotoNotBaslik: { fontSize: 14, fontWeight: '700', color: colors.onPrimaryContainer },
  fotoNotAlt: { fontSize: 12.5, color: colors.onPrimaryContainer, fontWeight: '500', marginTop: 3, lineHeight: 17 },
});
