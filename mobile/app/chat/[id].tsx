import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
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
import { Image } from 'react-native';
import { BosDurum } from '../../components/BosDurum';
import { Diamond } from '../../components/brand/Diamond';
import { useProduct } from '../../hooks/useProducts';
import {
  ConversationRow,
  MessageRow,
  ReportReason,
  SIKAYET_NEDENLERI,
  blockConversationPeer,
  loadConversation,
  loadMessages,
  markConversationRead,
  saat,
  reportMessage,
  sendMessage,
  subscribeMessages,
} from '../../lib/messages';
import { colors, elevation, shape } from '../../theme/tokens';

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

  /* Sohbetin hangi ürün hakkında olduğu. Tasarımda ekranın tepesinde duran
     şerit bu — sohbet listeden değil de ürün detayından açıldığında
     kullanıcı hangi ilandan konuştuğunu başka türlü göremiyordu. */
  const [sohbet, setSohbet] = useState<ConversationRow | null>(null);
  useEffect(() => {
    let iptal = false;
    if (id) loadConversation(id).then((c) => !iptal && setSohbet(c));
    return () => {
      iptal = true;
    };
  }, [id]);
  const { product: urun } = useProduct(sohbet?.productId);

  /* Klavye açıkken alt güvenli alan boşluğu düşüyor: `insets.bottom` ana
     düğme çubuğu içindir, klavye onu zaten örtüyor. Bırakılırsa yazı kutusu
     klavyenin üstünde bir parmak boşlukla havada duruyor. */
  const [klavyeAcik, setKlavyeAcik] = useState(false);
  useEffect(() => {
    const ac = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKlavyeAcik(true),
    );
    const kapa = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKlavyeAcik(false),
    );
    return () => {
      ac.remove();
      kapa.remove();
    };
  }, []);

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
      'Bildirimin alındı',
      'Ekibimiz inceleyip size sonucu bildirecek. Mesaj kayıtta kalır — inceleme buna dayanır.',
    );
  }

  /**
   * Karşı tarafı engelle.
   *
   * Ne yaptığını ve ne yapmadığını önceden söylüyoruz. En çok yanlış anlaşılan
   * yer, engellemenin açık bir takası durdurmaması: durdursaydı, takasın
   * ortasında iletişim kesilir ve süreç kilitlenirdi.
   */
  function engellemeyiSor() {
    if (!id) return;
    uyar(
      'Bu kişiyi engelle',
      'Karşılıklı mesajlaşma kapanır. Sohbet geçmişi silinmez — bir itirazda kanıt olarak gerekebilir. ' +
        'Devam eden bir takasın varsa süreci durdurmaz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Engelle',
          style: 'destructive',
          onPress: async () => {
            const s = await blockConversationPeer(id);
            uyar(
              s.ok ? 'Engellendi' : 'Engellenemedi',
              s.ok
                ? 'Bu kişi artık sana mesaj gönderemez, sen de ona gönderemezsin.'
                : s.message,
            );
          },
        },
      ],
    );
  }

  return (
    /* KAV **kökün kendisi**, iç sarmalayıcı değil — ve ofset sıfır.
       Önceden yalnızca gövdeyi sarıyor, `keyboardVerticalOffset` olarak
       `insets.top + 56` alıyordu. KAV pencere koordinatlarında ölçüyor: kök
       zaten y=0'dan başladığı için o ofset ikinci kez sayılıyordu ve yazı
       kutusu klavyenin bir başlık boyu üstünde havada kalıyordu. Kök y=0'dan
       başlayınca tahmin edilecek bir şey kalmıyor.
       Aynı düzeltme `add-listing.tsx`te de var; oradaki gerekçe daha uzun. */
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.appbar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.appTitle}>Sohbet</Text>
        {/* Engelleme başlıkta: mağaza kuralı (App Store 1.2) bildirmenin yanında
            engellemeyi de istiyor ve rahatsız olan kişinin onu araması değil,
            görmesi gerekiyor. Bildirme mesaja basılı tutmakla, engelleme
            buradan — biri tek bir mesaj hakkında, öbürü kişi hakkında. */}
        <Pressable style={styles.iconBtn} onPress={engellemeyiSor} hitSlop={6}>
          <MaterialIcons name="block" size={22} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>

      {sohbet && (
        <Pressable
          style={styles.urunSerit}
          onPress={() => router.push(`/product/${sohbet.productId}`)}
          accessibilityRole="button"
        >
          {urun ? (
            <Image source={urun.image} style={styles.urunGorsel} resizeMode="cover" />
          ) : (
            <View style={styles.urunGorsel} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.urunBaslik} numberOfLines={1}>
              {sohbet.productTitle}
            </Text>
            <View style={styles.urunAlt}>
              <Text style={styles.urunKisi} numberOfLines={1}>
                {sohbet.karsiTaraf}
              </Text>
              {urun ? (
                <>
                  <Text style={styles.urunAyrac}>·</Text>
                  <Diamond size={10} color={colors.primary} />
                  <Text style={styles.urunPuan}>{urun.points} Takas Puanı</Text>
                </>
              ) : null}
            </View>
          </View>
        </Pressable>
      )}

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
              Uygunsuz bir mesajı bildirmek için üzerine basılı tut.
            </Text>
          )}
          {/* Rehber 18'de boş durum tek cümle; tasarımda başlık ve
              açıklama iki satır. İkisi aynı cümlenin bölünmüş hâli. */}
          {mesajlar.length === 0 && (
            <BosDurum
              ikon="chat-bubble-outline"
              baslik="Henüz mesaj yok"
              metin="Ürünle ilgili merak ettiğini sorabilirsin."
            />
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

      <View style={[styles.girisAlani, { paddingBottom: klavyeAcik ? 10 : insets.bottom + 10 }]}>
        <TextInput
          style={styles.giris}
          placeholder="Mesaj yaz"
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
          accessibilityLabel="Mesajı gönder"
        >
          {gonderiliyor ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialIcons name="send" size={20} color="#fff" />
          )}
        </Pressable>
      </View>

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
            <Text style={styles.sheetBaslik}>Bu mesajı neden bildiriyorsun?</Text>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  orta: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 6 },
  appTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: colors.onSurface,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  /* Ürün şeridi — tasarımda ekranın tepesinde, gövdeden gölgeyle ayrılıyor. */
  urunSerit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 18,
    marginBottom: 4,
    padding: 8,
    borderRadius: shape.md,
    backgroundColor: colors.surfaceContainerLowest,
    ...elevation.level1,
  },
  urunGorsel: {
    width: 38,
    height: 38,
    borderRadius: shape.sm,
    backgroundColor: colors.surfaceContainerHigh,
  },
  urunBaslik: { fontSize: 12.5, fontWeight: '800', color: colors.onSurface },
  urunAlt: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  urunKisi: { fontSize: 11, fontWeight: '500', color: colors.onSurfaceVariant, flexShrink: 1 },
  urunAyrac: { fontSize: 11, color: colors.onSurfaceVariant },
  urunPuan: { fontSize: 11, fontWeight: '700', color: colors.primary },
  balon: {
    maxWidth: '78%',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: shape.md,
    marginBottom: 8,
  },
  benim: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  karsi: { alignSelf: 'flex-start', backgroundColor: colors.surfaceContainerHigh },
  metin: { fontSize: 13.5, lineHeight: 19, color: colors.onSurface, fontWeight: '500' },
  metinBenim: { color: '#fff' },
  saat: { fontSize: 10, color: colors.onSurfaceVariant, marginTop: 4, alignSelf: 'flex-end' },
  saatBenim: { color: 'rgba(255,255,255,0.75)' },
  girisAlani: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 9,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: colors.surfaceContainerLow,
  },
  giris: {
    flex: 1,
    maxHeight: 110,
    minHeight: 44,
    borderRadius: shape.full,
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    color: colors.onSurface,
  },
  gonder: {
    width: 44,
    height: 44,
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
