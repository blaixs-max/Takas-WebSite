import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { uyar } from '../components/Dialog';
import { KONUM_LIMIT, Konum, konumAra } from '../data/konumlar';
import { AddressInput, BOS_ADRES, loadAddress, saveAddress } from '../lib/addresses';
import { colors, elevation, shape } from '../theme/tokens';

/** Hazır başlıklar — yazmadan seçilebilsin diye. Liste dayatma değil öneri. */
const HAZIR_BASLIKLAR = ['Ev', 'Ofis', 'Annemler', 'Yazlık'];

/**
 * Adres ekle / düzenle.
 *
 * Tek form iki iş görüyor: `id` parametresi varsa düzenleme, yoksa ekleme.
 * İki ayrı ekran yazmak, aynı altı alanı ve aynı doğrulamayı iki yerde
 * tutmak olurdu — ve ilk değişiklikte ikisi ayrışırdı.
 *
 * İl/ilçe serbest metin değil, `data/konumlar.ts` listesinden seçiliyor:
 * ilan konumunda aynı karar verildi ve sebebi aynı — "kadıköy", "Kadikoy",
 * "İstanbul/Kadıköy" üç ayrı değer olarak yazılıyordu. Kargo adresinde bu
 * daha da önemli: gönderi etiketine basılan şey bu.
 */
