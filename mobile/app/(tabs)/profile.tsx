import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { colors, elevation, shape } from '../../theme/tokens';

const LISTINGS = [
  { img: require('../../assets/products/product-wooden-blocks.jpg'), pts: 420 },
  { img: require('../../assets/products/product-color-sorter.jpg'), pts: 260 },
  { img: require('../../assets/products/product-rings-close.jpg'), pts: 300 },
];

const SETTINGS: { icon: keyof typeof MaterialIcons.glyphMap; label: string; href: string }[] = [
  { icon: 'local-shipping', label: 'Adreslerim & kargo', href: '/addresses' },
  { icon: 'verified-user', label: 'Güvenlik & doğrulama', href: '/security' },
  { icon: 'card-giftcard', label: 'Davet et & kazan', href: '/invite' },
  { icon: 'help', label: 'Yardım & güvenli havuz', href: '/help' },
];

/** Güven skoru halkası — SVG ile dairesel ilerleme (96%). */
function TrustRing({ score }: { score: number }) {
  const size = 74;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score / 100;
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
      <Text style={styles.ringNum}>{score}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  // Oturum varsa e-postadan ad türet; yoksa demo isim
  const email = user?.email ?? null;
  const displayName = email ? email.split('@')[0] : 'Emrah Atabek';
  const parts = displayName.split(/[\s._-]+/).filter(Boolean);
  const initials = (parts.length > 1 ? parts[0][0] + parts[1][0] : displayName.slice(0, 2)).toUpperCase();
  const memberLine = email ? email : 'Kadıköy, İstanbul · 2024\'ten beri';
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <View style={styles.iconBtn} />
        <Text style={styles.appTitle}>Profil</Text>
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
          {/* Güven kartı */}
          <View style={styles.trust}>
            <TrustRing score={96} />
            <View style={{ flex: 1 }}>
              <View style={styles.trustHead}>
                <MaterialIcons name="workspace-premium" size={17} color={colors.gold} />
                <Text style={styles.trustTitle}>Yüksek güven skoru</Text>
              </View>
              <Text style={styles.trustText}>
                Zamanında kargo, düşük itiraz ve paketleme kanıtı skorunu yükseltir. Üst %8'desin.
              </Text>
            </View>
          </View>

          {/* İstatistikler */}
          <View style={styles.stats3}>
            <Stat value="38" label="Başarılı takas" />
            <Stat value="1.260" label="Takas Puanı" />
            <Stat value="4.9" label="★ Değerlendirme" />
          </View>

          {/* Hesabım — Takaslar & Cüzdan buraya taşındı */}
          <Text style={styles.secTitle}>Hesabım</Text>
          <View style={styles.account}>
            <Pressable style={styles.accRow} onPress={() => router.push('/wallet')}>
              <View style={[styles.accIc, { backgroundColor: colors.primaryContainer }]}>
                <MaterialIcons name="account-balance-wallet" size={22} color={colors.onPrimaryContainer} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accTitle}>Cüzdanım</Text>
                <Text style={styles.accSub}>1.260 puan · 360 havuzda</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.accRow} onPress={() => router.push('/trades')}>
              <View style={[styles.accIc, { backgroundColor: colors.secondaryContainer }]}>
                <MaterialIcons name="swap-horiz" size={22} color={colors.onSecondaryContainer} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accTitle}>Takaslarım</Text>
                <Text style={styles.accSub}>1 aktif takas · güvenli havuz</Text>
              </View>
              <View style={styles.accBadge}>
                <Text style={styles.accBadgeText}>1</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.accRow} onPress={() => router.push('/messages')}>
              <View style={[styles.accIc, { backgroundColor: colors.tertiaryContainer }]}>
                <MaterialIcons name="chat-bubble-outline" size={20} color={colors.onTertiaryContainer} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accTitle}>Mesajlarım</Text>
                <Text style={styles.accSub}>2 okunmamış mesaj</Text>
              </View>
              <View style={styles.accBadge}>
                <Text style={styles.accBadgeText}>2</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
            </Pressable>
          </View>

          {/* İlanlar */}
          <View style={styles.sec}>
            <Text style={styles.secTitle}>İlanlarım</Text>
            <Text style={styles.secLink}>Tümü</Text>
          </View>
          <View style={styles.miniGrid}>
            {LISTINGS.map((l, i) => (
              <View key={i} style={styles.mini}>
                <Image source={l.img} style={{ width: '100%', height: '100%' }} />
                <View style={styles.miniPts}>
                  <Text style={styles.miniPtsText}>{l.pts}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Ayarlar */}
          {SETTINGS.map((s) => (
            <View key={s.label}>
              <Pressable style={styles.setrow} onPress={() => router.push(s.href)}>
                <View style={styles.si}>
                  <MaterialIcons name={s.icon} size={21} color={colors.onSurfaceVariant} />
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
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 6 },
  appTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  head: { paddingHorizontal: 18, paddingTop: 6 },
  cover: { borderRadius: shape.lg, paddingTop: 26, paddingBottom: 20, paddingHorizontal: 16 },
  id: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  av: {
    width: 72,
    height: 72,
    borderRadius: shape.full,
    backgroundColor: colors.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  avText: { fontSize: 26, fontWeight: '800', color: '#fff' },
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
  name: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: '#fff' },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  loc: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500' },
  trust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: shape.md,
    padding: 16,
    marginVertical: 18,
    ...elevation.level1,
  },
  ringNum: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5, color: colors.onSurface },
  trustHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustTitle: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  trustText: { fontSize: 12.5, color: colors.onSurfaceVariant, lineHeight: 18, fontWeight: '500', marginTop: 5 },
  stats3: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  stat: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: shape.md,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    ...elevation.level1,
  },
  statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, color: colors.onSurface },
  statLabel: { fontSize: 11.5, color: colors.onSurfaceVariant, fontWeight: '600', marginTop: 2 },
  account: { backgroundColor: colors.surfaceContainerLow, borderRadius: shape.md, marginTop: 12, marginBottom: 20, paddingHorizontal: 14, ...elevation.level1 },
  accRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13 },
  accIc: { width: 44, height: 44, borderRadius: shape.full, alignItems: 'center', justifyContent: 'center' },
  accTitle: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  accSub: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500', marginTop: 2 },
  accBadge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: shape.full, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  accBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  sec: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 },
  secTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
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
  setrow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15 },
  si: {
    width: 40,
    height: 40,
    borderRadius: shape.sm,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  st: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.onSurface },
  divider: { height: 1, backgroundColor: colors.outlineVariant, opacity: 0.55 },
});
