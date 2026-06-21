import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getProduct } from '../../data/products';
import { colors, elevation, shape } from '../../theme/tokens';

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const product = getProduct(id);

  if (!product) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text>Ürün bulunamadı.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* M3 center-aligned top app bar */}
      <View style={[styles.appbar, { paddingTop: insets.top }]}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.appTitle}>Ürün</Text>
        <Pressable style={styles.iconBtn}>
          <MaterialIcons name="share" size={24} color={colors.onSurface} />
        </Pressable>
        <Pressable style={styles.iconBtn}>
          <MaterialIcons name="favorite-border" size={24} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={product.image} style={styles.heroImg} resizeMode="cover" />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{product.condition}</Text>
          </View>
        </View>

        <Text style={styles.title}>{product.title}</Text>
        <View style={styles.pointsLine}>
          <Text style={styles.points}>{product.points}</Text>
          <Text style={styles.pointsLabel}>Takas Puanı</Text>
        </View>

        <View style={styles.metaChips}>
          <Chip icon="verified" label="AI onaylı fotoğraf" />
          <Chip icon="location-on" label={product.location} />
          <Chip icon="inventory-2" label="Tüm parçalar tam" />
        </View>

        <Text style={styles.desc}>{product.description}</Text>

        {/* Satıcı */}
        <View style={styles.seller}>
          <View style={styles.sellerAv}>
            <Text style={styles.sellerAvText}>{product.seller.initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sellerName}>{product.seller.name}</Text>
            <View style={styles.sellerSub}>
              <MaterialIcons name="workspace-premium" size={15} color={colors.tertiary} />
              <Text style={styles.sellerSubText}>
                Güven skoru {product.seller.trust} · {product.seller.trades} takas
              </Text>
            </View>
          </View>
          <View style={styles.iconBtn}>
            <MaterialIcons name="chat-bubble-outline" size={22} color={colors.onSurface} />
          </View>
        </View>

        {/* Güvenli havuz kartı */}
        <View style={styles.pool}>
          <View style={styles.poolHead}>
            <MaterialIcons name="verified-user" size={22} color={colors.onPrimaryContainer} />
            <Text style={styles.poolHeadText}>Güvenli havuz korumalı</Text>
          </View>
          <Text style={styles.poolText}>
            Takas talebinde puanın güvenli havuzda bekler. Ürün eline geçip onaylayana kadar satıcıya geçmez — alıcı da
            satıcı da korunur.
          </Text>
        </View>
      </ScrollView>

      {/* M3 bottom action bar */}
      <View style={[styles.actionbar, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable style={styles.iconSquare}>
          <MaterialIcons name="bookmark-border" size={24} color={colors.onSurface} />
        </Pressable>
        <Pressable style={styles.cta}>
          <MaterialIcons name="swap-horiz" size={20} color={colors.onPrimary} />
          <Text style={styles.ctaText}>Takas et · {product.points}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Chip({ icon, label }: { icon: keyof typeof MaterialIcons.glyphMap; label: string }) {
  return (
    <View style={styles.mc}>
      <MaterialIcons name={icon} size={16} color={colors.primary} />
      <Text style={styles.mcText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: 'center', justifyContent: 'center' },
  appbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, backgroundColor: colors.surface },
  appTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: shape.lg, overflow: 'hidden', aspectRatio: 1, marginBottom: 16, ...elevation.level1 },
  heroImg: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    left: 12,
    top: 12,
    height: 28,
    paddingHorizontal: 12,
    borderRadius: shape.xs,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: colors.onSurface },
  title: { fontSize: 24, fontWeight: '700', lineHeight: 28, color: colors.onSurface },
  pointsLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginVertical: 12 },
  points: { fontSize: 34, fontWeight: '900', color: colors.primary },
  pointsLabel: { color: colors.onSurfaceVariant, fontWeight: '600', fontSize: 14 },
  metaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  mc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: shape.xs,
    backgroundColor: colors.surfaceContainerHigh,
  },
  mcText: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant },
  desc: { color: colors.onSurfaceVariant, lineHeight: 22, fontSize: 14, fontWeight: '500', marginBottom: 16 },
  seller: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: shape.md,
    backgroundColor: colors.surfaceContainerLow,
    marginBottom: 14,
    ...elevation.level1,
  },
  sellerAv: {
    width: 44,
    height: 44,
    borderRadius: shape.full,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerAvText: { fontWeight: '700', color: colors.onSecondaryContainer },
  sellerName: { fontWeight: '700', fontSize: 14, color: colors.onSurface },
  sellerSub: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  sellerSubText: { color: colors.onSurfaceVariant, fontSize: 12, fontWeight: '500' },
  pool: { backgroundColor: colors.primaryContainer, borderRadius: shape.md, padding: 16 },
  poolHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  poolHeadText: { fontWeight: '700', fontSize: 14, color: colors.onPrimaryContainer },
  poolText: { fontSize: 13, lineHeight: 19, fontWeight: '500', color: colors.onPrimaryContainer },
  actionbar: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: colors.surfaceContainer,
  },
  iconSquare: {
    width: 52,
    height: 52,
    borderRadius: shape.md,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    ...elevation.level1,
  },
  ctaText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
});
