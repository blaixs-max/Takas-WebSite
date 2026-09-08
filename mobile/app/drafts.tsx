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
import { DraftListing, deleteListing, loadDrafts } from '../lib/listings';
import { withdrawListing } from '../lib/photos';
import { colors, elevation, shape } from '../theme/tokens';

/**
 * Yayında olmayan ilanlar: taslaklar ve incelemedekiler.
 *
 * Bu ekran bir çıkmazı kapatıyor. Çekim akışına yalnızca ilan oluşturulduktan
 * hemen sonra giriliyordu; oradan çıkan kullanıcı taslak ilanına bir daha
 * ulaşamıyor, gönderecek düğmeyi hiçbir yerde bulamıyordu.
 *
 * 2026-09-08'den beri ikinci bir iş daha var: onaya gönderilen ilan burada
 * "İncelemede" olarak durur, satıcı isterse geri çeker; reddedilen ilanın
 * gerekçesi de burada okunur. Yani "gönderdim, ne oldu?" sorusunun cevabı bu
 * liste.
 */
export default function Drafts() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [liste, setListe] = useState<DraftListing[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [tazeleniyor, setTazeleniyor] = useState(false);
  /** İşlem gören satırın kimliği — o kart tıklanamaz ve dönen bir gösterge taşır. */
  const [islemde, setIslemde] = useState<string | null>(null);

  const tazele = useCallback(async () => {
    setListe(await loadDrafts());
    setYukleniyor(false);
  }, []);

  /* Odakta tazeleniyor: çekim ekranından ya da düzenlemeden dönen kullanıcı
     güncel durumu görmeli. Ekran yığında altta kalıyor, `useEffect` bir daha
     çalışmazdı — bu depoda beş kez çıkan kusur. */
  useFocusEffect(
    useCallback(() => {
      tazele();
    }, [tazele]),
  );

  /** Karta dokunmak sıradaki işe götürür: kare çekimi. İncelemedeki ilana dokunmak bir şey yapmaz. */
  function ac(d: DraftListing) {
    if (d.status === 'IN_REVIEW') return;
    router.push({
      pathname: '/listing-photos',
      params: {
        id: d.id,
        hasDamage: d.hasDamage ? '1' : '0',
        isSet: d.isSet ? '1' : '0',
        title: d.title,
      },
    });
  }

  function duzenle(d: DraftListing) {
    router.push({ pathname: '/add-listing', params: { id: d.id } });
  }

  /**
   * Geri çekme: incelemedeki ilan taslağa döner ve yeniden düzenlenebilir.
   * Yönetici o sırada bakıyor olabilir; geri çekilen ilan kuyruktan düşer.
   */
  function geriCek(d: DraftListing) {
    uyar('İlanı geri çek', `“${d.title}” incelemeden çıkarılıp taslağa dönecek. Düzeltip yeniden gönderebilirsin.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Geri çek',
        onPress: async () => {
          setIslemde(d.id);
          const sonuc = await withdrawListing(d.id);
          setIslemde(null);
          if (!sonuc.ok) {
            uyar('Geri çekilemedi', sonuc.message);
            return;
          }
          await tazele();
        },
      },
    ]);
  }

  /**
   * Silme, onaydan geçiyor ve onay ilanın adını söylüyor — satırlar birbirine
   * benziyor, yanlış satıra bastığını başlık kutuda yazınca fark edersin.
   */
  function sil(d: DraftListing) {
    uyar('İlanı kaldır', `“${d.title}” kaldırılacak. Bu geri alınamaz.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Kaldır',
        style: 'destructive',
        onPress: async () => {
          setIslemde(d.id);
          const sonuc = await deleteListing(d.id);
          setIslemde(null);
          if (!sonuc.ok) {
            uyar('Kaldırılamadı', sonuc.message);
            return;
          }
          /* Liste yeniden okunuyor, satır elle çıkarılmıyor: sunucu ilanı
             gerçekten kaldırdı mı sorusunun cevabı sunucuda. */
          await tazele();
        },
      },
    ]);
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Taslak ilanlar</Text>
      </View>

      {yukleniyor ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
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
              ikon="inventory-2"
              baslik="Taslak ilanın yok"
              metin="Yarım bıraktığın ve onay bekleyen ilanlar burada görünür."
              cta="Yeni ilan oluştur"
              onCta={() => router.replace('/add-listing')}
            />
          ) : (
            liste.map((d) => {
              const incelemede = d.status === 'IN_REVIEW';
              return (
                <View key={d.id} style={[styles.card, islemde === d.id && styles.cardOff]}>
                  <Pressable
                    style={styles.cardUst}
                    onPress={() => ac(d)}
                    disabled={islemde === d.id || incelemede}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.baslikSatir}>
                        <Text style={styles.title} numberOfLines={1}>
                          {d.title}
                        </Text>
                        {incelemede && (
                          <View style={styles.rozet}>
                            <MaterialIcons name="hourglass-top" size={12} color={colors.onTertiaryContainer} />
                            <Text style={styles.rozetText}>İncelemede</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.sub}>{durumMetni(d)}</Text>
                    </View>

                    {!incelemede && (
                      <>
                        <Pressable
                          onPress={() => duzenle(d)}
                          hitSlop={10}
                          style={styles.duzenleBtn}
                          accessibilityLabel={`${d.title} ilanını düzenle`}
                        >
                          <MaterialIcons name="edit" size={18} color={colors.primary} />
                        </Pressable>
                        {/* Sil kırmızı zeminli: düzenlemeyle aynı renkte olsaydı
                            geri alınamayan olan yanlışlıkla seçilirdi. */}
                        <Pressable
                          onPress={() => sil(d)}
                          hitSlop={10}
                          style={styles.silBtn}
                          disabled={islemde === d.id}
                          accessibilityLabel={`${d.title} ilanını kaldır`}
                        >
                          {islemde === d.id ? (
                            <ActivityIndicator size="small" color={colors.error} />
                          ) : (
                            <MaterialIcons name="delete-outline" size={19} color={colors.error} />
                          )}
                        </Pressable>
                        <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
                      </>
                    )}
                  </Pressable>

                  {/* Yöneticinin ret gerekçesi. Kırmızı kutu: satıcının burada
                      yapacağı bir iş var ve ne olduğu yazılı. */}
                  {!incelemede && d.reviewReason && (
                    <View style={styles.gerekce}>
                      <MaterialIcons name="edit-note" size={18} color={colors.error} />
                      <Text style={styles.gerekceText}>{d.reviewReason}</Text>
                    </View>
                  )}

                  {incelemede && (
                    <View style={styles.incelemeAlt}>
                      <Text style={styles.incelemeText}>
                        Ekibimiz bakıyor; onaylanınca vitrine çıkar ve bildirim gelir.
                      </Text>
                      <Pressable
                        style={styles.geriCekBtn}
                        onPress={() => geriCek(d)}
                        disabled={islemde === d.id}
                      >
                        {islemde === d.id ? (
                          <ActivityIndicator size="small" color={colors.onSurface} />
                        ) : (
                          <Text style={styles.geriCekText}>Geri çek</Text>
                        )}
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

/** Kullanıcıya sıradaki işi söyler — "taslak" demek tek başına bir şey anlatmaz. */
function durumMetni(d: DraftListing): string {
  if (d.status === 'IN_REVIEW') {
    return d.submittedAt ? `Onaya gönderildi · ${gecenSure(d.submittedAt)}` : 'Onaya gönderildi';
  }
  if (d.reviewReason) {
    return 'Düzeltme istendi · düzeltip yeniden gönder';
  }
  if (d.reddedilenKare > 0) {
    return `${d.reddedilenKare} kare kabul edilmedi · yeniden çekilmeli`;
  }
  if (d.cekilenKare < d.gerekenKare) {
    return `${d.cekilenKare}/${d.gerekenKare} kare çekildi`;
  }
  return 'Kareler hazır · onaya gönderilebilir';
}

/** Göreli zaman — Hermes'te Intl güvenilir değil, elle yazıyoruz. */
function gecenSure(iso: string): string {
  const dk = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (dk < 1) return 'az önce';
  if (dk < 60) return `${dk} dk önce`;
  const saat = Math.floor(dk / 60);
  if (saat < 24) return `${saat} saat önce`;
  return `${Math.floor(saat / 24)} gün önce`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.surface,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: colors.onSurface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 18, gap: 10 },
  card: {
    padding: 14,
    borderRadius: shape.lg,
    backgroundColor: colors.surfaceContainerLowest,
    ...elevation.level1,
  },
  cardUst: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardOff: { opacity: 0.5 },
  baslikSatir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rozet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: shape.full,
    backgroundColor: colors.tertiaryContainer,
  },
  rozetText: { fontSize: 11, fontWeight: '800', color: colors.onTertiaryContainer },
  duzenleBtn: {
    width: 36,
    height: 36,
    borderRadius: shape.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryContainer,
  },
  silBtn: {
    width: 36,
    height: 36,
    borderRadius: shape.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorContainer,
  },
  title: { flexShrink: 1, fontSize: 14, fontWeight: '800', color: colors.onSurface },
  sub: { fontSize: 11.5, fontWeight: '500', color: colors.onSurfaceVariant, marginTop: 3 },
  gerekce: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    padding: 11,
    borderRadius: shape.sm,
    backgroundColor: colors.errorContainer,
  },
  gerekceText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: colors.onSurface },
  incelemeAlt: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  incelemeText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '500', color: colors.onSurfaceVariant },
  geriCekBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: shape.full,
    borderWidth: 1.5,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  geriCekText: { fontSize: 12.5, fontWeight: '700', color: colors.onSurface },
});
