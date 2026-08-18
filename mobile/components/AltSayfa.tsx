import { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shape } from '../theme/tokens';

/**
 * Alttan açılan panel.
 *
 * Sırala ve Filtrele iki ayrı panel ama aynı kabuk: başlık, kapatma, kaydırma,
 * perde ve alt eylem çubuğu. İkisini ayrı ayrı yazmak, ilk değişiklikte
 * ikisinin ayrışmasını garanti ederdi — bu depoda aynı hata gizlilik metninde
 * ve kategori slug'ında iki kez yaşandı.
 *
 * Konvansiyonlar (CLAUDE.md): Escape/geri ile kapanır, `accessibilityViewIsModal`
 * taşır, arka plan kaydırması Modal'ın kendisi tarafından kilitlenir.
 *
 * `maxHeight` yüzde: içerik uzunsa panel ekranın dörtte üçünde durup kendi
 * içinde kaydırıyor. Sabit bir yükseklik, kısa panelde boşluk, uzun panelde
 * taşma verirdi.
 */
export function AltSayfa({
  acik,
  baslik,
  onKapat,
  children,
  altBar,
}: {
  acik: boolean;
  baslik: string;
  onKapat: () => void;
  children: ReactNode;
  /** Panelin altına sabitlenen eylem çubuğu; kaydırma onun üstünde kalır. */
  altBar?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={acik}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onKapat}
    >
      <Pressable style={styles.perde} onPress={onKapat} accessibilityLabel="Paneli kapat">
        {/* İçe dokunuş perdeye ulaşmasın; yoksa panelin içinde bir seçim
            yapmak paneli kapatırdı. */}
        <Pressable
          style={styles.panel}
          onPress={() => {}}
          accessibilityViewIsModal
          accessibilityRole="none"
        >
          <View style={styles.tutamak} />
          <View style={styles.baslikSatiri}>
            <Text style={styles.baslik} accessibilityRole="header">
              {baslik}
            </Text>
            <Pressable onPress={onKapat} hitSlop={12} accessibilityLabel="Kapat">
              <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.govde}
            contentContainerStyle={{ paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>

          {altBar ? (
            <View style={[styles.altBar, { paddingBottom: insets.bottom + 12 }]}>{altBar}</View>
          ) : (
            <View style={{ height: insets.bottom + 8 }} />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  perde: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  panel: {
    maxHeight: '82%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: shape.lg,
    borderTopRightRadius: shape.lg,
    paddingTop: 8,
  },
  tutamak: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: shape.full,
    backgroundColor: colors.outlineVariant,
    marginBottom: 8,
  },
  baslikSatiri: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  baslik: { fontSize: 16.5, fontWeight: '800', color: colors.onSurface },
  govde: { paddingHorizontal: 18 },
  altBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
  },
});
