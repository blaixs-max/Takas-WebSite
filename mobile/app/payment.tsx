import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { uyar } from '../components/Dialog';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { BuyerInfo, initCargoPayment, openCheckout } from '../lib/payment';
import { PriceQuote, quotePrice } from '../lib/trades';
import { colors, elevation, shape } from '../theme/tokens';

/**
 * Kargo bedeli ödemesi.
 *
 * Ürün bedeli burada ÖDENMEZ — o puanla ödendi ve havuzda duruyor. Buradan
 * geçen para yalnızca kargo, hizmet bedeli ve işlem payıdır. Ekran bunu
 * açıkça yazar; aksi hâlde kullanıcı ürünü ikinci kez ödediğini sanır.
 */
export default function PaymentScreen() {
  const { trade } = useLocalSearchParams<{ trade: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [fiyat, setFiyat] = useState<PriceQuote | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [odeniyor, setOdeniyor] = useState(false);

  const [ad, setAd] = useState('');
  const [soyad, setSoyad] = useState('');
  const [tckn, setTckn] = useState('');
  const [telefon, setTelefon] = useState('');
  const [adres, setAdres] = useState('');
  const [sehir, setSehir] = useState('');

  useEffect(() => {
    let iptal = false;
    (async () => {
      if (!trade) return;
      const q = await quotePrice(trade);
      if (!iptal) {
        setFiyat(q);
        setYukleniyor(false);
      }
    })();
    return () => {
      iptal = true;
    };
  }, [trade]);

  // Profildeki ad soyad varsa formu doldur; kullanıcı yine değiştirebilir.
  useEffect(() => {
    const tam = (user?.user_metadata?.full_name as string) ?? '';
    if (!tam) return;
    const parcalar = tam.trim().split(' ');
    setSoyad((s) => s || (parcalar.length > 1 ? parcalar[parcalar.length - 1] : ''));
    setAd((a) => a || parcalar.slice(0, -1).join(' ') || parcalar[0]);
  }, [user]);

  const eksik =
    !ad.trim() || !soyad.trim() || !adres.trim() || !sehir.trim() || tckn.trim().length !== 11;

  async function ode() {
    if (!trade || !user?.email) return;

    const buyer: BuyerInfo = {
      name: ad.trim(),
      surname: soyad.trim(),
      email: user.email,
      gsmNumber: telefon.trim() || undefined,
      identityNumber: tckn.trim(),
      address: adres.trim(),
      city: sehir.trim(),
    };

    setOdeniyor(true);
    const baslangic = await initCargoPayment(trade, buyer);
    if (!baslangic.ok) {
      setOdeniyor(false);
      uyar('Ödeme başlatılamadı', baslangic.message);
      return;
    }

    const sonuc = await openCheckout(baslangic.paymentPageUrl);
    setOdeniyor(false);

    if (sonuc === 'success') {
      uyar(
        'Ödeme alındı',
        'Satıcıya bildirildi. Ürün kargoya verilince Takaslarım ekranından takip edebilirsin.',
        [{ text: 'Takaslarıma git', onPress: () => router.replace('/trades') }],
      );
      return;
    }
    if (sonuc === 'failure') {
      uyar('Ödeme tamamlanmadı', 'Kart işlemi onaylanmadı. Yeniden deneyebilirsin.');
      return;
    }
    if (sonuc === 'cancelled') {
      uyar(
        'Ödeme yarıda kaldı',
        'Takas Puanın Güvenli Havuz’da bekliyor. Ödemeyi tamamlamazsan süre dolduğunda takas iptal edilir ve puanın iade edilir.',
      );
      return;
    }
    // Sonucu okuyamadık: burada "başarılı" demek yanlış olur. Gerçeği sunucu
    // bilir, kullanıcıyı oraya gönderiyoruz.
    uyar(
      'Ödeme durumu doğrulanıyor',
      'İşlemin birkaç saniye içinde Takaslarım ekranına yansıyacak.',
      [{ text: 'Takaslarıma git', onPress: () => router.replace('/trades') }],
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.appTitle}>Kargo ödemesi</Text>
        <View style={styles.iconBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 18, paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.bilgi}>
            <MaterialIcons name="info-outline" size={18} color={colors.onTertiaryContainer} />
            <Text style={styles.bilgiText}>
              Ürünün bedelini Takas Puanınla ödedin; o puan Güvenli Havuz’da bekliyor. Buradan yalnızca
              kargo ve hizmet bedeli tahsil edilir.
            </Text>
          </View>

          <Text style={styles.baslik}>Ödenecek tutar</Text>
          <View style={styles.ozet}>
            {yukleniyor ? (
              <ActivityIndicator color={colors.primary} />
            ) : fiyat ? (
              <>
                <Satir etiket={`Kargo (${fiyat.sizeClass} desi)`} tutar={fiyat.shippingTl} />
                <Satir etiket="Hizmet bedeli" tutar={fiyat.serviceFeeTl} />
                <Satir etiket="İşlem payı" tutar={fiyat.transactionFeeTl} />
                <View style={styles.ayrac} />
                <Satir etiket="Toplam" tutar={fiyat.totalTl} kalin />
              </>
            ) : (
              <Text style={styles.hata}>Tutar alınamadı. Bağlantını kontrol edip yeniden dene.</Text>
            )}
          </View>

          <Text style={styles.baslik}>Fatura bilgileri</Text>
          <Text style={styles.aciklama}>
            iyzico fatura için istiyor. Bu bilgiler kaydedilmiyor, yalnızca bu ödeme için
            iletiliyor.
          </Text>

          <View style={styles.ikili}>
            <Alan etiket="Ad" deger={ad} setDeger={setAd} stil={{ flex: 1 }} />
            <Alan etiket="Soyad" deger={soyad} setDeger={setSoyad} stil={{ flex: 1 }} />
          </View>
          <Alan
            etiket="T.C. kimlik numarası"
            deger={tckn}
            setDeger={setTckn}
            klavye="number-pad"
            maks={11}
          />
          <Alan
            etiket="Telefon (isteğe bağlı)"
            deger={telefon}
            setDeger={setTelefon}
            klavye="phone-pad"
          />
          <Alan etiket="Adres" deger={adres} setDeger={setAdres} cokSatir />
          <Alan etiket="Şehir" deger={sehir} setDeger={setSehir} />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.actionbar, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable
          style={[styles.cta, (eksik || odeniyor || !fiyat) && styles.ctaOff]}
          disabled={eksik || odeniyor || !fiyat}
          onPress={ode}
        >
          {odeniyor ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="lock" size={19} color="#fff" />
              <Text style={styles.ctaText}>
                {fiyat ? `${fiyat.totalTl.toFixed(2)} ₺ öde` : 'Öde'}
              </Text>
            </>
          )}
        </Pressable>
        <Text style={styles.ctaHint}>Ödeme iyzico'nun güvenli sayfasında tamamlanır.</Text>
      </View>
    </View>
  );
}

