import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { uyar } from '../components/Dialog';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Condition } from '../data/products';
import { CATEGORY_TREE, Category, SubCategory, subsOf } from '../data/categories';
import { SIZE_CLASSES, SIZE_INFO, SizeClass } from '../data/sizeClasses';
import { Konum, konumAra } from '../data/konumlar';
import { KutuCizimi } from '../components/KutuCizimi';
import { createListing } from '../lib/listings';
import { useAuth } from '../lib/auth';
import { colors, elevation, shape } from '../theme/tokens';

/**
 * İlan ekleme sihirbazı — altı adım, her adımda tek karar.
 *
 * ## Neden tek ekran değil
 *
 * Önceki hâlde başlık, kategori, alt kategori, kondisyon, iki beyan, boyut ve
 * konum aynı kaydırmalı sayfadaydı. İki somut sonucu vardı. Birincisi: alt
 * kategori ekranın ortasında, dokuz ana kategorinin sarılmış çip satırının
 * altında kalıyordu ve seçilmeden devam edilemediği hâlde görülmüyordu —
 * "devam" düğmesi sebebini söylemeden kapalı duruyordu. İkincisi: boyut
 * seçimi altı harfti (XS…XXL) ve kimse hangisinin kendi kolisi olduğunu
 * bilmiyordu, çünkü o karara ayrılmış bir yer yoktu.
 *
 * Adımlara bölmek bunların ikisini de çözüyor: her ekranda tek bir soru var,
 * cevaplanmadan ilerlenmiyor ve neden ilerlenmediği ekranda yazıyor.
 *
 * ## Neden tek rota, altı rota değil
 *
 * Expo Router'da her adımı ayrı bir ekran yapmak akla yakın ama form durumunu
 * rota parametrelerine taşımayı gerektirirdi: yedi alan, her geçişte
 * serileştirilip çözülür, geri gidince bir kısmı kaybolurdu. Sihirbaz tek
 * bileşende duruyor, `adim` bir sayı; geri gitmek durumu hiç kaybetmiyor.
 * Bunun bedeli donanım geri tuşunu elle yakalamak (aşağıda) — ucuz bir bedel.
 */

/**
 * Kondisyon seçenekleri **iyiden kötüye** sıralı.
 *
 * Sıra rastgele değil: değerleme oranları da bu sırayla düşüyor
 * (`puan_hesapla`), ve kullanıcı listeyi yukarıdan aşağı okurken ürününün
 * durumunu bir merdivende buluyor. Önceki sıralama tersineydi ("İyi durumda"
 * ilk, "Yeni gibi" son) ve seçenekler bir ölçek gibi okunmuyordu.
 */
const KONDISYONLAR: { deger: Condition; aciklama: string }[] = [
  { deger: 'Yeni gibi', aciklama: 'Neredeyse hiç kullanılmamış, izi yok.' },
  { deger: 'Az kullanılmış', aciklama: 'Birkaç kez kullanılmış, gözle görünür izi yok.' },
  { deger: 'İyi durumda', aciklama: 'Kullanılmış, hafif izleri var ama sağlam.' },
  { deger: 'Hasarlı', aciklama: 'Kırık, çatlak, sökük veya eksik parçası var.' },
];

const ADIM_BASLIK = [
  'Ürünün adı',
  'Ana kategori',
  'Alt kategori',
  'Ürünün durumu',
  'Kargo boyutu',
  'Konum',
];
const ADIM_SAYISI = ADIM_BASLIK.length;

