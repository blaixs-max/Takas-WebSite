import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProduct } from '../../hooks/useProducts';
import { colors, elevation, shape } from '../../theme/tokens';

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { product, loading } = useProduct(id);
  const [activeImg, setActiveImg] = useState(0);

  if (loading && !product) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text>Ürün bulunamadı.</Text>
      </View>
    );
  }

  const gallery = product.gallery;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.appbar, { paddingTop: insets.top }]}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.appTitle}>Ürün detayı</Text>
        <Pressable style={styles.iconBtn}>
          <MaterialIcons name="share" size={24} color={colors.onSurface} />
        </Pressable>
        <Pressable style={styles.iconBtn}>
          <MaterialIcons name="favorite-border" size={24} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {/* Galeri */}
        <View style={styles.hero}>
          <Image source={gallery[activeImg]} style={styles.heroImg} resizeMode="cover" />
          <View style={styles.cond}>
            <MaterialIcons name="verified" size={16} color={colors.primary} />
            <Text style={styles.condText}>{product.condition}</Text>
          </View>
          <View style={styles.count}>
            <MaterialIcons name="photo-library" size={15} color="#fff" />
            <Text style={styles.countText}>
              {activeImg + 1}/{gallery.length}
            </Text>
          </View>
          <View style={styles.dots}>
            {gallery.map((_, i) => (
              <View key={i} style={[styles.dot, i === activeImg && styles.dotOn]} />
            ))}
          </View>
        </View>

        {/* Thumbnail şeridi */}
        <View style={styles.thumbs}>
          {gallery.map((g, i) => (
            <Pressable key={i} onPress={() => setActiveImg(i)} style={[styles.thumb, i === activeImg && styles.thumbOn]}>
              <Image source={g} style={styles.thumbImg} resizeMode="cover" />
            </Pressable>
          ))}
        </View>

        <Text style={styles.title}>{product.title}</Text>
        <View style={styles.ptsLine}>
          <Text style={styles.pts}>{product.points}</Text>
          <Text style={styles.ptsLabel}>Takas Puanı</Text>
          <View style={styles.market}>
            <Text style={styles.marketLabel}>Piyasa karşılığı</Text>
            <Text style={styles.marketVal}>{product.marketValue}</Text>
          </View>
        </View>

        <View style={styles.mchips}>
          <Chip icon="verified" label="AI onaylı fotoğraf" />
          <Chip icon="location-on" label={`${product.location} · ${product.distanceKm} km`} />
          <Chip icon="inventory-2" label="48 parça tam" />
        </View>

        <Text style={styles.desc}>{product.description}</Text>

        {/* Satıcı */}
        <View style={styles.seller}>
          <View style={styles.sellerAv}>
            <Text style={styles.sellerAvText}>{product.seller.initials}</Text>
            <View style={styles.sellerOk}>
              <MaterialIcons name="check" size={11} color="#fff" />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.sellerNameRow}>
              <Text style={styles.sellerName}>{product.seller.name}</Text>
              <MaterialIcons name="verified-user" size={15} color={colors.primary} />
            </View>
            <View style={styles.sellerSub}>
              <MaterialIcons name="workspace-premium" size={15} color={colors.gold} />
              <Text style={styles.sellerSubText}>
                Güven skoru {product.seller.trust} · {product.seller.trades} başarılı takas
              </Text>
            </View>
          </View>
          <Pressable style={styles.iconBtn}>
            <MaterialIcons name="chat-bubble-outline" size={22} color={colors.onSurface} />
          </Pressable>
        </View>

        {/* Güvenli havuz */}
        <View style={styles.pool}>
          <View style={styles.poolHead}>
            <MaterialIcons name="verified-user" size={22} color={colors.onPrimaryContainer} />
            <Text style={styles.poolHeadText}>Güvenli havuz korumalı takas</Text>
          </View>
          <Text style={styles.poolText}>
            Takas talebinde puanın güvenli havuzda bekler; ürün eline geçip onaylayana kadar satıcıya geçmez.
          </Text>
          <View style={styles.poolMini}>
            <PoolMini icon="shield" label="Alıcı koruması" />
            <PoolMini icon="local-shipping" label="3 gün kargo" />
            <PoolMini icon="history-toggle-off" label="48 sa onay" />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.actionbar, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable style={styles.iconSquare}>
          <MaterialIcons name="bookmark-border" size={24} color={colors.onSurface} />
        </Pressable>
        <Pressable style={styles.cta}>
          <MaterialIcons name="swap-horiz" size={20} color="#fff" />
          <Text style={styles.ctaText}>Takas et · {product.points} puan</Text>
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

