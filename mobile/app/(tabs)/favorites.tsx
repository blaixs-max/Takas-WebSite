import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BosDurum } from '../../components/BosDurum';
import { ProductCard } from '../../components/ProductCard';
import { useProducts } from '../../hooks/useProducts';
import { useFavorites } from '../../lib/favorites';
import { colors, shape } from '../../theme/tokens';

export default function Favorites() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { products } = useProducts();
  const { isFavorite } = useFavorites();
  const favs = products.filter((p) => isFavorite(p.id));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Text style={styles.appTitle}>Favorilerim</Text>
      </View>

      {favs.length === 0 ? (
        <BosDurum
          ikon="favorite-border"
          baslik="Henüz favorin yok"
          metin="Beğendiğin ürünleri kalbe dokunarak burada biriktirebilirsin."
          cta="Ürünleri keşfet"
          onCta={() => router.push('/')}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.count}>{favs.length} ürün kaydedildi</Text>
          <View style={styles.grid}>
            {favs.map((p) => (
              <View key={p.id} style={styles.cell}>
                <ProductCard product={p} />
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
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 6 },
  appTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '800', color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -7 },
  cell: { width: '50%', paddingHorizontal: 7, marginBottom: 14 },
});
