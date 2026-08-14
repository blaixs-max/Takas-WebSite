import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { BOS_PROFIL, Profile, basHarfler, loadProfile } from '../../lib/profile';
import { unreadMessageCount } from '../../lib/messages';
import { amIAdmin } from '../../lib/admin';
import { loadDrafts } from '../../lib/listings';
import {
  ProfileStats,
  Sanction,
  binlik,
  loadProfileStats,
  loadSanction,
  trustGerekceleri,
  yaptirimMetni,
} from '../../lib/profile';
import { colors, elevation, shape } from '../../theme/tokens';


const SETTINGS: { icon: keyof typeof MaterialIcons.glyphMap; label: string; href: Href }[] = [
  { icon: 'local-shipping', label: 'Adreslerim & kargo', href: '/addresses' },
  /* Bildirimler bu listede yoktu: ekran vardı, ona giden tek yol anasayfanın
     zil simgesiydi. Tasarımda ve rehber 08'in menüsünde burada duruyor. */
  { icon: 'notifications-none', label: 'Bildirimler', href: '/notifications' },
  { icon: 'verified-user', label: 'Güvenlik & doğrulama', href: '/security' },
  { icon: 'card-giftcard', label: 'Davet et & kazan', href: '/invite' },
  /* Rehber 08: "Yardım & Güvenli Havuz" — Güvenli Havuz'un iki kelimesi de
     büyük harfle başlar (marka terimi). */
  { icon: 'help', label: 'Yardım & Güvenli Havuz', href: '/help' },
];