function PoolMini({ icon, label }: { icon: keyof typeof MaterialIcons.glyphMap; label: string }) {
  return (
    <View style={styles.pm}>
      <MaterialIcons name={icon} size={16} color={colors.onPrimaryContainer} />
      <Text style={styles.pmText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: 'center', justifyContent: 'center' },
  appbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, backgroundColor: colors.surface },
  appTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: shape.xl, overflow: 'hidden', aspectRatio: 4 / 3, marginBottom: 14, ...elevation.level2 },
  heroImg: { width: '100%', height: '100%' },
  cond: {
    position: 'absolute',
    left: 14,
    top: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: shape.full,
    backgroundColor: 'rgba(255,255,255,0.94)',
    ...elevation.level1,
  },
  condText: { fontSize: 12, fontWeight: '700', color: colors.onSurface },
  count: {
    position: 'absolute',
    right: 14,
    top: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: shape.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  countText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  dots: { position: 'absolute', left: 0, right: 0, bottom: 12, flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotOn: { width: 18, borderRadius: shape.full, backgroundColor: '#fff' },
  thumbs: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  thumb: { width: 60, height: 60, borderRadius: shape.sm, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  thumbOn: { borderColor: colors.primary },
  thumbImg: { width: '100%', height: '100%' },
  title: { fontSize: 24, fontWeight: '800', lineHeight: 28, letterSpacing: -0.4, color: colors.onSurface },
  ptsLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginVertical: 10 },
  pts: { fontSize: 36, fontWeight: '900', letterSpacing: -1, color: colors.primary },
  ptsLabel: { color: colors.onSurfaceVariant, fontWeight: '700', fontSize: 14 },
  market: { marginLeft: 'auto', alignItems: 'flex-end' },
  marketLabel: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500' },
  marketVal: { fontSize: 12, color: colors.onSurface, fontWeight: '700' },
  mchips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
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
    padding: 13,
    borderRadius: shape.md,
    backgroundColor: colors.surfaceContainerLow,
    marginBottom: 14,
    ...elevation.level1,
  },
  sellerAv: {
    width: 46,
    height: 46,
    borderRadius: shape.full,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerAvText: { fontWeight: '800', fontSize: 16, color: colors.onSecondaryContainer },
  sellerOk: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surfaceContainerLow,
  },
  sellerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sellerName: { fontWeight: '700', fontSize: 14, color: colors.onSurface },
  sellerSub: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  sellerSubText: { color: colors.onSurfaceVariant, fontSize: 12, fontWeight: '500' },
  pool: { backgroundColor: colors.primaryContainer, borderRadius: shape.md, padding: 15 },
  poolHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 7 },
  poolHeadText: { fontWeight: '700', fontSize: 14, color: colors.onPrimaryContainer },
  poolText: { fontSize: 13, lineHeight: 19, fontWeight: '500', color: colors.onPrimaryContainer },
  poolMini: { flexDirection: 'row', gap: 8, marginTop: 12 },
  pm: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: shape.xs,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  pmText: { fontSize: 11, fontWeight: '700', color: colors.onPrimaryContainer },
  actionbar: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 14,
    backgroundColor: colors.surfaceContainer,
  },
  iconSquare: {
    width: 54,
    height: 54,
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
    height: 54,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    ...elevation.level1,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
