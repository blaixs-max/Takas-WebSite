import { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { uyar } from '../components/Dialog';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GIZLILIK_URL } from '../lib/brand';
import { useAuth } from '../lib/auth';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { colors, elevation, shape } from '../theme/tokens';

/**
 * Güvenlik & doğrulama.
 *
 * Bu ekran dört doğrulama gösteriyordu ve üçü onaylı görünüyordu — hiçbiri
 * gerçek değildi. En ağırı **"T.C. Kimlik doğrulaması · Onaylandı"** satırıydı:
 * böyle bir doğrulama hiç yapılmadı, üstelik Ana Doküman T.C. kimlik
 * numarasının **saklanmadığını** söylüyor. Ekran, var olmayan bir güvenlik
 * garantisini kullanıcıya anlatıyordu. Boş bir kutu göstermek bir eksiklik;
 * olmayan bir doğrulamayı onaylı göstermek bir yanlış beyandır.
 *
 * Aynı ekranda `blaixs@gmail.com` ve `0532 *** ** 41` sabit gömülüydü — kim
 * giriş yaparsa yapsın bu ikisi görünüyordu.
 *
 * Artık yalnızca gerçekten bilinen şey yazıyor: oturumun e-postası ve
 * doğrulanma durumu. Telefon toplanmıyor, IBAN toplanmıyor, kimlik
 * doğrulaması yok — bunlar "henüz yok" olarak duruyor, onaylı olarak değil.
 * T.C. kimlik satırı tamamen kalktı: saklamayacağımız bir veriyi doğrulama
 * listesinde göstermek, ileride saklayacağımızı ima eder.
 */
