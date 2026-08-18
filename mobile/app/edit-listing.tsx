import { useEffect, useMemo, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { uyar } from '../components/Dialog';
import { KONUM_LIMIT, Konum, konumAra } from '../data/konumlar';
import { YayindakiIlan, loadActiveForEdit, updateActiveListing } from '../lib/listings';
import { binlik } from '../lib/profile';
import { colors, elevation, shape } from '../theme/tokens';

/**
 * Yayındaki ilanı düzenle — üç alan.
 *
 * Taslak sihirbazı (`add-listing`) burada kullanılamıyor ve kullanılmamalı:
 * o form altı adımda kategoriyi, kondisyonu ve desiyi soruyor, oysa yayındaki
 * ilanda üçü de kilitli. Sihirbazı kilitli alanlarla göstermek, kullanıcıya
 * dokunamayacağı beş adımı gezdirmek olurdu.
 *
 * ## Neden yalnızca üç alan
 *
 * Yayındaki ilanın **puanı kilitli** ve alıcı o puanı görüp karar veriyor.
 * Puanı besleyen bir alanı (kondisyon, kategori) değiştirip puanı sabit
 * bırakmak ilanı olduğundan başka göstermek; puanı yeniden hesaplamak ise
 * alıcının gördüğü fiyatı altından çekmek olurdu. Desi de kilitli çünkü
 * kargo bedelini o belirliyor.
 *
 * Ekran kilitli alanları **gizlemiyor, gösterip kilitli olduğunu söylüyor**.
 * Gizleseydi kullanıcı onları değiştirmenin bir yolu olduğunu sanıp arardı.
 */
export default function EditListing() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [ilan, setIlan] = useState<YayindakiIlan | null>(null);
  const [baslik, setBaslik] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [konum, setKonum] = useState('');
  const [konumSorgu, setKonumSorgu] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kaydediyor, setKaydediyor] = useState(false);

  useEffect(() => {
    if (!id) return;
    let iptal = false;
    loadActiveForEdit(id)
      .then((v) => {
        if (iptal) return;
        if (!v) {
          uyar(
            'İlan düzenlenemiyor',
            'Bu ilan yayında değil ya da sana ait değil. Taslak ilanları taslaklar listesinden düzenleyebilirsin.',
          );
          router.back();
          return;
        }
        setIlan(v);
        setBaslik(v.title);
        setAciklama(v.description ?? '');
        setKonum(v.location ?? '');
      })
      .finally(() => {
        if (!iptal) setYukleniyor(false);
      });
    return () => {
      iptal = true;
    };
  }, [id, router]);

  const sonuclar = useMemo(() => konumAra(konumSorgu), [konumSorgu]);
  const baslikTamam = baslik.trim().length >= 2;

  function konumSec(k: Konum) {
    setKonum(k.etiket);
    setKonumSorgu('');
  }

  async function kaydet() {
    if (!ilan) return;
    setKaydediyor(true);
    const sonuc = await updateActiveListing(ilan, {
      title: baslik,
      description: aciklama,
      location: konum,
    });
    setKaydediyor(false);
    if (!sonuc.ok) {
      uyar('Kaydedilemedi', sonuc.message);
      return;
    }
    router.back();
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.appbar, { paddingTop: insets.top + 4 }]}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>İlanı düzenle</Text>
        <View style={styles.iconBtn} />
      </View>

      {yukleniyor || !ilan ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.label}>BAŞLIK</Text>
          <View style={styles.field}>
            <TextInput
              style={styles.input}
              value={baslik}
              onChangeText={setBaslik}
              placeholder="Ürünün adı"
              placeholderTextColor={colors.onSurfaceVariant}
              maxLength={80}
            />
          </View>

          <Text style={styles.label}>AÇIKLAMA</Text>
          <View style={[styles.field, styles.cokSatir]}>
            <TextInput
              style={[styles.input, { height: 110, textAlignVertical: 'top' }]}
              value={aciklama}
              onChangeText={setAciklama}
              placeholder="Ürünün durumu, eksikleri, kullanım süresi…"
              placeholderTextColor={colors.onSurfaceVariant}
              multiline
              maxLength={600}
            />
          </View>

          <Text style={styles.label}>KONUM</Text>
          {konum ? (
            <View style={styles.secilenKonum}>
              <MaterialIcons name="place" size={20} color={colors.onPrimaryContainer} />
              <Text style={styles.secilenKonumText}>{konum}</Text>
              <Pressable onPress={() => setKonum('')} hitSlop={10} accessibilityLabel="Konumu değiştir">
                <MaterialIcons name="close" size={18} color={colors.onPrimaryContainer} />
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.field}>
                <MaterialIcons name="search" size={20} color={colors.onSurfaceVariant} />
                <TextInput
                  style={styles.input}
                  value={konumSorgu}
                  onChangeText={setKonumSorgu}
                  placeholder="İlçe veya il ara — örn. Kadıköy"
                  placeholderTextColor={colors.onSurfaceVariant}
                  autoCorrect={false}
                  autoCapitalize="words"
                />
              </View>
              {konumSorgu.trim().length >= 2 && sonuclar.length === 0 ? (
                <Text style={styles.bosSonuc}>
                  “{konumSorgu.trim()}” ile eşleşen ilçe yok. Türkçe karakter yazmana gerek
                  yok — “kadikoy” da bulur.
                </Text>
              ) : null}
              {sonuclar.length >= KONUM_LIMIT ? (
                <Text style={styles.bosSonuc}>
                  Çok fazla eşleşme var; ilk {KONUM_LIMIT} tanesi gösteriliyor. İlinin adını
                  yazarak daraltabilirsin.
                </Text>
              ) : null}
              {sonuclar.map((k) => (
                <Pressable key={k.etiket} style={styles.satir} onPress={() => konumSec(k)}>
                  <Text style={styles.satirText}>{k.ilce}</Text>
                  <Text style={styles.satirIl}>{k.il}</Text>
                </Pressable>
              ))}
            </>
          )}

          {/* Kilitli alanlar gizlenmiyor, kilitli olduğu söyleniyor.
              Gizleseydik kullanıcı onları değiştirmenin bir yolu olduğunu
              sanıp arardı — ve bulamadığında bunu bir kusur sayardı. */}
          <View style={styles.kilitli}>
            <View style={styles.kilitliBaslikSatir}>
              <MaterialIcons name="lock-outline" size={17} color={colors.onSurfaceVariant} />
              <Text style={styles.kilitliBaslik}>Yayındayken değiştirilemeyenler</Text>
            </View>

            <KilitliSatir etiket="Takas puanı" deger={`${binlik(ilan.points)} puan`} />
            <KilitliSatir etiket="Ürün durumu" deger={ilan.condition} />
            <KilitliSatir
              etiket="Kategori"
              deger={ilan.subCategory ? `${ilan.category} · ${ilan.subCategory}` : ilan.category}
            />
            <KilitliSatir etiket="Boyut (desi)" deger={ilan.sizeClass} />

            <Text style={styles.kilitliNot}>
              Bunlar ilanın puanını ve kargo bedelini belirliyor; alıcı onlara bakarak karar
              veriyor. Değiştirmen gerekiyorsa ilanı kaldırıp yeniden ekle.
            </Text>
          </View>

          <Pressable
            style={[styles.kaydet, (!baslikTamam || kaydediyor) && styles.kaydetOff]}
            onPress={kaydet}
            disabled={!baslikTamam || kaydediyor}
          >
            {kaydediyor ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="check" size={20} color="#fff" />
                <Text style={styles.kaydetText}>Değişiklikleri kaydet</Text>
              </>
            )}
          </Pressable>
          {!baslikTamam && <Text style={styles.uyari}>Başlık boş bırakılamaz.</Text>}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

