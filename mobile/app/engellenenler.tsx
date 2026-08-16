import { useCallback, useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BosDurum } from '../components/BosDurum';
import { uyar } from '../components/Dialog';
import { gecenSure } from '../lib/notifications';
import { loadBlocks, unblockUser, type BlockRow } from '../lib/messages';
import { supabaseConfigured } from '../lib/supabase';
import { colors, shape } from '../theme/tokens';

/**
 * Engellediklerim.
 *
 * ## Neden var
 *
 * Engelleme sohbet ekranından yapılabiliyordu ama geri alınamıyordu:
 * `block_user` / `unblock_user` sunucuda duruyor, kullanıcının kimi
 * engellediğini görebileceği bir yer yoktu. Yani engelleme tek yönlü bir
 * kapıydı — açan var, kapatan yok. Öfkeyle ya da yanlışlıkla basılan bir
 * düğme kalıcı bir sonuç doğuruyordu ve kullanıcının elinde düzeltecek
 * hiçbir şey yoktu.
 *
 * ## Neden isim yazmıyor
 *
 * Satırlarda ad değil **bağlam** var: "Suluk ilanının satıcısı". Uygulama
 * karşı tarafın adını zaten göstermiyor — `my_conversations` alıcıya
 * satıcının adını veriyor ama satıcıya alıcı için düz "Alıcı" yazıyor — ve
 * `profiles` üzerinde yalnızca kendi profilini okuyabiliyorsun. Burada isim
 * basmak, uygulamanın başka hiçbir yerinde vermediği bir veriyi tek bir
 * ekranda vermek olurdu. Kullanıcının hatırlaması için gereken şey zaten
 * kimlik değil, o kişiyle nerede karşılaştığı.
 *
 * Ortak sohbet bulunamazsa (sohbet silinmişse) bağlam boş dönüyor ve satır
 * yalnızca tarihi gösteriyor. Uydurma bir etiket yazmaktansa eksik bilgiyi
 * eksik göstermek doğru: kullanıcı yine de engeli kaldırabiliyor.
 */
export default function Engellenenler() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [liste, setListe] = useState<BlockRow[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  /* Hangi satırın işlemde olduğu tutuluyor, tek bir boolean değil: iki satıra
     arka arkaya basıldığında ikisinin birden "Kaldırılıyor…" olması yanlış
     bilgi verirdi. */
  const [islemde, setIslemde] = useState<string | null>(null);

  const getir = useCallback(async () => {
    setListe(await loadBlocks());
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    void getir();
  }, [getir]);

  async function yenile() {
    setYenileniyor(true);
    await getir();
    setYenileniyor(false);
  }

  function kaldirmayiSor(satir: BlockRow) {
    uyar(
      'Engeli kaldır',
      'Bu kişiyle tekrar mesajlaşabileceksiniz. İstediğiniz zaman yeniden engelleyebilirsiniz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Engeli kaldır', onPress: () => void kaldir(satir) },
      ],
    );
  }

  async function kaldir(satir: BlockRow) {
    setIslemde(satir.id);
    const sonuc = await unblockUser(satir.id);
    setIslemde(null);
    if (!sonuc.ok) {
      uyar('Kaldırılamadı', sonuc.message);
      return;
    }
    /* Satır elde düşürülüyor, liste yeniden çekilmiyor: sunucu onayladı,
       tek değişen bu satır ve bir ağ turu beklemek dokunuşu geç
       hissettirirdi. Yanlış giderse zaten yukarıdaki uyarı çıkıyor. */
    setListe((eski) => eski.filter((s) => s.id !== satir.id));
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()} hitSlop={6}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Engellediklerim</Text>
        <View style={styles.iconBtn} />
      </View>

      {yukleniyor ? (
        <View style={styles.orta}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !supabaseConfigured ? (
        <BosDurum
          ikon="cloud-off"
          baslik="Bağlantı yok"
          metin="Engel listesi için sunucuya bağlanmak gerekiyor. Bağlantını kontrol edip tekrar dene."
        />
      ) : liste.length === 0 ? (
        <BosDurum
          ikon="block"
          baslik="Kimseyi engellemedin"
          metin="Bir sohbette rahatsız olursan karşı tarafı engelleyebilirsin. Engellediklerin burada görünür."
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 18, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={yenileniyor} onRefresh={yenile} tintColor={colors.primary} />
          }
        >
          <Text style={styles.aciklama}>
            Engellediğin kişiyle iki yönde de mesajlaşma kapalıdır. Sohbet geçmişi silinmez —
            bir uyuşmazlıkta konuşma kaydı gerekebilir.
          </Text>

          <View style={styles.group}>
            {liste.map((s, i) => (
              <View key={s.id}>
                <View style={styles.row}>
                  <View style={styles.ic}>
                    <MaterialIcons name="block" size={20} color={colors.onSurfaceVariant} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{s.baglam ?? 'Engellenen kişi'}</Text>
                    <Text style={styles.rowSub}>
                      {s.engellendiAt ? `${gecenSure(s.engellendiAt)} önce engellendi` : 'Engellendi'}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.kaldir}
                    onPress={() => kaldirmayiSor(s)}
                    disabled={islemde === s.id}
                    accessibilityRole="button"
                    accessibilityLabel="Engeli kaldır"
                  >
                    <Text style={styles.kaldirText}>
                      {islemde === s.id ? 'Kaldırılıyor…' : 'Kaldır'}
                    </Text>
                  </Pressable>
                </View>
                {i < liste.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: colors.onSurface },
  orta: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  aciklama: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  group: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: shape.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  ic: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  rowSub: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2, fontWeight: '500' },
  kaldir: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  kaldirText: { fontSize: 12.5, fontWeight: '800', color: colors.primary },
  divider: { height: 1, backgroundColor: colors.outlineVariant, marginLeft: 62 },
});
