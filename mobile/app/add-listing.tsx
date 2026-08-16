import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { uyar } from '../components/Dialog';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Condition } from '../data/products';
import { CATEGORY_TREE, Category, SubCategory, subsOf } from '../data/categories';
import { SIZE_CLASSES, SIZE_INFO, SizeClass } from '../data/sizeClasses';
import { createListing } from '../lib/listings';
import { useAuth } from '../lib/auth';
import { colors, elevation, shape } from '../theme/tokens';

const CONDITIONS: Condition[] = ['İyi durumda', 'Az kullanılmış', 'Yeni gibi'];

export default function AddListing() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [condition, setCondition] = useState<Condition>('Az kullanılmış');
  const [category, setCategory] = useState<Category>('Oyun & Oyuncak');
  /* Alt kategori bilinçli olarak boş başlıyor. Önceden seçili gelseydi
     kullanıcı hiç bakmadan geçer, ilanların çoğu listenin ilk alt
     kategorisinde toplanırdı. */
  const [subCategory, setSubCategory] = useState<SubCategory | null>(null);

  const kategoriSec = (c: Category) => {
    setCategory(c);
    setSubCategory(null);
  };
  const [sizeClass, setSizeClass] = useState<SizeClass>('S');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [hasDamage, setHasDamage] = useState(false);
  const [isSet, setIsSet] = useState(false);
  const [saving, setSaving] = useState(false);


  const baslikTamam = title.trim().length >= 3;
  const altTamam = subCategory !== null;
  const gonderilebilir = baslikTamam && altTamam && !saving;

  async function rafaEkle() {
    if (!user) {
      uyar('Giriş gerekli', 'İlan vermek için önce giriş yapın.', [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Giriş yap', onPress: () => router.push('/sign-in') },
      ]);
      return;
    }
    if (!subCategory) return;
    setSaving(true);
    const sonuc = await createListing({
      title: title.trim(),
      category,
      subCategory,
      condition,
      sizeClass,
      location: location.trim() || undefined,
      hasDamage,
      isSet,
    });
    setSaving(false);

    if (!sonuc.ok) {
      uyar('İlan kaydedilemedi', sonuc.message);
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
          <Text style={styles.draft}>Taslaklar</Text>
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
            <Text style={styles.fotoNotBaslik}>Sırada ürün fotoğrafları var</Text>
            {/* "Yedi açıdan" yazıyordu ve bir sonraki ekranın sayacı "0/5"
                diyordu — aynı akış iki farklı sayı söylüyordu. Doğrusu beş:
                `data/photoSlots.ts` içindeki yedi kareden beşi `always`,
                kalan ikisi hasar beyan edilmişse ve ürün setse isteniyor.
                Metin rehber 09'dan birebir. */}
            <Text style={styles.fotoNotAlt}>
              Sonraki adımda ürünü beş açıdan fotoğraflayacaksın. İlanın, gerekli
              fotoğraflar tamamlandıktan sonra kontrol için gönderilir.
            </Text>
          </View>
        </View>

        {/* Başlık */}
        <Text style={styles.flabel}>Başlık</Text>
        <View style={styles.field}>
          <TextInput
            style={styles.input}
            placeholder="Örn. Adaçayı yeşili puset"
            placeholderTextColor={colors.onSurfaceVariant}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Kategori — dokuz ana, ardından seçilenin alt kategorileri */}
        <Text style={styles.flabel}>Ana kategori</Text>
        <View style={styles.chips}>
          {CATEGORY_TREE.map((c) => {
            const sel = c.name === category;
            return (
              <Pressable
                key={c.name}
                onPress={() => kategoriSec(c.name)}
                style={[styles.chip, styles.chipIkonlu, sel && styles.chipSel]}
              >
                <MaterialIcons
                  name={c.icon}
                  size={16}
                  color={sel ? colors.onSecondaryContainer : colors.onSurfaceVariant}
                />
                <Text style={[styles.chipText, sel && styles.chipTextSel]}>{c.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.flabel}>Alt kategori</Text>
        <View style={styles.chips}>
          {subsOf(category).map((s) => {
            const sel = s === subCategory;
            return (
              <Pressable
                key={s}
                onPress={() => setSubCategory(s as SubCategory)}
                style={[styles.chip, sel && styles.chipSel]}
              >
                <Text style={[styles.chipText, sel && styles.chipTextSel]}>{s}</Text>
              </Pressable>
            );
          })}
        </View>
        {!altTamam && (
          <Text style={styles.altUyari}>
            Alıcılar ürünleri alt kategoriden süzüyor; seçilmeden ilan yayına alınamaz.
          </Text>
        )}

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

        {/* Puan hesabı.

            Burada bir tablo vardı: "Kategori taban puanı 500", "kondisyon
            × 0,80", "+20 foto bonusu" ve altında "Önerilen takas değeri 420".
            Üçü de uyduruktu. BASE her kategori için sabit 500'dü — yani
            "Kategori taban puanı" etiketi olmayan bir zekâyı ima ediyordu; ve
            hesap istemcideydi, sunucu ne gelirse yazıyordu.

            Gerçek değerleme kareler yüklendikten sonra yapılıyor: model
            ürünü tanıyıp sıfır fiyatını buluyor, puanı sunucu hesaplıyor.
            Bu ekranda gösterilecek bir sayı yok — olmayan bir sayıyı
            göstermektense neyin olacağını anlatmak doğru. */}
        <Text style={styles.flabel}>DEĞERLEME</Text>
        <View style={styles.calc}>
          <Text style={styles.degerlemeMetin}>
            Kareleri çektikten sonra ürünün sıfır fiyatı bulunacak ve durumuna göre takas
            puanı hesaplanacak. Puanı sen belirlemiyorsun — bu, herkesin ilanının aynı
            ölçüyle değerlenmesi için.
          </Text>
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
              <Text style={styles.ctaText}>Devam et: Fotoğraflar</Text>
            </>
          )}
        </Pressable>
        {/* Rehber 09'un tek uyarı cümlesi. Önce iki ayrı cümle vardı ve
            ikisi de yalnızca bir eksiği söylüyordu: başlığı yazan kullanıcı
            "bir alt kategori seçin" görüp kategoriyi seçince bu kez ürün
            durumunun da gerektiğini öğreniyordu — eksikler sırayla açığa
            çıkıyordu. */}
        {!gonderilebilir ? (
          <Text style={styles.ctaHint}>
            Devam etmek için başlık, kategori ve ürün durumunu seç.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  degerlemeMetin: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
    padding: 14,
  },
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  appTitle: { flex: 1, fontSize: 15, fontWeight: '800', paddingLeft: 8, color: colors.onSurface },
  draft: { color: colors.primary, fontWeight: '700', fontSize: 14, paddingHorizontal: 12 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepbar: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  step: { flex: 1, height: 4, borderRadius: shape.full, backgroundColor: colors.surfaceContainerHighest },
  stepOn: { backgroundColor: colors.primary },
  /* Metin rehberden cümle düzeninde geliyor ("Ana kategori"), büyük harfe
     çeviren stil — tasarımda etiketler versal. İkisini karıştırmamak lazım:
     içerik rehberin, biçim tasarımın. */
  flabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 7,
    marginTop: 8,
  },
  field: { height: 46, paddingHorizontal: 14, borderRadius: shape.sm, backgroundColor: colors.surfaceContainerHigh, justifyContent: 'center', marginBottom: 4 },
  input: { fontSize: 14, color: colors.onSurface },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: shape.xs, borderWidth: 1, borderColor: colors.outlineVariant, justifyContent: 'center' },
  chipIkonlu: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  altUyari: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500', marginTop: -2, marginBottom: 4 },
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
