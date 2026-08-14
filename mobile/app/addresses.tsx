import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BosDurum } from '../components/BosDurum';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, elevation, shape } from '../theme/tokens';

/**
 * Adres defteri henüz yok — ve bu bir eksiklik değil, bekleyen bir karar.
 *
 * Ana Doküman fatura bilgisinin ve T.C. kimlik numarasının saklanmadığını
 * söylüyor; adres saklamaya geçmek bir KVKK kararıdır, kod kararı değil.
 * Karar verilmeden tablo açılmıyor.
 *
 * Burada iki sahte adres duruyordu ("Emrah Atabek · Caferağa Mah. Moda Cad.
 * No:12 D:4"). Gerçek görünümlü sokak bilgisi, maskeli telefon — kullanıcı
 * kayıtlı adresi olduğunu sanıyordu. Artık ekran ne olduğunu söylüyor.
 */
const ADDRESSES: { id: number; label: string; name: string; line: string; phone: string; default: boolean }[] = [];

export default function Addresses() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Adreslerim & kargo</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        {ADDRESSES.map((a) => (
          <View key={a.id} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.labelChip}>
                <MaterialIcons name={a.label === 'Ev' ? 'home' : 'work'} size={14} color={colors.onSecondaryContainer} />
                <Text style={styles.labelText}>{a.label}</Text>
              </View>
              {a.default && (
                <View style={styles.defaultChip}>
                  <Text style={styles.defaultText}>Varsayılan</Text>
                </View>
              )}
              <View style={{ flex: 1 }} />
              <MaterialIcons name="edit" size={20} color={colors.onSurfaceVariant} />
            </View>
            <Text style={styles.name}>{a.name}</Text>
            <Text style={styles.line}>{a.line}</Text>
            <Text style={styles.phone}>{a.phone}</Text>
          </View>
        ))}

        {/* Rehber 17'nin uygulama notu: bu akışta adres önceden
            kaydedilmediği için "Adres ekle" CTA'sı kullanılmaz — o yüzden
            boş durum düğmesiz. */}
        {ADDRESSES.length === 0 && (
          <BosDurum
            ikon="location-on"
            baslik="Adres bilgisi henüz alınmadı"
            metin="Kargo adresin, takas onaylandıktan sonra ödeme adımında alınır ve yalnızca o gönderi için kullanılır."
          />
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
            "ne yapabilirsin", öteki "seninle ilgili ne yapmıyoruz". Mor,
            paletin ikincil vurgusu ve büyük yüzeye sürülmüyor. */}
        <View style={styles.gizlilik}>
          <MaterialIcons name="lock-outline" size={17} color={colors.accent} style={styles.noteIc} />
          <View style={{ flex: 1 }}>
            <Text style={styles.gizlilikBaslik}>Adresin profilinde saklanmaz</Text>
            <Text style={styles.gizlilikText}>
              Adres bilgisi ilgili gönderi tamamlandıktan sonra uygulama profilinde
              tutulmaz.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 6 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.surfaceContainerLow, borderRadius: shape.md, padding: 16, marginBottom: 12, ...elevation.level1 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  labelChip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, paddingHorizontal: 10, borderRadius: shape.full, backgroundColor: colors.secondaryContainer },
  labelText: { fontSize: 12, fontWeight: '700', color: colors.onSecondaryContainer },
  defaultChip: { height: 26, paddingHorizontal: 10, borderRadius: shape.full, backgroundColor: colors.primaryContainer, justifyContent: 'center' },
  defaultText: { fontSize: 11, fontWeight: '700', color: colors.onPrimaryContainer },
  name: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  line: { fontSize: 13, color: colors.onSurfaceVariant, fontWeight: '500', lineHeight: 19, marginTop: 4 },
  phone: { fontSize: 13, color: colors.onSurfaceVariant, fontWeight: '600', marginTop: 6 },
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
  note: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: shape.md, backgroundColor: colors.primaryContainer, marginTop: 18 },
  noteIc: { marginTop: 1 },
  noteBaslik: { fontSize: 13.5, fontWeight: '800', color: colors.onPrimaryContainer },
  noteText: { fontSize: 12, color: colors.onPrimaryContainer, fontWeight: '500', lineHeight: 17, marginTop: 4 },
  gizlilik: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: shape.md, backgroundColor: colors.accentContainer, marginTop: 10 },
  gizlilikBaslik: { fontSize: 13.5, fontWeight: '800', color: colors.onSurface },
  gizlilikText: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500', lineHeight: 17, marginTop: 4 },
});