export default function Security() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, hesabiSil } = useAuth();
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [siliniyor, setSiliniyor] = useState(false);

  const eposta = user?.email ?? null;
  const epostaOnayli = Boolean(user?.email_confirmed_at ?? user?.confirmed_at);

  const dogrulamalar = [
    {
      icon: 'mail' as const,
      label: 'E-posta',
      value: eposta ?? 'Oturum açılmadı',
      durum: eposta ? (epostaOnayli ? 'onayli' : 'bekliyor') : 'yok',
    },
    {
      icon: 'smartphone' as const,
      label: 'Telefon',
      value: 'Henüz toplanmıyor',
      durum: 'yok',
    },
    {
      icon: 'account-balance' as const,
      label: 'IBAN (kargo iadeleri)',
      value: 'Henüz toplanmıyor',
      durum: 'yok',
    },
  ];

  const onayliSayisi = dogrulamalar.filter((d) => d.durum === 'onayli').length;

  async function sifreSifirla() {
    if (!supabaseConfigured || !supabase || !eposta) {
      uyar('Yapılamadı', 'Bunun için oturum açmış olmanız gerekiyor.');
      return;
    }
    setGonderiliyor(true);
    const { error } = await supabase.auth.resetPasswordForEmail(eposta);
    setGonderiliyor(false);
    uyar(
      error ? 'Gönderilemedi' : 'Bağlantı gönderildi',
      error ? error.message : `Şifre sıfırlama bağlantısı ${eposta} adresine gönderildi.`,
    );
  }

  /**
   * Hesap silme.
   *
   * İki adım: önce ne kaybedileceğini sayan bir onay, sonra işlem. Tek
   * dokunuşla silinebilen bir hesap, yanlışlıkla silinen bir hesaptır — ve
   * geri getirmenin yolu yok.
   *
   * Engelleri sunucu koyuyor (açık takas, rezerve ilan, ödenmemiş borç);
   * burada tekrarlamıyoruz. Ret gelirse sebebi kullanıcıya olduğu gibi
   * gösteriliyor: "silemezsin" değil, "şunu bitir sonra silebilirsin".
   */
  function hesapSilmeyiSor() {
    uyar(
      'Hesabın kalıcı olarak silinsin mi?',
      'İlanların raftan kalkacak, kalan puanların düşecek ve bu işlem geri alınamaz. ' +
        'Tamamlanmış takasların kaydı, karşı tarafın geçmişi olduğu için kalır.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Hesabımı sil', style: 'destructive', onPress: hesapSil },
      ],
    );
  }

  async function hesapSil() {
    setSiliniyor(true);
    const sonuc = await hesabiSil();
    setSiliniyor(false);

    if (sonuc.error) {
      uyar('Hesap silinemedi', sonuc.error);
      return;
    }
    /* Oturum `hesabiSil` içinde kapatıldı; kapı kullanıcıyı zaten onboarding'e
       alıyor. `replace` ile geçmiş de temizleniyor — geri tuşu silinmiş bir
       hesabın ekranına dönmemeli. */
    router.replace('/onboarding');
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Güvenlik & doğrulama</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        {/* Sayı hesaplanıyor. "3/4 doğrulama tamamlandı" yazıyordu; hiçbiri
            yapılmamışken. */}
        <View style={styles.scoreCard}>
          <MaterialIcons name="verified-user" size={26} color={colors.onPrimaryContainer} />
          <View style={{ flex: 1 }}>
            <Text style={styles.scoreTitle}>
              {onayliSayisi} / {dogrulamalar.length} doğrulama tamamlandı
            </Text>
            <Text style={styles.scoreSub}>
              Doğrulamalar arttıkça güven skoruna katkı sağlar.
            </Text>
          </View>
        </View>

        <Text style={styles.section}>Doğrulamalar</Text>
        <View style={styles.group}>
          {dogrulamalar.map((v, i) => (
            <View key={v.label}>
              <View style={styles.row}>
                <View style={styles.ic}>
                  <MaterialIcons name={v.icon} size={20} color={colors.onSurfaceVariant} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{v.label}</Text>
                  <Text style={styles.rowSub}>{v.value}</Text>
                </View>
                {v.durum === 'onayli' ? (
                  <MaterialIcons name="check-circle" size={22} color={colors.primary} />
                ) : v.durum === 'bekliyor' ? (
                  <Text style={styles.bekliyor}>Doğrulanmadı</Text>
                ) : (
                  <Text style={styles.yok}>—</Text>
                )}
              </View>
              {i < dogrulamalar.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* İki adımlı doğrulama ve biyometrik giriş anahtarları buradaydı;
            ikisi de hiçbir şeye bağlı değildi. Açık duran bir "iki adımlı
            doğrulama" anahtarı, kullanıcıya sahip olmadığı bir korumayı
            anlatıyordu. Kurulana kadar yoklar. */}
        <Text style={styles.section}>Oturum güvenliği</Text>
        <View style={styles.group}>
          <Pressable style={styles.row} onPress={sifreSifirla} disabled={gonderiliyor || !eposta}>
            <View style={styles.ic}>
              <MaterialIcons name="password" size={20} color={colors.onSurfaceVariant} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Şifre değiştir</Text>
              <Text style={styles.rowSub}>
                {eposta ? 'E-postanıza sıfırlama bağlantısı gönderilir' : 'Oturum açmanız gerekiyor'}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
          </Pressable>
        </View>

        {/* Engellediklerim burada, mesajların altında değil: engelleme bir
            mesajlaşma özelliği değil bir güvenlik aracı ve kullanıcı onu
            aradığında güvenlik ekranına bakar. Engelleme sohbetten yapılıyor
            ama geri alınacak yerin sabit olması gerekiyordu — sohbetin içinde
            saklı kalsaydı, engeli kaldırmak için önce engellediğin kişinin
            sohbetini bulman gerekirdi. */}
        <Text style={styles.section}>Gizlilik</Text>
        <View style={styles.group}>
          <Pressable style={styles.row} onPress={() => router.push('/engellenenler')}>
            <View style={styles.ic}>
              <MaterialIcons name="block" size={20} color={colors.onSurfaceVariant} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Engellediklerim</Text>
              <Text style={styles.rowSub}>Engellediğin kişileri gör, engeli kaldır</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
          </Pressable>

          {/* Politika uygulama içinden de açılabilmeli. Sayfa yayındaydı ve
              mağaza formunun istediği kalıcı URL vardı, ama uygulamanın
              hiçbir yerinden bağlanmıyordu — mağaza incelemesi ikisini birden
              arıyor, ve KVKK aydınlatması ulaşılabilir olmadıkça yapılmış
              sayılmaz. Tarayıcıda açılıyor, uygulama içi bir kopya
              tutulmuyor: iki metin kaçınılmaz olarak ayrışırdı. */}
          <Pressable style={styles.row} onPress={() => void Linking.openURL(GIZLILIK_URL)}>
            <View style={styles.ic}>
              <MaterialIcons name="privacy-tip" size={20} color={colors.onSurfaceVariant} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Gizlilik politikası</Text>
              <Text style={styles.rowSub}>
                Hangi veriyi neden işliyoruz, ne kadar saklıyoruz
              </Text>
            </View>
            <MaterialIcons name="open-in-new" size={18} color={colors.outline} />
          </Pressable>
        </View>

        <Text style={styles.notice}>
          Telefon, IBAN ve kimlik doğrulaması henüz toplanmıyor. Fatura bilgisi ve T.C. kimlik
          numarası saklanmıyor; ödeme sırasında sorulur ve yalnızca o işlemde iletilir.
        </Text>

        {/* Hesap silme en altta ve kırmızı: aranınca bulunabilecek kadar
            görünür, yanlışlıkla basılamayacak kadar uzakta. Mağaza kuralı
            (App Store 5.1.1(v)) uygulama içinden silmeyi zorunlu tutuyor;
            ayarların derinine gömmek o kuralı karşılamaz. */}
        {eposta && (
          <>
            <Text style={styles.section}>Hesap</Text>
            <View style={styles.group}>
              <Pressable style={styles.row} onPress={hesapSilmeyiSor} disabled={siliniyor}>
                <View style={styles.icTehlike}>
                  <MaterialIcons name="delete-forever" size={20} color={colors.error} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: colors.error }]}>
                    {siliniyor ? 'Siliniyor…' : 'Hesabımı sil'}
                  </Text>
                  <Text style={styles.rowSub}>
                    Kalıcıdır, geri alınamaz. Açık takasın varken yapılamaz.
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bekliyor: { fontSize: 12, fontWeight: '700', color: colors.tertiary },
  yok: { fontSize: 14, fontWeight: '700', color: colors.onSurfaceVariant },
  notice: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
    marginTop: 18,
    paddingHorizontal: 2,
  },
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 6 },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scoreCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderRadius: shape.md, backgroundColor: colors.primaryContainer, marginBottom: 16 },
  scoreTitle: { fontSize: 14, fontWeight: '800', color: colors.onPrimaryContainer },
  scoreSub: { fontSize: 12, color: colors.onPrimaryContainer, fontWeight: '500', marginTop: 4, lineHeight: 17 },
  /* Tasarımın form/bölüm etiketleri versal ve küçük — ilan formundaki
     `flabel` ile aynı ölçü, iki ekran aynı dili konuşsun. */
  section: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 9,
  },
  group: { backgroundColor: colors.surfaceContainerLowest, borderRadius: shape.md, paddingHorizontal: 12, marginBottom: 18, ...elevation.level1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12 },
  ic: { width: 36, height: 36, borderRadius: shape.sm, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  /* Aynı kutu, farklı zemin: kırmızı yalnızca yıkıcı eylemi işaretliyor. */
  icTehlike: { width: 36, height: 36, borderRadius: shape.sm, backgroundColor: colors.errorContainer, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '800', color: colors.onSurface },
  rowSub: { fontSize: 11.5, color: colors.onSurfaceVariant, fontWeight: '500', marginTop: 2 },
  addPill: { height: 30, paddingHorizontal: 14, borderRadius: shape.full, backgroundColor: colors.secondaryContainer, justifyContent: 'center' },
  addPillText: { fontSize: 12, fontWeight: '700', color: colors.onSecondaryContainer },
  divider: { height: 1, backgroundColor: colors.outlineVariant, opacity: 0.5 },
});