export default function AddListing() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();

  const [adim, setAdim] = useState(0);

  const [title, setTitle] = useState('');
  const [aciklama, setAciklama] = useState('');
  /* Kategori ve alt kategori boş başlıyor. Önceden ana kategori "Oyun &
     Oyuncak" ile geliyordu; kullanıcı o ekrandan hiç bakmadan geçince
     ilanların çoğu tek bir kategoride toplanıyordu. Bir sihirbazda önceden
     seçili gelen adım, atlanan adımdır. */
  const [category, setCategory] = useState<Category | null>(null);
  const [subCategory, setSubCategory] = useState<SubCategory | null>(null);
  const [condition, setCondition] = useState<Condition | null>(null);
  const [hasarNotu, setHasarNotu] = useState('');
  const [isSet, setIsSet] = useState(false);
  const [sizeClass, setSizeClass] = useState<SizeClass | null>(null);
  const [konumSorgu, setKonumSorgu] = useState('');
  const [konum, setKonum] = useState<Konum | null>(null);
  const [saving, setSaving] = useState(false);

  /* Hasar beyanı kondisyondan türüyor, ayrı bir onay kutusu değil.
     Önceden ikisi ayrıydı ve çelişebiliyorlardı: "Yeni gibi" seçip "hasar
     var" işaretlemek mümkündü. Veri tabanı da 'Hasarlı' seçilince
     `has_damage`i zaten zorla true yapıyor (`create_listing`); arayüzün
     bundan farklı bir şey göstermesi, kullanıcıya yalan söylemek olurdu. */
  const hasDamage = condition === 'Hasarlı';

  const kategoriSec = (c: Category) => {
    /* Ana kategori değişince alt kategori düşüyor: "Oyun & Oyuncak / Yapı &
       inşa" seçip kategoriyi değiştiren kullanıcı, artık o ağaçta olmayan bir
       alt kategoriyle ilerleyemez — sunucu da reddediyor. */
    if (c !== category) setSubCategory(null);
    setCategory(c);
    setAdim(2);
  };

  const konumSonuclari = useMemo(() => konumAra(konumSorgu), [konumSorgu]);

  /**
   * Adım geçerli mi — "Devam" düğmesi buna bakıyor.
   *
   * Konum adımı bilerek her zaman geçerli: `create_listing` konumu opsiyonel
   * kabul ediyor ve bunu burada zorunlu kılmak, arayüzün sunucudan daha katı
   * olması olurdu. Kullanıcı boş bırakırsa kartta konum satırı hiç çizilmiyor;
   * ekran bunu açıkça söylüyor.
   */
  const adimTamam = (i: number): boolean => {
    switch (i) {
      case 0:
        return title.trim().length >= 3;
      case 1:
        return category !== null;
      case 2:
        return subCategory !== null;
      case 3:
        /* 'Hasarlı' seçildiyse beyansız ilerlenmiyor: hasarın ne olduğu
           yazılmadan devam yok. Yakın çekim karesi de zorunlu hâle geliyor
           ama o bir sonraki ekranda isteniyor — burada istenen, alıcının
           okuyacağı ve değerlemenin göreceği cümle. Beyansız bir "Hasarlı",
           puanı düşürüp kimseye ne olduğunu söylemezdi. */
        if (condition === 'Hasarlı') return hasarNotu.trim().length >= 10;
        return condition !== null;
      case 4:
        return sizeClass !== null;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const sonAdim = adim === ADIM_SAYISI - 1;
  const ilerleyebilir = adimTamam(adim) && !saving;

  const geri = useCallback(() => {
    if (adim > 0) {
      setAdim((a) => a - 1);
      return true;
    }
    return false;
  }, [adim]);

  /* Donanım geri tuşu adımlar arasında geziniyor, ekranı kapatmıyor.
     Yakalanmasaydı üçüncü adımdaki kullanıcı geri tuşuna basınca doldurduğu
     her şeyi kaybederdi — ve bunu ancak kaybettikten sonra öğrenirdi. */
  useEffect(() => {
    const abone = BackHandler.addEventListener('hardwareBackPress', geri);
    return () => abone.remove();
  }, [geri]);

  /**
   * Ekranı bırakır — girilen bilgi varsa önce sorar.
   *
   * Hem kapatma çarpısı hem "Taslaklar" bağlantısı buradan geçiyor. Önceden
   * ikisi de doğrudan `router.back()` çağırıyordu: beş adımı doldurup yanlışlıkla
   * "Taslaklar"a dokunan kullanıcı her şeyi kaybediyordu ve kaybettiğini
   * ancak geri dönünce görüyordu.
   */
  function birak(git: () => void) {
    if (adim === 0 && title.trim() === '') {
      git();
      return;
    }
    uyar('İlanı bırak', 'Girdiğin bilgiler kaydedilmeyecek.', [
      { text: 'Devam et', style: 'cancel' },
      { text: 'Bırak', style: 'destructive', onPress: git },
    ]);
  }

  /** O adımda neyin eksik olduğunu söyleyen tek cümle. */
  function ipucu(i: number): string {
    switch (i) {
      case 0:
        return 'Ürünün adını yaz — en az 3 karakter.';
      case 1:
        return 'Bir ana kategori seç.';
      case 2:
        return 'Bir alt kategori seç.';
      case 3:
        if (condition === 'Hasarlı') return 'Hasarın ne olduğunu en az bir cümleyle anlat.';
        return 'Ürünün durumunu seç.';
      case 4:
        return 'Kargo kademesini seç.';
      default:
        return '';
    }
  }

  function ileri() {
    if (!ilerleyebilir) return;
    if (!sonAdim) {
      setAdim((a) => a + 1);
      return;
    }
    void rafaEkle();
  }

  async function rafaEkle() {
    if (!user) {
      uyar('Giriş gerekli', 'İlan vermek için önce giriş yapın.', [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Giriş yap', onPress: () => router.push('/sign-in') },
      ]);
      return;
    }
    if (!category || !subCategory || !condition || !sizeClass) return;

    /* Hasar notu açıklamanın içine, ayrı bir paragraf olarak giriyor.
       Ayrı bir kolon açmak daha temiz durur ama işe yaramaz: hem alıcının
       gördüğü metin hem de değerleme modelinin okuduğu alan `description`;
       ayrı tutulsa da ikisine birleştirilerek verilecekti. "Hasar:" öneki
       bilerek sabit — metni sonradan ayırmak gerekirse tutamak orada. */
    const tamAciklama = [aciklama.trim(), hasDamage ? `Hasar: ${hasarNotu.trim()}` : '']
      .filter(Boolean)
      .join('\n\n');

    setSaving(true);
    const sonuc = await createListing({
      title: title.trim(),
      category,
      subCategory,
      condition,
      sizeClass,
      location: konum?.etiket,
      description: tamAciklama || undefined,
      hasDamage,
      isSet,
    });
    setSaving(false);

    if (!sonuc.ok) {
      uyar('İlan kaydedilemedi', sonuc.message);
      return;
    }
    // İlan taslak olarak açıldı. Yayına girmesi için kareler gerekiyor;
    // kullanıcıyı doğrudan çekim akışına alıyoruz.
    router.replace({
      pathname: '/listing-photos',
      params: {
        id: sonuc.id,
        hasDamage: hasDamage ? '1' : '0',
        isSet: isSet ? '1' : '0',
        title: title.trim(),
      },
    });
  }

  return (
    <View style={styles.root}>
      <View style={[styles.appbar, { paddingTop: insets.top }]}>
        <Pressable style={styles.iconBtn} onPress={adim === 0 ? () => birak(() => router.back()) : geri} hitSlop={8}>
          <MaterialIcons
            name={adim === 0 ? 'close' : 'arrow-back'}
            size={24}
            color={colors.onSurface}
          />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.appTitle}>Ürün ekle</Text>
          <Text style={styles.appAlt}>
            Adım {adim + 1}/{ADIM_SAYISI} · {ADIM_BASLIK[adim]}
          </Text>
        </View>
        <Pressable onPress={() => birak(() => router.replace('/drafts'))} hitSlop={8}>
          <Text style={styles.draft}>Taslaklar</Text>
        </Pressable>
      </View>

      {/* Adım çubuğu artık üç sabit parça değil, altı gerçek adım. Tamamlanan
          adımlar dolu, bulunulan adım vurgulu, gelecekler boş. */}
      <View style={styles.stepbar}>
        {ADIM_BASLIK.map((b, i) => (
          <View
            key={b}
            style={[styles.step, i < adim && styles.stepGecti, i === adim && styles.stepSimdi]}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 60}
      >
        <ScrollView
          contentContainerStyle={{ padding: 18, paddingBottom: 130 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {adim === 0 ? (
            <>
              <Text style={styles.soru}>Ürünün adı ne?</Text>
              <Text style={styles.yardim}>
                Alıcılar arama kutusuna bunu yazacak. Marka ve model biliyorsan yaz — ürünün
                değerlemesi de kolaylaşır.
              </Text>
              <View style={styles.field}>
                <TextInput
                  style={styles.input}
                  placeholder="Örn. Chicco Bravo puset"
                  placeholderTextColor={colors.onSurfaceVariant}
                  value={title}
                  onChangeText={setTitle}
                  autoFocus
                  maxLength={90}
                  returnKeyType="next"
                />
              </View>

              <Text style={[styles.flabel, { marginTop: 22 }]}>Açıklama · isteğe bağlı</Text>
              <View style={[styles.field, styles.fieldCok]}>
                <TextInput
                  style={[styles.input, styles.inputCok]}
                  placeholder="Ne kadar kullanıldı, neden satıyorsun, kutusu var mı…"
                  placeholderTextColor={colors.onSurfaceVariant}
                  value={aciklama}
                  onChangeText={setAciklama}
                  multiline
                  maxLength={600}
                  textAlignVertical="top"
                />
              </View>
              <Text style={styles.sayac}>{aciklama.length}/600</Text>
            </>
          ) : null}

          {adim === 1 ? (
            <>
              <Text style={styles.soru}>Hangi kategoriye giriyor?</Text>
              <Text style={styles.yardim}>Ürün tek bir ana kategoriye ait olabilir.</Text>
              {CATEGORY_TREE.map((c) => {
                const sel = c.name === category;
                return (
                  <Pressable
                    key={c.name}
                    onPress={() => kategoriSec(c.name)}
                    style={[styles.satir, sel && styles.satirSel]}
                  >
                    <View style={[styles.satirIkon, sel && styles.satirIkonSel]}>
                      <MaterialIcons
                        name={c.icon}
                        size={20}
                        color={sel ? colors.onPrimaryContainer : colors.onSurfaceVariant}
                      />
                    </View>
                    <Text style={[styles.satirText, sel && styles.satirTextSel]}>{c.name}</Text>
                    <MaterialIcons
                      name={sel ? 'check-circle' : 'chevron-right'}
                      size={20}
                      color={sel ? colors.primary : colors.outline}
                    />
                  </Pressable>
                );
              })}
            </>
          ) : null}

          {adim === 2 ? (
            <>
              <Text style={styles.soru}>{category} içinde nerede?</Text>
              <Text style={styles.yardim}>
                Alıcılar ürünleri alt kategoriden süzüyor; seçilmeden ilan yayına alınamaz.
              </Text>
              {subsOf(category ?? '').map((s) => {
                const sel = s === subCategory;
                return (
                  <Pressable
                    key={s}
                    onPress={() => {
                      setSubCategory(s as SubCategory);
                      setAdim(3);
                    }}
                    style={[styles.satir, sel && styles.satirSel]}
                  >
                    <Text style={[styles.satirText, sel && styles.satirTextSel]}>{s}</Text>
                    <MaterialIcons
                      name={sel ? 'check-circle' : 'chevron-right'}
                      size={20}
                      color={sel ? colors.primary : colors.outline}
                    />
                  </Pressable>
                );
              })}
            </>
          ) : null}

          {adim === 3 ? (
            <>
              <Text style={styles.soru}>Ürün hangi durumda?</Text>
              <Text style={styles.yardim}>
                Puanı bu belirliyor. Olduğundan iyi göstermek işe yaramaz — kareler
                inceleniyor ve beyanla eşleşmeyen ilan yayına girmiyor.
              </Text>
              {KONDISYONLAR.map((k) => {
                const sel = k.deger === condition;
                return (
                  <Pressable
                    key={k.deger}
                    onPress={() => setCondition(k.deger)}
                    style={[styles.satir, styles.satirUst, sel && styles.satirSel]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.satirText, sel && styles.satirTextSel]}>
                        {k.deger}
                      </Text>
                      <Text style={styles.satirAlt}>{k.aciklama}</Text>
                    </View>
                    <MaterialIcons
                      name={sel ? 'radio-button-checked' : 'radio-button-unchecked'}
                      size={20}
                      color={sel ? colors.primary : colors.outline}
                    />
                  </Pressable>
                );
              })}

              {hasDamage ? (
                <View style={styles.hasarKutu}>
                  <View style={styles.hasarBaslikSatir}>
                    <MaterialIcons name="report-problem" size={18} color={colors.tertiary} />
                    <Text style={styles.hasarBaslik}>Hasarı anlat</Text>
                  </View>
                  <Text style={styles.hasarAlt}>
                    Nesi kırık, çizik veya eksik? En az bir cümle yaz. Sonraki adımda hasarın
                    yakın çekimini de isteyeceğiz — kusuru gösteren satıcı, anlaşmazlıkta
                    korunur.
                  </Text>
                  <View style={[styles.field, styles.fieldCok, { marginTop: 10 }]}>
                    <TextInput
                      style={[styles.input, styles.inputCok]}
                      placeholder="Örn. Sol arka tekerleğin jantı çatlak, dönmesini engellemiyor."
                      placeholderTextColor={colors.onSurfaceVariant}
                      value={hasarNotu}
                      onChangeText={setHasarNotu}
                      multiline
                      maxLength={300}
                      textAlignVertical="top"
                    />
                  </View>
                  <Text style={styles.sayac}>
                    {hasarNotu.trim().length < 10
                      ? `En az 10 karakter — ${hasarNotu.trim().length}/10`
                      : `${hasarNotu.length}/300`}
                  </Text>
                </View>
              ) : null}

              {/* Set beyanı burada duruyor çünkü kondisyonla aynı işi yapıyor:
                  ikisi de hangi karelerin isteneceğini belirliyor. Ayrı bir
                  adım açmak, tek onay kutusu için bir ekran harcamak olurdu. */}
              <Pressable style={styles.beyan} onPress={() => setIsSet(!isSet)}>
                <MaterialIcons
                  name={isSet ? 'check-box' : 'check-box-outline-blank'}
                  size={24}
                  color={isSet ? colors.primary : colors.outline}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.beyanText}>Ürün bir set (birden çok parça)</Text>
                  <Text style={styles.beyanAlt}>
                    Parçaların tamamını gösteren bir kare isteyeceğiz
                  </Text>
                </View>
              </Pressable>
            </>
          ) : null}

          {adim === 4 ? (
            <>
              <Text style={styles.soru}>Kutulanmış hâli ne kadar yer tutuyor?</Text>
              <Text style={styles.yardim}>
                Kargo bedelini bu belirliyor ve alıcı ödüyor. Ürünü paketledikten sonraki
                kutuyu düşün; emin değilsen bir üst kademeyi seç.
              </Text>

              {SIZE_CLASSES.map((sc) => {
                const bilgi = SIZE_INFO[sc];
                const sel = sc === sizeClass;
                return (
                  <Pressable
                    key={sc}
                    onPress={() => setSizeClass(sc)}
                    style={[styles.kutuKart, sel && styles.kutuKartSel]}
                  >
                    <View style={styles.kutuUst}>
                      <View style={[styles.kutuRozet, sel && styles.kutuRozetSel]}>
                        <Text style={[styles.kutuRozetText, sel && styles.kutuRozetTextSel]}>
                          {sc}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.kutuOlcu, sel && styles.satirTextSel]}>
                          {bilgi.enCm} × {bilgi.boyCm} × {bilgi.yukseklikCm} cm
                          {bilgi.ustSinirsiz ? ' ve üzeri' : ''}
                        </Text>
                        <Text style={styles.kutuAlt}>
                          {bilgi.ustSinirsiz ? `${bilgi.maxKg} kg üzeri` : `en fazla ${bilgi.maxKg} kg`}{' '}
                          · {bilgi.desi}
                        </Text>
                      </View>
                      <MaterialIcons
                        name={sel ? 'radio-button-checked' : 'radio-button-unchecked'}
                        size={20}
                        color={sel ? colors.primary : colors.outline}
                      />
                    </View>

                    <KutuCizimi
                      enCm={bilgi.enCm}
                      boyCm={bilgi.boyCm}
                      yukseklikCm={bilgi.yukseklikCm}
                      /* 18 kenar boşluğu × 2, kartın 14 dolgusu × 2. */
                      genislik={Math.min(width, 520) - 36 - 28}
                      secili={sel}
                    />

                    <Text style={styles.kutuOrnek}>
                      {bilgi.ornek} · alıcı yaklaşık {bilgi.kargoTl} ₺ kargo öder
                    </Text>
                  </Pressable>
                );
              })}

              <Text style={styles.kutuNot}>
                Kesik çizgili siluet en büyük kademeyi gösteriyor; kutular aynı ölçekte
                çizildi. Kargo bedeli desi ile kilonun büyüğünden hesaplanır.
              </Text>
            </>
          ) : null}

          {adim === 5 ? (
            <>
              <Text style={styles.soru}>Ürün nerede?</Text>
              <Text style={styles.yardim}>
                İlçeni yaz ve listeden seç. İlanında yalnızca ilçe ve il görünür — adresin,
                mahallen ve mesafen hiçbir yerde yayınlanmaz.
              </Text>

              {konum ? (
                <View style={styles.secilenKonum}>
                  <MaterialIcons name="place" size={20} color={colors.onPrimaryContainer} />
                  <Text style={styles.secilenKonumText}>{konum.etiket}</Text>
                  <Pressable
                    onPress={() => {
                      setKonum(null);
                      setKonumSorgu('');
                    }}
                    hitSlop={10}
                  >
                    <MaterialIcons name="close" size={18} color={colors.onPrimaryContainer} />
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={[styles.field, styles.arama]}>
                    <MaterialIcons name="search" size={20} color={colors.onSurfaceVariant} />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="İlçe veya il ara — örn. Kadıköy"
                      placeholderTextColor={colors.onSurfaceVariant}
                      value={konumSorgu}
                      onChangeText={setKonumSorgu}
                      autoCorrect={false}
                      autoCapitalize="words"
                    />
                    {konumSorgu.length > 0 ? (
                      <Pressable onPress={() => setKonumSorgu('')} hitSlop={10}>
                        <MaterialIcons name="cancel" size={18} color={colors.outline} />
                      </Pressable>
                    ) : null}
                  </View>

                  {konumSorgu.trim().length >= 2 && konumSonuclari.length === 0 ? (
                    <Text style={styles.bosSonuc}>
                      "{konumSorgu.trim()}" ile eşleşen ilçe yok. Türkçe karakter yazmana
                      gerek yok — "kadikoy" da bulur.
                    </Text>
                  ) : null}

                  {konumSonuclari.map((k) => (
                    <Pressable
                      key={k.etiket}
                      style={styles.satir}
                      onPress={() => {
                        setKonum(k);
                        setKonumSorgu('');
                      }}
                    >
                      <Text style={styles.satirText}>{k.ilce}</Text>
                      <Text style={styles.satirIl}>{k.il}</Text>
                    </Pressable>
                  ))}
                </>
              )}

              {/* Değerleme neyin ne zaman olacağını burada anlatıyor: son
                  adımdaki kullanıcı "devam" düğmesine basınca puan bekliyor
                  ve puan orada çıkmıyor. Eskiden bu metnin yerinde uydurma
                  bir puan tablosu vardı — sabit 500 taban, sahte çarpanlar. */}
              <View style={styles.degerlemeKutu}>
                <Text style={styles.degerlemeBaslik}>Puanı sen belirlemiyorsun</Text>
                <Text style={styles.degerlemeMetin}>
                  Kareleri çektikten sonra ürünün sıfır fiyatı bulunacak ve durumuna göre
                  takas puanı hesaplanacak. Bu, herkesin ilanının aynı ölçüyle değerlenmesi
                  için.
                </Text>
              </View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.actionbar, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable style={[styles.cta, !ilerleyebilir && styles.ctaOff]} disabled={!ilerleyebilir} onPress={ileri}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              {sonAdim ? <MaterialIcons name="photo-camera" size={20} color="#fff" /> : null}
              <Text style={styles.ctaText}>
                {sonAdim ? 'Devam et: Fotoğraflar' : 'Devam'}
              </Text>
            </>
          )}
        </Pressable>
        {/* İpucu artık tek bir genel cümle değil, o adıma ait eksiği söylüyor.
            Eskiden "başlık, kategori ve ürün durumunu seç" yazıyordu ve
            kullanıcı hangisinin eksik olduğunu deneyerek buluyordu. */}
        {!ilerleyebilir && !saving ? <Text style={styles.ctaHint}>{ipucu(adim)}</Text> : null}
        {sonAdim && ilerleyebilir && !konum ? (
          <Text style={styles.ctaHint}>Konum seçmezsen ilanında konum satırı görünmez.</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingBottom: 4 },
  appTitle: { fontSize: 15, fontWeight: '800', paddingLeft: 8, color: colors.onSurface },
  appAlt: { fontSize: 11.5, fontWeight: '600', paddingLeft: 8, color: colors.onSurfaceVariant, marginTop: 1 },
  draft: { color: colors.primary, fontWeight: '700', fontSize: 14, paddingHorizontal: 12 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  stepbar: { flexDirection: 'row', gap: 5, paddingHorizontal: 18, paddingBottom: 12 },
  step: { flex: 1, height: 4, borderRadius: shape.full, backgroundColor: colors.surfaceContainerHighest },
  stepGecti: { backgroundColor: colors.primaryContainer },
  stepSimdi: { backgroundColor: colors.primary },

  soru: { fontSize: 21, fontWeight: '800', color: colors.onSurface, letterSpacing: -0.3 },
  yardim: { fontSize: 13, lineHeight: 19, color: colors.onSurfaceVariant, fontWeight: '500', marginTop: 6, marginBottom: 18 },

  flabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  field: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: shape.sm,
    backgroundColor: colors.surfaceContainerHigh,
    justifyContent: 'center',
  },
  fieldCok: { minHeight: 110, paddingVertical: 12 },
  arama: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  input: { fontSize: 15, color: colors.onSurface },
  inputCok: { minHeight: 86, lineHeight: 21 },
  sayac: { fontSize: 11, color: colors.onSurfaceVariant, fontWeight: '600', textAlign: 'right', marginTop: 6 },

  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: shape.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    marginBottom: 8,
  },
  satirUst: { alignItems: 'flex-start' },
  satirSel: { borderColor: colors.primary, backgroundColor: colors.primaryContainer },
  satirIkon: {
    width: 36,
    height: 36,
    borderRadius: shape.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
  },
  satirIkonSel: { backgroundColor: colors.surfaceContainerLowest },
  satirText: { flex: 1, fontSize: 14.5, fontWeight: '700', color: colors.onSurface },
  satirTextSel: { color: colors.onPrimaryContainer },
  satirAlt: { fontSize: 12.5, color: colors.onSurfaceVariant, fontWeight: '500', marginTop: 3, lineHeight: 17 },
  satirIl: { fontSize: 12.5, fontWeight: '600', color: colors.onSurfaceVariant },
  bosSonuc: { fontSize: 13, lineHeight: 19, color: colors.onSurfaceVariant, fontWeight: '500', paddingVertical: 8 },

  hasarKutu: {
    borderRadius: shape.md,
    backgroundColor: colors.tertiaryContainer,
    padding: 14,
    marginTop: 4,
    marginBottom: 6,
  },
  hasarBaslikSatir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hasarBaslik: { fontSize: 14, fontWeight: '800', color: colors.onTertiaryContainer },
  hasarAlt: { fontSize: 12.5, lineHeight: 18, color: colors.onTertiaryContainer, fontWeight: '500', marginTop: 5 },

  beyan: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, marginTop: 4 },
  beyanText: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  beyanAlt: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500', marginTop: 2 },

  kutuKart: {
    borderRadius: shape.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    padding: 14,
    marginBottom: 10,
  },
  kutuKartSel: { borderColor: colors.primary, borderWidth: 1.5 },
  kutuUst: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  kutuRozet: {
    minWidth: 44,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: shape.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
  },
  kutuRozetSel: { backgroundColor: colors.primary },
  kutuRozetText: { fontSize: 13, fontWeight: '800', color: colors.onSurfaceVariant },
  kutuRozetTextSel: { color: colors.onPrimary },
  kutuOlcu: { fontSize: 14.5, fontWeight: '700', color: colors.onSurface },
  kutuAlt: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant, marginTop: 2 },
  kutuOrnek: { fontSize: 12.5, fontWeight: '500', color: colors.onSurfaceVariant, marginTop: 4 },
  kutuNot: { fontSize: 12, lineHeight: 18, fontWeight: '500', color: colors.onSurfaceVariant, marginTop: 4 },

  secilenKonum: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: shape.md,
    backgroundColor: colors.primaryContainer,
  },
  secilenKonumText: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.onPrimaryContainer },

  degerlemeKutu: {
    marginTop: 20,
    padding: 14,
    borderRadius: shape.md,
    backgroundColor: colors.surfaceContainerLow,
    ...elevation.level1,
  },
  degerlemeBaslik: { fontSize: 13.5, fontWeight: '800', color: colors.onSurface },
  degerlemeMetin: { fontSize: 12.5, lineHeight: 19, color: colors.onSurfaceVariant, fontWeight: '500', marginTop: 5 },

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
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  ctaOff: { opacity: 0.45 },
  ctaHint: { textAlign: 'center', color: colors.onSurfaceVariant, fontSize: 12, fontWeight: '500', marginTop: 8 },
});