function Satir({
  etiket,
  tutar,
  kalin,
}: {
  etiket: string;
  tutar: number;
  kalin?: boolean;
}) {
  return (
    <View style={styles.satir}>
      <Text style={[styles.satirEtiket, kalin && styles.kalinMetin]}>{etiket}</Text>
      <Text style={[styles.satirTutar, kalin && styles.kalinMetin]}>{tutar.toFixed(2)} ₺</Text>
    </View>
  );
}

function Alan({
  etiket,
  deger,
  setDeger,
  klavye,
  maks,
  cokSatir,
  stil,
}: {
  etiket: string;
  deger: string;
  setDeger: (v: string) => void;
  klavye?: 'number-pad' | 'phone-pad';
  maks?: number;
  cokSatir?: boolean;
  stil?: object;
}) {
  return (
    <View style={[{ marginTop: 12 }, stil]}>
      <Text style={styles.alanEtiket}>{etiket}</Text>
      <TextInput
        style={[styles.giris, cokSatir && styles.girisCok]}
        value={deger}
        onChangeText={setDeger}
        keyboardType={klavye}
        maxLength={maks}
        multiline={cokSatir}
        placeholderTextColor={colors.onSurfaceVariant}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 6 },
  appTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
    color: colors.onSurface,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bilgi: {
    flexDirection: 'row',
    gap: 10,
    padding: 13,
    borderRadius: shape.md,
    backgroundColor: colors.tertiaryContainer,
    marginBottom: 20,
  },
  bilgiText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.onTertiaryContainer,
  },
  baslik: { fontSize: 15, fontWeight: '800', color: colors.onSurface, marginBottom: 8 },
  aciklama: {
    fontSize: 12.5,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: 2,
  },
  ozet: {
    padding: 15,
    borderRadius: shape.md,
    backgroundColor: colors.surfaceContainerLow,
    marginBottom: 22,
    ...elevation.level1,
  },
  satir: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  satirEtiket: { fontSize: 13.5, color: colors.onSurfaceVariant, fontWeight: '600' },
  satirTutar: { fontSize: 13.5, color: colors.onSurface, fontWeight: '700' },
  kalinMetin: { fontSize: 16, fontWeight: '800', color: colors.onSurface },
  ayrac: { height: 1, backgroundColor: colors.outlineVariant, marginVertical: 8 },
  hata: { fontSize: 13, color: colors.error, fontWeight: '600' },
  ikili: { flexDirection: 'row', gap: 10 },
  alanEtiket: { fontSize: 12, fontWeight: '700', color: colors.onSurfaceVariant, marginBottom: 5 },
  giris: {
    height: 48,
    borderRadius: shape.sm,
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 13,
    fontSize: 14.5,
    color: colors.onSurface,
  },
  girisCok: { height: 88, paddingTop: 13, textAlignVertical: 'top' },
  actionbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 14,
    backgroundColor: colors.surfaceContainer,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    ...elevation.level1,
  },
  ctaOff: { opacity: 0.45 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  ctaHint: {
    textAlign: 'center',
    color: colors.onSurfaceVariant,
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 8,
  },
});