/** Güven skoru halkası — SVG ile dairesel ilerleme (96%). */
function TrustRing({ score }: { score: number | null }) {
  const size = 74;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = (score ?? 0) / 100;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceContainerHighest} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.primary}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
        />
      </Svg>
      <Text style={styles.ringNum}>{score === null ? '—' : score}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [yonetici, setYonetici] = useState(false);
  const [istatistik, setIstatistik] = useState<ProfileStats | null>(null);
  const [yaptirim, setYaptirim] = useState<Sanction | null>(null);
  const [taslak, setTaslak] = useState(0);

  useEffect(() => {
    let iptal = false;
    amIAdmin().then((ok) => {
      if (!iptal) setYonetici(ok);
    });
    loadProfileStats().then((st) => {
      if (!iptal) setIstatistik(st);
    });
    loadSanction().then((y) => {
      if (!iptal) setYaptirim(y);
    });
    loadDrafts().then((d) => {
      if (!iptal) setTaslak(d.length);
    });
    return () => {
      iptal = true;
    };
  }, [user]);

  /* Ad profilden geliyor. Eskiden e-postanın kullanıcı adı kısmı
     gösteriliyordu ("emrahatabek"), oturum yoksa da sabit bir demo isim. */
  const [profil, setProfil] = useState<Profile>(BOS_PROFIL);
  useEffect(() => {
    let iptal = false;
    loadProfile().then((pr) => {
      if (!iptal) setProfil(pr);
    });
    return () => {
      iptal = true;
    };
  }, [user]);

  /**
   * "Mesajlarım" satırındaki okunmamış sayısı.
   *
   * Rozet önce sabit "2" yazıyordu — Mesajlarım ekranı boşken bile. Gerçek
   * sayıya bağlandı, ama **yanlış** sayaca: `unreadCount()` bildirimleri
   * sayıyor, mesajları değil. İlan yayına alındığında bildirim düşüyor, mesaj
   * düşmüyor; satır "1 okunmamış mesaj" diyordu ve gelen kutusu boştu.
   * Sayı artık sohbetlerin okunmamış toplamından geliyor.
   *
   * `useFocusEffect`: ekrana her dönüşte tazeleniyor. `useEffect` yalnızca
   * ekran ilk kurulduğunda koşuyordu ve sekme ekranları arka planda canlı
   * kaldığı için mesajları okuyup dönmek sayıyı düşürmüyordu.
   */
  const [okunmamis, setOkunmamis] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let iptal = false;
      unreadMessageCount().then((n) => {
        if (!iptal) setOkunmamis(n);
      });
      return () => {
        iptal = true;
      };
    }, [user]),
  );

  const email = user?.email ?? null;
  /**
   * Ad yoksa ne yazılacağı.
   *
   * Burada "Üye" yazıyordu ve rehber 08'in uygulama notu bunu **açıkça**
   * yasaklıyor: "Kullanıcı adı yerine 'Üye' yazılmaz; isim yoksa eylem odaklı
   * başlık gösterilir." Gerekçesi de sağlam — "Üye" kimseye bir şey söylemez
   * ve profilin eksik olduğunu gizler; "Profilini tamamla" hem eksikliği
   * söyler hem ne yapılacağını.
   *
   * Aynı kural karşı repodaki vitrin betiğinde tersine işliyor: orada ad
   * güvenilir değilse "Üye" yazılıyor. Çelişki değil — orası **başkasının**
   * adı ve yanlışını göstermektense hiç göstermemek doğru; burası kullanıcının
   * kendi profili ve ona yapması gerekeni söylemek doğru.
   */
  const adVar = Boolean(profil.fullName);
  const displayName = profil.fullName || 'Profilini tamamla';
  const initials = adVar ? basHarfler(profil.fullName) : '—';
  const memberLine = profil.city || (adVar ? email : null) || 'Konum ekle';
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <View style={styles.iconBtn} />
        <Text style={styles.appTitle}>Hesabım</Text>
        <Pressable style={styles.iconBtn} onPress={() => router.push('/security')}>
          <MaterialIcons name="settings" size={24} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Kapak + kimlik (tek yeşil kart) */}
        <View style={styles.head}>
          <LinearGradient colors={colors.coverGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cover}>
            <View style={styles.id}>
              <View style={styles.av}>
                <Text style={styles.avText}>{initials}</Text>
                <View style={styles.avOk}>
                  <MaterialIcons name="check" size={13} color="#fff" />
                </View>
              </View>
              <View style={styles.meta}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
                  <MaterialIcons name="verified" size={18} color="#fff" />
                </View>
                <View style={styles.locRow}>
                  <MaterialIcons name={email ? 'mail-outline' : 'place'} size={15} color="rgba(255,255,255,0.85)" />
                  <Text style={styles.loc} numberOfLines={1}>{memberLine}</Text>
                </View>
              </View>
              <Pressable style={styles.iconBtn} onPress={() => router.push('/edit-profile')}>
                <MaterialIcons name="edit" size={22} color="rgba(255,255,255,0.92)" />
              </Pressable>
            </View>
          </LinearGradient>
        </View>

        <View style={{ paddingHorizontal: 18 }}>
          {/* Yaptırım varsa en üstte: kullanıcı bunu bir işlem denerken hata
              mesajından değil, burada öğrenmeli. */}
          {yaptirim && (
            <View
              style={[
                styles.yaptirim,
                yaptirim.level === 'WARNED' && { backgroundColor: colors.tertiaryContainer },
              ]}
            >
              <MaterialIcons
                name={yaptirim.level === 'WARNED' ? 'warning-amber' : 'block'}
                size={20}
                color={colors.onSurface}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.yaptirimBaslik}>{yaptirimMetni(yaptirim).baslik}</Text>
                <Text style={styles.yaptirimMetin}>{yaptirimMetni(yaptirim).metin}</Text>
              </View>
            </View>
          )}

          {/* Güven kartı */}
          <View style={styles.trust}>
            <TrustRing score={istatistik?.trustSkor ?? null} />
            <View style={{ flex: 1 }}>
              {/* Başlığın yanındaki altın madalya kalktı: tasarımda yok ve
                  skor zaten halkanın içinde yazıyor. */}
              <Text style={styles.trustTitle}>
                {istatistik?.trustSkor == null
                  ? 'Güven skorun henüz oluşmadı'
                  : istatistik.trustSkor >= 85
                    ? 'Yüksek güven skoru'
                    : 'Güven skorun düştü'}
              </Text>
              {/* Skoru gerekçesiz göstermek, düzeltme imkânı vermemek demek. */}
              <Text style={styles.trustText}>
                {istatistik?.trustSkor == null
                  ? 'İlk takasın tamamlandığında güven skorun hesaplanmaya başlar.'
                  : trustGerekceleri(istatistik).length > 0
                    ? trustGerekceleri(istatistik).join(' · ')
                    : 'Zamanında kargo ve düşük itiraz skorunu bu seviyede tutar.'}
              </Text>
            </View>
          </View>

          {/* İstatistikler */}
          <View style={styles.stats3}>
            <Stat value={String(istatistik?.basariliTakas ?? 0)} label="Tamamlanan takas" />
            <Stat value={binlik(istatistik?.availablePoints ?? 0)} label="Takas Puanı" />
            {/* Yıldız değerlendirmesi diye bir sistem yok; 4,9 yazmak uydurmaydı. */}
            <Stat value={String(istatistik?.yayindakiIlan ?? 0)} label="Yayındaki ilan" />
          </View>

          {/* Hesabım — Takaslar & Cüzdan buraya taşındı */}
          <Text style={styles.secTitle}>Hesabım</Text>
          <View style={styles.account}>
            {/* Yalnızca yetkiliye görünür. Gizlemek bir güvenlik önlemi değil:
                yetkiyi sunucudaki is_admin() belirliyor, burası yalnızca
                gereksiz bir satırı herkese göstermemek için. */}
            {yonetici && (
              <>
                <Pressable style={styles.accRow} onPress={() => router.push('/admin')}>
                  <View style={styles.accIc}>
                    <MaterialIcons name="shield" size={19} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accTitle}>Yönetim</Text>
                    <Text style={styles.accSub}>Moderasyon kuyruğu · itirazlar</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
                </Pressable>
                <View style={styles.divider} />
              </>
            )}
            {/* Yalnızca yarım kalan ilan varsa görünür. Bu satır olmadan taslak
                bir ilana ulaşmanın hiçbir yolu yoktu: çekim akışına sadece ilan
                oluşturulduktan hemen sonra giriliyordu. */}
            {taslak > 0 && (
              <>
                <Pressable style={styles.accRow} onPress={() => router.push('/drafts')}>
                  <View style={styles.accIc}>
                    <MaterialIcons name="inventory-2" size={19} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accTitle}>Taslak ilanlar</Text>
                    <Text style={styles.accSub}>
                      {taslak} ilan yayına alınmayı bekliyor
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
                </Pressable>
                <View style={styles.divider} />
              </>
            )}
            <Pressable style={styles.accRow} onPress={() => router.push('/wallet')}>
              <View style={styles.accIc}>
                <MaterialIcons name="account-balance-wallet" size={19} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accTitle}>Cüzdanım</Text>
                <Text style={styles.accSub}>
                  {binlik(istatistik?.availablePoints ?? 0)} Takas Puanı
                  {istatistik && istatistik.heldPoints > 0
                    ? ` · ${binlik(istatistik.heldPoints)} Güvenli Havuz’da`
                    : ''}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.accRow} onPress={() => router.push('/trades')}>
              <View style={styles.accIc}>
                <MaterialIcons name="swap-horiz" size={19} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accTitle}>Takaslarım</Text>
                <Text style={styles.accSub}>
                  {istatistik && istatistik.aktifTakas > 0
                    ? `${istatistik.aktifTakas} aktif takas · güvenli havuz`
                    : 'Aktif takasın yok'}
                </Text>
              </View>
              {istatistik && istatistik.aktifTakas > 0 && (
                <View style={styles.accBadge}>
                  <Text style={styles.accBadgeText}>{istatistik.aktifTakas}</Text>
                </View>
              )}
              <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.accRow} onPress={() => router.push('/messages')}>
              <View style={styles.accIc}>
                <MaterialIcons name="chat-bubble-outline" size={19} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accTitle}>Mesajlarım</Text>
                <Text style={styles.accSub}>
                  {okunmamis > 0 ? `${okunmamis} okunmamış mesaj` : 'Okunmamış mesajın yok'}
                </Text>
              </View>
              {okunmamis > 0 && (
                <View style={styles.accBadge}>
                  <Text style={styles.accBadgeText}>{okunmamis}</Text>
                </View>
              )}
              <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
            </Pressable>
          </View>

          {/* İlanlar
              Burada üç sabit ürün fotoğrafı duruyordu; hemen üstteki sayaç
              "Yayındaki ilan 0" derken. Ekran kendi kendisiyle çelişiyordu.
              Şerit ancak gerçekten yayında ilan varsa açılıyor. */}
          {(istatistik?.yayindakiIlan ?? 0) > 0 && (
            <>
              {/* "Tümü" kalktı: hemen altındaki kutu zaten rafa götüren
                  gerçek düğme. İkisinden biri çalışıyordu, diğeri süstü. */}
              <View style={styles.sec}>
                <Text style={styles.secTitle}>İlanlarım</Text>
              </View>
              <Pressable style={styles.ilanKutu} onPress={() => router.push('/(tabs)')}>
                <MaterialIcons name="inventory-2" size={20} color={colors.onSurfaceVariant} />
                <Text style={styles.ilanKutuText}>
                  {istatistik?.yayindakiIlan} ilanın yayında
                </Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
              </Pressable>
            </>
          )}

          {/* Ayarlar */}
          {SETTINGS.map((s) => (
            <View key={s.label}>
              <Pressable style={styles.setrow} onPress={() => router.push(s.href)}>
                <View style={styles.si}>
                  <MaterialIcons name={s.icon} size={19} color={colors.primary} />
                </View>
                <Text style={styles.st}>{s.label}</Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
              </Pressable>
              <View style={styles.divider} />
            </View>
          ))}

          {/* Çıkış */}
          <Pressable style={styles.setrow} onPress={signOut}>
            <View style={[styles.si, { backgroundColor: colors.errorContainer }]}>
              <MaterialIcons name="logout" size={21} color={colors.error} />
            </View>
            <Text style={[styles.st, { color: colors.error }]}>
              {user ? 'Çıkış yap' : 'Çıkış yap (oturum yok)'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ilanKutu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    height: 56,
    borderRadius: shape.md,
    backgroundColor: colors.surfaceContainerLow,
  },
  ilanKutuText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.onSurface },
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 6 },
  appTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '800', color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  head: { paddingHorizontal: 18, paddingTop: 6 },
  cover: { borderRadius: shape.lg, paddingVertical: 18, paddingHorizontal: 14 },
  id: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  /* Zemin `tertiary` (#9E6300) idi — turuncunun koyu, kahverengiye çalan
     türevi; kapak kartının üstünde çamur gibi duruyordu. Tasarımdaki daire
     markanın turuncusu ve içindeki metin koyu: beyaz `#FFA726` üzerinde
     okunmuyor (kontrast 2.0). */
  av: {
    width: 56,
    height: 56,
    borderRadius: shape.full,
    backgroundColor: colors.tertiaryOn,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.92)',
  },
  avText: { fontSize: 18, fontWeight: '800', color: colors.onTertiaryContainer },
  avOk: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  meta: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: '#fff' },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  loc: { color: 'rgba(255,255,255,0.88)', fontSize: 11.5, fontWeight: '500' },
  yaptirim: {
    flexDirection: 'row',
    gap: 11,
    padding: 13,
    borderRadius: shape.md,
    backgroundColor: colors.errorContainer,
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  yaptirimBaslik: { fontSize: 14, fontWeight: '800', color: colors.onSurface },
  yaptirimMetin: {
    fontSize: 12.5,
    color: colors.onSurface,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 3,
  },
  /* Tasarımda güven kartı, istatistik kutuları ve menü kartı **beyaz**;
     krem zeminden gölgeyle ayrılıyorlar. Hepsi `surfaceContainerLow` idi,
     yani zeminden bir tık farklı — kart olduğu ancak dikkatle bakınca
     anlaşılıyordu. */
  trust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: shape.md,
    padding: 14,
    marginVertical: 14,
    ...elevation.level1,
  },
  ringNum: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5, color: colors.onSurface },
  trustTitle: { fontSize: 13.5, fontWeight: '800', color: colors.onSurface },
  trustText: { fontSize: 11.5, color: colors.onSurfaceVariant, lineHeight: 17, fontWeight: '500', marginTop: 4 },
  stats3: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  stat: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: shape.md,
    paddingVertical: 13,
    paddingHorizontal: 8,
    alignItems: 'center',
    ...elevation.level1,
  },
  statValue: { fontSize: 17, fontWeight: '800', letterSpacing: -0.4, color: colors.onSurface },
  statLabel: { fontSize: 9.5, color: colors.onSurfaceVariant, fontWeight: '700', marginTop: 3, textAlign: 'center' },
  account: { backgroundColor: colors.surfaceContainerLowest, borderRadius: shape.md, marginTop: 10, marginBottom: 18, paddingHorizontal: 12, ...elevation.level1 },
  accRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  accIc: { width: 36, height: 36, borderRadius: shape.sm, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  accTitle: { fontSize: 13, fontWeight: '800', color: colors.onSurface },
  accSub: { fontSize: 11, color: colors.onSurfaceVariant, fontWeight: '500', marginTop: 2 },
  accBadge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: shape.full, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  accBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  sec: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 },
  secTitle: { fontSize: 17, fontWeight: '800', color: colors.onSurface },
  secLink: { fontSize: 13, fontWeight: '700', color: colors.primary },
  miniGrid: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  mini: { flex: 1, aspectRatio: 1, borderRadius: shape.sm, overflow: 'hidden', backgroundColor: colors.surfaceContainerHigh },
  miniPts: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: shape.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
  },
  miniPtsText: { fontSize: 10, fontWeight: '800', color: colors.onSurface },
  setrow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12 },
  si: {
    width: 36,
    height: 36,
    borderRadius: shape.sm,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  st: { flex: 1, fontSize: 13, fontWeight: '800', color: colors.onSurface },
  divider: { height: 1, backgroundColor: colors.outlineVariant, opacity: 0.55 },
});
