import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BosDurum } from '../components/BosDurum';
import { uyar } from '../components/Dialog';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Address, deleteAddress, loadAddresses, setDefaultAddress } from '../lib/addresses';
import { colors, elevation, shape } from '../theme/tokens';

/**
 * Adres defteri.
 *
 * ## Bu ekran bir kararın tersine döndüğü yer
 *
 * Burada bir zamanlar iki sahte adres duruyordu ("Emrah Atabek · Caferağa Mah.
 * Moda Cad. No:12 D:4"); sonra onlar silindi ve yerine defterin **neden
 * olmadığını** anlatan bir not kondu: "Kargo adresin ödeme adımında alınır ve
 * yalnızca o gönderi için kullanılır." Not doğruydu — adres gerçekten
 * saklanmıyordu.
 *
 * 2026-08-18'de karar değişti: adres saklanıyor, düzenlenebiliyor,
 * silinebiliyor ve birden fazla olabiliyor. Ekran artık defterin kendisi.
 * Değişmeyen şey T.C. kimlik numarası: hâlâ saklanmıyor ve bunu söylemeye
 * devam ediyoruz, çünkü "adres saklanıyorsa kimlik numaram da saklanıyordur"
 * makul ama yanlış bir çıkarım.
 */
export default function Addresses() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [liste, setListe] = useState<Address[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [tazeleniyor, setTazeleniyor] = useState(false);
  const [islemde, setIslemde] = useState<string | null>(null);

  const tazele = useCallback(async () => {
    setListe(await loadAddresses());
    setYukleniyor(false);
  }, []);

  /* `useFocusEffect`: form ekranından geri dönüldüğünde liste tazelenmeli.
     `useEffect(..., [])` ile kaydedilen adres listede görünmezdi ve kullanıcı
     kaydın düştüğünü sanırdı. */
  useFocusEffect(
    useCallback(() => {
      tazele();
    }, [tazele]),
  );

  function sil(a: Address) {
    uyar('Adresi sil', `“${a.baslik}” adresi silinecek.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          setIslemde(a.id);
          const sonuc = await deleteAddress(a.id);
          setIslemde(null);
          if (!sonuc.ok) {
            uyar('Silinemedi', sonuc.message);
            return;
          }
          await tazele();
        },
      },
    ]);
  }

  async function varsayilanYap(a: Address) {
    setIslemde(a.id);
    const sonuc = await setDefaultAddress(a.id);
    setIslemde(null);
    if (!sonuc.ok) {
      uyar('Değiştirilemedi', sonuc.message);
      return;
    }
    await tazele();
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Adreslerim & kargo</Text>
        <View style={styles.iconBtn} />
      </View>

      {yukleniyor ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 30 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={tazeleniyor}
              onRefresh={async () => {
                setTazeleniyor(true);
                await tazele();
                setTazeleniyor(false);
              }}
              tintColor={colors.primary}
            />
          }
        >
          {liste.length === 0 ? (
            <BosDurum
              ikon="location-on"
              baslik="Kayıtlı adresin yok"
              metin="Adres eklersen ödeme adımında her seferinde yeniden yazmak zorunda kalmazsın."
              cta="Adres ekle"
              onCta={() => router.push('/address-edit')}
            />
          ) : (
            liste.map((a) => (
              <View key={a.id} style={[styles.card, islemde === a.id && styles.cardOff]}>
                <View style={styles.cardHead}>
                  <View style={styles.labelChip}>
                    <MaterialIcons
                      name={simge(a.baslik)}
                      size={14}
                      color={colors.onSecondaryContainer}
                    />
                    <Text style={styles.labelText}>{a.baslik}</Text>
                  </View>
                  {a.varsayilan && (
                    <View style={styles.defaultChip}>
                      <Text style={styles.defaultText}>Varsayılan</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }} />
                  {/* İki ayrı düğme, ikisi de gerçekten çalışıyor. Burada bir
                      tur boyunca `Pressable` olmayan bir kalem simgesi
                      duruyordu — dokunmaya cevap vermeyen, çizilmiş bir
                      düğme. */}
                  <Pressable
                    onPress={() => router.push({ pathname: '/address-edit', params: { id: a.id } })}
                    hitSlop={10}
                    style={styles.duzenleBtn}
                    accessibilityLabel={`${a.baslik} adresini düzenle`}
                  >
                    <MaterialIcons name="edit" size={17} color={colors.primary} />
                  </Pressable>
                  <Pressable
                    onPress={() => sil(a)}
                    hitSlop={10}
                    style={styles.silBtn}
                    disabled={islemde === a.id}
                    accessibilityLabel={`${a.baslik} adresini sil`}
                  >
                    {islemde === a.id ? (
                      <ActivityIndicator size="small" color={colors.error} />
                    ) : (
                      <MaterialIcons name="delete-outline" size={18} color={colors.error} />
                    )}
                  </Pressable>
                </View>
                <Text style={styles.name}>{a.adSoyad}</Text>
                <Text style={styles.line}>
                  {a.acikAdres}
                  {'\n'}
                  {a.ilce}, {a.il}
                </Text>
                {a.telefon ? <Text style={styles.phone}>{a.telefon}</Text> : null}

                {!a.varsayilan && (
                  <Pressable
                    style={styles.varsayilanYap}
                    onPress={() => varsayilanYap(a)}
                    disabled={islemde === a.id}
                  >
                    <MaterialIcons name="star-outline" size={16} color={colors.primary} />
                    <Text style={styles.varsayilanYapText}>Varsayılan yap</Text>
                  </Pressable>
                )}
              </View>
            ))
          )}

          {liste.length > 0 && (
            <Pressable style={styles.addBtn} onPress={() => router.push('/address-edit')}>
              <MaterialIcons name="add" size={20} color={colors.primary} />
              <Text style={styles.addText}>Yeni adres ekle</Text>
            </Pressable>
          )}

          <View style={styles.note}>
            <MaterialIcons name="local-shipping" size={17} color={colors.primary} style={styles.noteIc} />
            <View style={{ flex: 1 }}>
              <Text style={styles.noteBaslik}>Gönderini uygulamadan yönet</Text>
              <Text style={styles.noteText}>
                Anlaşmalı kargo kaydını uygulama içinden oluşturabilir, gönderi durumunu
                buradan takip edebilirsin.
              </Text>
            </View>
          </View>

          {/* İkinci kart mor: tasarımda da öyle ve gerekçesi var — biri
              "ne yapabilirsin", öteki "seninle ilgili ne yapıyoruz". Mor,
              paletin ikincil vurgusu ve büyük yüzeye sürülmüyor.
              Metin karar değişince yeniden yazıldı: eskiden "adresin
              profilinde saklanmaz" diyordu ve artık saklanıyor. Yayında duran
              bir cümlenin yanlış hâle gelmesi, özelliğin kendisinden daha
              büyük bir kusur. */}
          <View style={styles.gizlilik}>
            <MaterialIcons name="lock-outline" size={17} color={colors.accent} style={styles.noteIc} />
            <View style={{ flex: 1 }}>
              <Text style={styles.gizlilikBaslik}>Adresini kimse görmez</Text>
              <Text style={styles.gizlilikText}>
                Kayıtlı adreslerin yalnızca senin hesabında durur; ilanlarında ve
                mesajlarında görünmez. Karşı tarafa yalnızca gönderi oluşturulduğunda,
                kargo etiketi için iletilir. T.C. kimlik numarası burada tutulmaz —
                fatura için her ödemede ayrıca sorulur.
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

/** Başlığa göre simge. Serbest başlıklarda nötr bir yer imi. */
function simge(baslik: string): keyof typeof MaterialIcons.glyphMap {
  const b = baslik.toLocaleLowerCase('tr-TR');
  if (b.includes('ev')) return 'home';
  if (b.includes('ofis') || b.includes('iş')) return 'work';
  return 'place';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 6 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: shape.md,
    padding: 16,
    marginBottom: 12,
    ...elevation.level1,
  },
  cardOff: { opacity: 0.55 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  labelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: shape.full,
    backgroundColor: colors.secondaryContainer,
  },
  labelText: { fontSize: 12, fontWeight: '700', color: colors.onSecondaryContainer },
  defaultChip: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: shape.full,
    backgroundColor: colors.primaryContainer,
    justifyContent: 'center',
  },
  defaultText: { fontSize: 11, fontWeight: '700', color: colors.onPrimaryContainer },
  duzenleBtn: {
    width: 32,
    height: 32,
    borderRadius: shape.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryContainer,
  },
  silBtn: {
    width: 32,
    height: 32,
    borderRadius: shape.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorContainer,
  },
  name: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  line: { fontSize: 13, color: colors.onSurfaceVariant, fontWeight: '500', lineHeight: 19, marginTop: 4 },
  phone: { fontSize: 13, color: colors.onSurfaceVariant, fontWeight: '600', marginTop: 6 },
  varsayilanYap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: shape.full,
    backgroundColor: colors.primaryContainer,
    marginTop: 12,
  },
  varsayilanYapText: { fontSize: 12, fontWeight: '800', color: colors.primary },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: shape.full,
    borderWidth: 1,
    borderColor: colors.outline,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  note: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: shape.md,
    backgroundColor: colors.primaryContainer,
    marginTop: 18,
  },
  noteIc: { marginTop: 1 },
  noteBaslik: { fontSize: 13.5, fontWeight: '800', color: colors.onPrimaryContainer },
  noteText: { fontSize: 12, color: colors.onPrimaryContainer, fontWeight: '500', lineHeight: 17, marginTop: 4 },
  gizlilik: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: shape.md,
    backgroundColor: colors.accentContainer,
    marginTop: 10,
  },
  gizlilikBaslik: { fontSize: 13.5, fontWeight: '800', color: colors.onSurface },
  gizlilikText: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500', lineHeight: 17, marginTop: 4 },
});
