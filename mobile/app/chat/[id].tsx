import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { uyar } from '../../components/Dialog';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MessageRow,
  ReportReason,
  SIKAYET_NEDENLERI,
  loadMessages,
  markConversationRead,
  saat,
  reportMessage,
  sendMessage,
  subscribeMessages,
} from '../../lib/messages';
import { colors, shape } from '../../theme/tokens';

/**
 * Sohbet — canlı.
 *
 * Realtime aboneliği varsa yeni mesaj kendiliğinden düşer; yayın kapalıysa
 * ekran yine çalışır, kullanıcı yukarı çekerek tazeler. Abonelik bir
 * gereklilik değil, varsa kullanılan bir kolaylık.
 */
export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mesajlar, setMesajlar] = useState<MessageRow[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [metin, setMetin] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const listeRef = useRef<ScrollView>(null);
  const [sikayetEdilen, setSikayetEdilen] = useState<MessageRow | null>(null);

  const getir = useCallback(async () => {
    if (!id) return;
    setMesajlar(await loadMessages(id));
    setYukleniyor(false);
    // Ekran açıkken gelen mesaj okunmuş sayılır.
    await markConversationRead(id);
  }, [id]);

  useEffect(() => {
    getir();
  }, [getir]);

  useEffect(() => {
    if (!id) return;
    return subscribeMessages(id, () => {
      getir();
    });
  }, [id, getir]);

  async function gonder() {
    const govde = metin.trim();
    if (!govde || !id) return;

    setGonderiliyor(true);
    const s = await sendMessage(id, govde);
    setGonderiliyor(false);

    if (!s.ok) {
      // Metni silmiyoruz: gönderilemeyen mesajı kaybettirmek en can sıkıcı
      // hatalardan biri.
      return;
    }
    setMetin('');
    await getir();
  }

  async function sikayetEt(neden: ReportReason) {
    if (!sikayetEdilen) return;
    const hedef = sikayetEdilen;
    setSikayetEdilen(null);
    const s = await reportMessage(hedef.id, neden);
    if (!s.ok) {
      uyar('Şikâyet gönderilemedi', s.message);
      return;
    }
    uyar(
      'Şikâyetiniz alındı',
      'Ekibimiz inceleyip size sonucu bildirecek. Mesaj kayıtta kalır — inceleme buna dayanır.',
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.appTitle}>Sohbet</Text>
        <View style={styles.iconBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
        {yukleniyor ? (
          <View style={styles.orta}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            ref={listeRef}
            contentContainerStyle={{ padding: 14, paddingBottom: 20 }}
            onContentSizeChange={() => listeRef.current?.scrollToEnd({ animated: false })}
          >
            {mesajlar.length > 0 && (
              <Text style={styles.ipucu}>
                Uygunsuz bir mesajı bildirmek için üzerine basılı tutun.
              </Text>
            )}
            {mesajlar.length === 0 && (
              <Text style={styles.bosMetin}>
                Henüz mesaj yok. Ürünle ilgili sorunuzu yazabilirsiniz.
              </Text>
            )}
            {mesajlar.map((m) => (
              <Pressable
                key={m.id}
                style={[styles.balon, m.benim ? styles.benim : styles.karsi]}
                // Kendi mesajını şikâyet edemezsin; sunucu da reddediyor.
                onLongPress={() => {
                  if (!m.benim) setSikayetEdilen(m);
                }}
                delayLongPress={400}
              >
                <Text style={[styles.metin, m.benim && styles.metinBenim]}>{m.body}</Text>
                <Text style={[styles.saat, m.benim && styles.saatBenim]}>
                  {saat(m.createdAt)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={[styles.girisAlani, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            style={styles.giris}
            placeholder="Mesaj yazın"
            placeholderTextColor={colors.onSurfaceVariant}
            value={metin}
            onChangeText={setMetin}
            multiline
            maxLength={2000}
          />
          <Pressable
            style={[styles.gonder, (!metin.trim() || gonderiliyor) && styles.kapali]}
            disabled={!metin.trim() || gonderiliyor}
            onPress={gonder}
          >
            {gonderiliyor ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialIcons name="send" size={20} color="#fff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={sikayetEdilen !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSikayetEdilen(null)}
      >
        <Pressable style={styles.perde} onPress={() => setSikayetEdilen(null)}>
          <Pressable
            style={styles.sheet}
            onPress={(e) => e.stopPropagation()}
            accessibilityViewIsModal
          >
            <Text style={styles.sheetBaslik}>Bu mesajı neden bildiriyorsunuz?</Text>
            <Text style={styles.sheetMetin} numberOfLines={3}>
              “{sikayetEdilen?.body}”
            </Text>
            {SIKAYET_NEDENLERI.map((n) => (
              <Pressable key={n.kod} style={styles.nedenSatir} onPress={() => sikayetEt(n.kod)}>
                <Text style={styles.nedenText}>{n.etiket}</Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
              </Pressable>
            ))}
            <Pressable style={styles.vazgec} onPress={() => setSikayetEdilen(null)}>
              <Text style={styles.vazgecText}>Vazgeç</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  orta: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 6 },
  appTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.onSurface,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bosMetin: {
    textAlign: 'center',
    color: colors.onSurfaceVariant,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 40,
    paddingHorizontal: 30,
    lineHeight: 19,
  },
  balon: {
    maxWidth: '78%',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: shape.md,
    marginBottom: 8,
  },
  benim: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  karsi: { alignSelf: 'flex-start', backgroundColor: colors.surfaceContainerHigh },
  metin: { fontSize: 14, lineHeight: 19, color: colors.onSurface, fontWeight: '500' },
  metinBenim: { color: '#fff' },
  saat: { fontSize: 10, color: colors.onSurfaceVariant, marginTop: 4, alignSelf: 'flex-end' },
  saatBenim: { color: 'rgba(255,255,255,0.75)' },
  girisAlani: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 9,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: colors.surfaceContainer,
  },
  giris: {
    flex: 1,
    maxHeight: 110,
    minHeight: 46,
    borderRadius: shape.lg,
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 13,
    fontSize: 14.5,
    color: colors.onSurface,
  },
  gonder: {
    width: 46,
    height: 46,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kapali: { opacity: 0.45 },
  ipucu: {
    textAlign: 'center',
    fontSize: 11.5,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
    marginBottom: 12,
  },
  perde: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surfaceContainer,
    borderTopLeftRadius: shape.lg,
    borderTopRightRadius: shape.lg,
    padding: 20,
    paddingBottom: 30,
  },
  sheetBaslik: { fontSize: 17, fontWeight: '800', color: colors.onSurface },
  sheetMetin: {
    fontSize: 12.5,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
    fontStyle: 'italic',
    marginTop: 6,
    marginBottom: 10,
    lineHeight: 18,
  },
  nedenSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  nedenText: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  vazgec: { alignItems: 'center', paddingTop: 16 },
  vazgecText: { fontSize: 14, fontWeight: '700', color: colors.onSurfaceVariant },
});