function KilitliSatir({ etiket, deger }: { etiket: string; deger: string }) {
  return (
    <View style={styles.kilitliSatir}>
      <Text style={styles.kilitliEtiket}>{etiket}</Text>
      <Text style={styles.kilitliDeger} numberOfLines={1}>
        {deger}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingBottom: 4 },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 7,
    marginTop: 16,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: shape.sm,
    backgroundColor: colors.surfaceContainerHigh,
  },
  cokSatir: { alignItems: 'flex-start', paddingVertical: 12 },
  input: { flex: 1, fontSize: 14, color: colors.onSurface },
  secilenKonum: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: shape.sm,
    backgroundColor: colors.primaryContainer,
  },
  secilenKonumText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.onPrimaryContainer },
  bosSonuc: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
    lineHeight: 17,
    marginTop: 8,
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  satirText: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  satirIl: { fontSize: 12, fontWeight: '500', color: colors.onSurfaceVariant },
  kilitli: {
    marginTop: 26,
    padding: 14,
    borderRadius: shape.md,
    backgroundColor: colors.surfaceContainerLowest,
    ...elevation.level1,
  },
  kilitliBaslikSatir: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  kilitliBaslik: { fontSize: 13, fontWeight: '800', color: colors.onSurface },
  kilitliSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  kilitliEtiket: { fontSize: 12.5, fontWeight: '600', color: colors.onSurfaceVariant },
  kilitliDeger: { flex: 1, textAlign: 'right', fontSize: 12.5, fontWeight: '700', color: colors.onSurface },
  kilitliNot: {
    fontSize: 11.5,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
    lineHeight: 17,
    marginTop: 10,
  },
  kaydet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    marginTop: 22,
    ...elevation.level1,
  },
  kaydetOff: { opacity: 0.45 },
  kaydetText: { color: '#fff', fontWeight: '800', fontSize: 14.5 },
  uyari: {
    textAlign: 'center',
    color: colors.onSurfaceVariant,
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 8,
  },
});