export default function AddressEdit() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [form, setForm] = useState<AddressInput>(BOS_ADRES);
  const [konumSorgu, setKonumSorgu] = useState('');
  const [yukleniyor, setYukleniyor] = useState(Boolean(id));
  const [kaydediyor, setKaydediyor] = useState(false);

  useEffect(() => {
    if (!id) return;
    let iptal = false;
    loadAddress(id)
      .then((a) => {
        if (iptal) return;
        if (!a) {
          uyar('Adres bulunamadı', 'Bu adres kaldırılmış olabilir.');
          router.back();
          return;
        }
        setForm({
          baslik: a.baslik,
          adSoyad: a.adSoyad,
          telefon: a.telefon ?? '',
          il: a.il,
          ilce: a.ilce,
          acikAdres: a.acikAdres,
          varsayilan: a.varsayilan,
        });
      })
      .finally(() => {
        if (!iptal) setYukleniyor(false);
      });
    return () => {
      iptal = true;
    };
  }, [id, router]);

  const sonuclar = useMemo(() => konumAra(konumSorgu), [konumSorgu]);
  const konumSecildi = Boolean(form.il && form.ilce);

  function konumSec(k: Konum) {
    setForm((f) => ({ ...f, il: k.il, ilce: k.ilce }));
    setKonumSorgu('');
  }

  async function kaydet() {
    setKaydediyor(true);
    const sonuc = await saveAddress(form, id);
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
        <Text style={styles.title}>{id ? 'Adresi düzenle' : 'Yeni adres'}</Text>
        <View style={styles.iconBtn} />
      </View>

      {yukleniyor ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.label}>ADRES BAŞLIĞI</Text>
          <View style={styles.hapSatir}>
            {HAZIR_BASLIKLAR.map((b) => {
              const sel = form.baslik.trim() === b;
              return (
                <Pressable
                  key={b}
                  style={[styles.hap, sel && styles.hapSel]}
                  onPress={() => setForm((f) => ({ ...f, baslik: b }))}
                >
                  <Text style={[styles.hapText, sel && styles.hapTextSel]}>{b}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.field}>
            <TextInput
              style={styles.input}
              value={form.baslik}
              onChangeText={(t) => setForm((f) => ({ ...f, baslik: t }))}
              placeholder="Kendi başlığını da yazabilirsin"
              placeholderTextColor={colors.onSurfaceVariant}
              maxLength={24}
            />
          </View>

          <Text style={styles.label}>TESLİM ALACAK KİŞİ</Text>
          <View style={styles.field}>
            <MaterialIcons name="person-outline" size={20} color={colors.onSurfaceVariant} />
            <TextInput
              style={styles.input}
              value={form.adSoyad}
              onChangeText={(t) => setForm((f) => ({ ...f, adSoyad: t }))}
              placeholder="Ad Soyad"
              placeholderTextColor={colors.onSurfaceVariant}
              maxLength={60}
              autoCapitalize="words"
            />
          </View>

          <Text style={styles.label}>TELEFON</Text>
          <View style={styles.field}>
            <MaterialIcons name="phone" size={20} color={colors.onSurfaceVariant} />
            <TextInput
              style={styles.input}
              value={form.telefon}
              onChangeText={(t) => setForm((f) => ({ ...f, telefon: t }))}
              placeholder="Kargo şirketi arayabilsin diye"
              placeholderTextColor={colors.onSurfaceVariant}
              maxLength={20}
              keyboardType="phone-pad"
            />
          </View>

          <Text style={styles.label}>İL / İLÇE</Text>
          {konumSecildi ? (
            <View style={styles.secilenKonum}>
              <MaterialIcons name="place" size={20} color={colors.onPrimaryContainer} />
              <Text style={styles.secilenKonumText}>
                {form.ilce}, {form.il}
              </Text>
              <Pressable
                onPress={() => setForm((f) => ({ ...f, il: '', ilce: '' }))}
                hitSlop={10}
                accessibilityLabel="Konumu değiştir"
              >
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
              {/* Kırpıldıysa söyleniyor: "merkez" yazan kullanıcı 51 ilçeden
                  40'ını görüyor ve sessiz kalınsaydı kendi ilçesi listede
                  yokmuş gibi dururdu. */}
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

          <Text style={styles.label}>AÇIK ADRES</Text>
          <View style={[styles.field, styles.cokSatir]}>
            <TextInput
              style={[styles.input, { height: 88, textAlignVertical: 'top' }]}
              value={form.acikAdres}
              onChangeText={(t) => setForm((f) => ({ ...f, acikAdres: t }))}
              placeholder="Mahalle, cadde/sokak, bina ve daire numarası"
              placeholderTextColor={colors.onSurfaceVariant}
              multiline
              maxLength={300}
            />
          </View>

          <View style={styles.varsayilanSatir}>
            <View style={{ flex: 1 }}>
              <Text style={styles.varsayilanBaslik}>Varsayılan adres</Text>
              <Text style={styles.varsayilanAlt}>Ödeme formu bu adresle açılır.</Text>
            </View>
            <Switch
              value={form.varsayilan}
              onValueChange={(v) => setForm((f) => ({ ...f, varsayilan: v }))}
              trackColor={{ true: colors.primary, false: colors.surfaceContainerHighest }}
              thumbColor="#fff"
            />
          </View>

          {/* Ne saklandığı ve ne saklanmadığı burada yazılı. Adres defteri
              2026-08-18'de açıldı ve o güne kadar ekranda "adresin profilinde
              saklanmaz" yazıyordu; karar değişti, cümle de değişti. Kimlik
              numarası hâlâ saklanmıyor ve bunu söylemek gerekiyor — insanlar
              "adres saklanıyorsa fatura bilgim de saklanıyordur" diye okur. */}
          <View style={styles.gizlilik}>
            <MaterialIcons name="lock-outline" size={17} color={colors.accent} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.gizlilikBaslik}>Adresini kimse görmez</Text>
              <Text style={styles.gizlilikText}>
                Adres yalnızca senin hesabında saklanır ve gönderi etiketinde kullanılır.
                İlanlarında görünmez. T.C. kimlik numarası burada tutulmaz — fatura için her
                ödemede ayrıca sorulur.
              </Text>
            </View>
          </View>

          <Pressable
            style={[styles.kaydet, kaydediyor && { opacity: 0.6 }]}
            onPress={kaydet}
            disabled={kaydediyor}
          >
            {kaydediyor ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="check" size={20} color="#fff" />
                <Text style={styles.kaydetText}>Adresi kaydet</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
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
  hapSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  hap: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: shape.full,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  hapSel: { backgroundColor: colors.primaryContainer, borderColor: 'transparent' },
  hapText: { fontSize: 12.5, fontWeight: '700', color: colors.onSurfaceVariant },
  hapTextSel: { color: colors.primary },
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
  varsayilanSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    padding: 14,
    borderRadius: shape.md,
    backgroundColor: colors.surfaceContainerLowest,
    ...elevation.level1,
  },
  varsayilanBaslik: { fontSize: 13.5, fontWeight: '800', color: colors.onSurface },
  varsayilanAlt: { fontSize: 11.5, fontWeight: '500', color: colors.onSurfaceVariant, marginTop: 3 },
  gizlilik: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: shape.md,
    backgroundColor: colors.accentContainer,
    marginTop: 12,
  },
  gizlilikBaslik: { fontSize: 13.5, fontWeight: '800', color: colors.onSurface },
  gizlilikText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
    lineHeight: 17,
    marginTop: 4,
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
  kaydetText: { color: '#fff', fontWeight: '800', fontSize: 14.5 },
});
