# ELDENELE — Yol Haritası / TODO

Son güncelleme: 2026-08-14 · Branch: `main`

## 🟢 Supabase artık gerçek

Proje **kids-trade** · ref `fauhxnbxwcpsdfcvfodz` · eu-central-1 (Frankfurt) ·
PostgreSQL 17.6 · "Bot" organizasyonu (Pro).
URL: `https://fauhxnbxwcpsdfcvfodz.supabase.co`

Bugüne kadar 21 göç ve 16 test paketi **yalnızca yereldeki test Postgres'inde**
koşmuştu. Artık şema gerçek projede: 24 tablo (hepsinde RLS), 43 politika,
7 depolama politikası, 67 fonksiyon, 2 cron görevi, 2 kova. Dört Edge Function
da yayında — `config.toml`'daki JWT kararlarıyla: `iyzico-callback` ve
`send-sms` muaf, `cargo-payment-init` ve `photo-check` oturum ister.

Bir sapma: `products` göçündeki **4 demo ilanı uygulanmadı**. `seller_id`
alanları boş olduğu için `create_trade()` onları reddediyor; rafta durup
alınamayan sahte ilan olurlardı.

## ✅ Tamamlandı

### Tasarım & uygulama iskeleti
- [x] Material Design 3 v2 tasarımı (HTML mockup + render görüntüleri, `archive/` + `screens/`)
- [x] Expo SDK **54** + RN 0.81 + Expo Router (TS strict), EAS config
- [x] Marka uygulama ikonu + splash; önceki HTML projesi `archive/`'e taşındı
- [x] Expo Go ile cihazda çalıştırma doğrulandı

### Gezinme (özel alt menü)
- [x] `Anasayfa · Sepetim · Ürün Ekle (ortada yükseltilmiş) · Favoriler · Hesabım`
- [x] Keşfet → Anasayfa'ya katıldı (arama + kategori filtresi)
- [x] Takaslar & Cüzdan → Hesabım (Profil) altına taşındı

### Ekranlar (mock veri + tema uyumlu)
- [x] Anasayfa, Ürün Detayı, Sepetim, Favoriler, Profil/Hesabım
- [x] Ürün Ekle, Takas durumu, Cüzdan, Bildirimler, Sohbet, Mesajlarım
- [x] Adreslerim, Güvenlik & doğrulama, Yardım & güvenli havuz, Davet et, Profili düzenle
- [x] Onboarding + e-posta giriş/kayıt ekranı

### İşlevler
- [x] **Kategoriler** — matris dokümanının 9 ana + 62 alt kategorisi (tek kaynak
      `data/categories.ts`, ikon eşlemeli); rafta iki kademeli süzgeç, ilan
      formunda alt kategori zorunlu (2026-08-13)
- [x] **Favori** — kalp toggle, AsyncStorage'da kalıcı (`lib/favorites.tsx`)
- [x] **Sepet** — alma sepeti, toplam puan + bakiye kontrolü (`lib/cart.tsx`)
- [x] **Paylaş** — native Share (WhatsApp/mesaj/e-posta)
- [x] Tüm buton bağlantıları (dead-end yok)

### Marka revizyonu (2026-08-13)
- [x] **Uygulama ELDENELE oldu.** Marka revizyonu 12 Ağustos'ta yalnızca siteye
      uygulanmış, uygulama "KIDS TRADE" adını ve `#1f6b4f` yeşil paletini
      taşımaya devam etmişti. Reklam filmi için ekran kaydı alınırken çıktı.
      - Palet: M3 tonları marka turkuazından **hesaplandı** (OKLCH; ton ekseni
        CIE L*, hue ve kroma sabit, gamut dışı ton kroma düşürülerek geri
        çekiliyor). Göz kararı seçilmedi — sitede bir kez denendi, yanlış çıktı.
      - `primary` **`#00718A`**, `#008BAA` değil: beyaz metin `#008BAA` üzerinde
        3.98 kontrast veriyor (AA eşiği 4.5) ve doldurulmuş düğmelerin çoğu
        15–16 piksel metin taşıyor. `#00718A` aynı ölçümde 5.63 ve marka
        dokümanının kendi "koyu turkuaz" türevi. Kimlik yüzeyleri (gradyan,
        simge, logo zemini) `colors.brand` ile tam `#008BAA` kalıyor.
      - Logo: `components/brand/Wordmark.tsx` + `Mark.tsx`, konturlar sitenin
        `eldenele-logo.svg` ve `favicon.svg` dosyalarından birebir; PNG değil
        vektör, react-native-svg ile.
      - Simgeler sitenin `apple-touch-icon.png` tarifiyle üretildi: zemin
        `#008BAA`, harf `#FDF8EF`. *(2026-08-14'te amblemle değişti — aşağı bak.)*
      - Marka adı, şema ve paylaşım metinleri tek kaynakta: `lib/brand.ts`.
        Ad cümle içinde **"Eldenele"** (sitenin düz metin yazımı).
      - Onboarding metni sitenin onaylı birinci hero slaytıyla değişti; eskisi
        yalnızca "oyuncak, kitap ve montessori" diyerek ürünü dokuz kategoriden
        çok daha dar tanıtıyordu.
      - Ölü bağlantı kalktı: paylaşım metinleri `kidstrade.app` adresine
        gidiyordu, o alan adı bize ait değil.

### Cihazda bulunan üç kusur daha (2026-08-14)
- [x] **Puan `$` ile gösteriliyordu.** Dört yerde `MaterialIcons name="paid"` —
      daire içinde dolar işareti. Eldenele kapalı devre: Takas Puanı para değil,
      para birimine çevrilmiyor, çekilemiyor. Ürünün yanındaki `$` kullanıcıya
      fiyat okuduğunu söylüyordu. Site en baştan beri kendi taşını kullanıyor;
      uygulama geride kalmıştı. `components/brand/Diamond.tsx` sitedeki
      `src/components/icons/Diamond.tsx` ile birebir aynı konturu taşıyor ve
      **iki dosya bilerek aynı adı taşıyor** — parite arandığında ikisi birden
      bulunsun diye. Değiştirilen yerler: ürün kartı, öne çıkan kart, sepet,
      onboarding "Takas Puanı" hapı.

      > Onboarding hapında site aslında `Coin` kullanıyor, `Diamond` değil.
      > Orada da taş kondu: `Coin` konturlu bir marka ikonu ve uygulamanın
      > tamamı `MaterialIcons`; tek bir yüzeye ikinci bir ikon seti sokmak,
      > CLAUDE.md'nin sitede yasakladığı karışımın aynısı olurdu. Bir kavram,
      > bir işaret.
- [x] **Arama çubuğundaki mikrofon çalışmıyordu.** `Pressable` bile değildi —
      dokunmaya hiç cevap vermeyen, çizilmiş bir resim. Arkasında sesli arama
      yok, uygulama konuşma tanıma paketi taşımıyor. Kaldırıldı. Sesli arama
      gerçekten istenirse `expo-speech-recognition` + mikrofon izni gerekiyor;
      o iş yapılırsa simge de birlikte geri gelir.
- [x] **Uyarı kutuları uygulamadan değil telefondan geliyordu.** 36 çağrı
      `Alert.alert` kullanıyordu; o işletim sisteminin kendi kutusunu açar —
      iOS'ta sistem grisi ve San Francisco, Android'de Material varsayılanı.
      Hiçbiri uygulamanın kremini, turkuazını, yuvarlaklığını taşımıyordu ve
      kutu "başka bir mesaj" gibi okunuyordu; haklı olarak, gerçekten başka bir
      katmandan geliyordu. `components/Dialog.tsx` uygulama içi bir diyalog
      açıyor. Çağrı biçimi bilerek `Alert.alert` ile aynı (başlık, gövde, düğme
      dizisi), böylece 36 yerin değişimi `Alert.alert` → `uyar` oldu. Modül
      düzeyinde bir işlev, kanca değil: `lib/` altından da çağrılabilsin ve 36
      çağrı yerine kanca bağlantısı dolaştırmak gerekmesin diye. Android geri
      tuşu iptal düğmesini işletiyor, perdeye dokunmak yalnızca iptal edilebilir
      diyalogları kapatıyor (tek düğmeli bilgi kutusunu perdeyle geçmek, mesajı
      okumadan geçmeyi kolaylaştırırdı) ve üst üste gelen istekler kuyruğa
      giriyor — iki modal aynı anda açılınca Android ikincisini hiç
      göstermiyor.

### Cihazda bulunan dört kusur (2026-08-14)
- [x] **Bildirim rozeti okuduktan sonra da duruyordu.** İki ayrı sebep vardı ve
      ilki daha ağır: bildirimleri okundu işaretlemenin **tek** yolu başlıktaki
      küçük `done-all` simgesiydi. Listeyi açmak hiçbir şeyi okundu saymıyordu,
      yani rozet aslında doğruyu söylüyordu — kullanıcının yaptığı şey okumaktı
      ama sistem için okunmamışlardı. Artık listeyi açmak okundu sayılıyor;
      yerel liste bilerek yeniden çekilmiyor ki o ziyarette hangilerinin yeni
      olduğu vurgulu kalsın. Düğme kalktı. İkinci sebep: rozeti besleyen
      `useEffect(..., [])` yalnızca ekran ilk kurulduğunda koşuyordu ve sekme
      ekranları arka planda canlı kaldığı için geri dönmek onu hiç yeniden
      çalıştırmıyordu → `useFocusEffect`.
- [x] **"1 okunmamış mesaj" derken gelen kutusu boştu.** Profildeki satır
      mesajları değil **bildirimleri** sayıyordu (`unreadCount`). İlan yayına
      alınınca bildirim düşüyor, mesaj düşmüyor; sayı 1 oluyor ve Mesajlarım
      bomboş açılıyordu. Yeni `unreadMessageCount()` sohbetlerin okunmamış
      toplamını döndürüyor.
- [x] **Ürün galerisinde kare ortalanmıyordu**, solunda bir öncekinden şerit
      kalıyordu. `pagingEnabled` ScrollView'ün *kendi* genişliğinin katlarına
      kilitler; sayfalar ise JS'te `Dimensions.get('window').width - 36` ile
      çiziliyordu. Bu değer çoğu Android cihazda kesirli (ör. 411.4285…), düzen
      motoru fiziksel piksele yuvarlıyor ve sayfa başına birkaç piksellik fark
      beşinci karede birikip görünür hâle geliyordu. Genişlik artık `onLayout`
      ile ölçülüyor; sayfa genişliği kabın ölçülen genişliğinin ta kendisi,
      ikisi tanımı gereği ayrışamıyor. Tarayıcıda doğrulandı: içerik/kap =
      **4.000**, kalansız.
- [x] **İncelemeden geçen kare "henüz çekilmedi" görünüyordu.** Önizleme
      yalnızca `yerel[slot]`e — o oturumda seçiciyle çekilen dosyaya — bakıyordu.
      Ekrana geri dönünce `yerel` boş olduğu için yüklenmiş, hatta onaylanmış
      bir kare bile boş kutu olarak çiziliyordu; durum çipi "İncelemeden geçti"
      derken hemen üstünde "Bu kare henüz çekilmedi" yazıyordu. `loadPhotos`
      artık imzalı bağlantı da döndürüyor (`listing-photos` özel kova, depo yolu
      tek başına gösterilemez) ve önizleme yerel dosya yoksa sunucudaki kareyi
      çiziyor. Ayrıca kare bitmişse çekim düğmeleri sönükleşiyor ve birincisi
      "Yeniden çek" oluyor — yapılacak iş artık çekmek değil, yayına almak.
      Yetenek kaybolmuyor, yalnızca vurgu düşüyor; reddedilen karede düğmeler
      dolu kalıyor. "İnceleme durumunu yenile" de yalnızca beklerken görünüyor.

### Açılış ekranı ve simgeler (2026-08-14)
- [x] **Simge ve açılış görselleri marka amblemine geçti.** Öncesinde tek
      harflik işaretti; marka paketi sayfası elimize geçince ana amblem
      (eller + çocuk eşyaları) ayıklandı ve dördü birden yenilendi.
      Ayrıntılar `mobile/assets/README.md` içinde, özeti:
      - **Açılışta üç ayrı katman var** ve karıştırılması kolay: Expo Go'nun
        yükleme ekranı (`app.json`'daki `icon` + `name`; `splash.png`'yi *hiç*
        kullanmaz), yerel açılış ekranı (`splash.png`, yalnızca kendi
        derlemende) ve JS tarafındaki yeni `AcilisEkrani`. Üçüncüsünde çıplak
        bir dönen çember vardı — marka açılışın en görünür saniyesinde yoktu.
      - `AcilisEkrani` kilidi parçalardan kurmuyor, `splash.png`'nin kendisini
        aynı `contain` kuralıyla çiziyor. Parçalardan kurulduğunda slogan
        görselde Nunito 800, uygulamada sistem yazı tipiyle çiziliyordu; aynı
        cümle iki farklı yüzle görünüyordu.
      - Slogan **"Paylaş, değiştir, mutlu et!"** yalnızca açılış ekranında,
        kaynağı `lib/brand.ts` içindeki `SLOGAN`.
      - Uyarlanabilir simgenin zemini `#008BAA` idi; amblemin kendi turkuaz
        kolu o zeminde kayboluyordu, beyaza alındı.
      - **Çözünürlük sınırı:** amblemin en büyük kopyası **452 px** (kaynak
        WhatsApp'tan gelen 1448×1086 tek sayfa). Cihazdaki her boy için
        yeterli — simge 180'e, açılıştaki amblem 450'ye iniyor. App Store'un
        1024 px liste simgesi için **yetmiyor**; yayın kontrol listesine madde
        olarak eklendi.
      - **Palet farkı karara bağlandı:** marka paketi sayfası ana turkuazı
        `#00B8AA` yazıyor, biz `#008BAA` kullanıyoruz. Sayfa takip
        edilmiyor — palet `#008BAA` kalıyor.

### Canlı vitrin (2026-08-14)
- [x] **Uygulamadaki vitrin sitede görünüyor.** Site veri tabanına bağlanmıyor;
      `scripts/vitrin-cek.mjs` (karşı repo) derleme anında anlık görüntü
      üretiyor. İlk canlı ilan "Suluk" uçtan uca doğrulandı: ilan → yedi kare →
      yönetici onayı → `publish_listing()` → derleme → sitede kart.
- [x] **Tazeleme otomatik.** `20260814100000_vitrin_tazele.sql`: `pg_net`,
      `site_settings` (RLS açık, politika yok, yetkiler geri alınmış),
      `vitrin_tazele()` ve `products` üzerinde trigger. ACTIVE'e giren **ve
      çıkan** her geçiş tetikliyor — yalnızca girişi dinleseydik satılan ilan
      vitrinde asılı kalırdı. 60 saniyelik gecikme sayacı derleme yağmurunu
      kesiyor. Canlıda sınandı: HTTP 201, ikinci çağrı "atlandı: 23 saniye önce".

### Profil gerçekten kaydediyor (2026-08-14)
- [x] **`edit-profile` maketti.** Alanlar sabit metinle ("Emrah Atabek",
      "Kadıköy, İstanbul") doluyordu, iki kaydet düğmesi de yalnızca
      `router.back()` çağırıyordu. Kaydettiğini söyleyip hiçbir şey
      kaydetmiyordu — kusurun en kötü türü.
      Gelenler: `profiles` tablosu (RLS, yalnızca kendi satırı),
      `update_profile()` RPC'si, `lib/profile.ts` içinde oku/yaz katmanı,
      ekranda gerçek değerler + kaydediliyor durumu + hata mesajı.
- [x] **Kendi ilanlarındaki ad kopyası tazeleniyor.** `seller_name` denormalize;
      güncellenmeseydi profilde "Emrah Atabek", vitrinde "emrahatabek" kalırdı.
      Canlıda geri alınan bir işlemde sınandı: kopya doğru tazelendi.
- [x] **Sabit kişisel metin temizlendi.** "Merhaba, Emrah" → gerçek ad,
      arama çubuğundaki "EA" rozeti → gerçek baş harfler, profil ekranındaki
      e-posta türevi ad → profil adı.
- [x] **Uydurma sayı kalktı:** rafta "Kadıköy · 1.248 ürün takasta" yazıyordu.
      Artık yüklenen gerçek ilan sayısı.
- [x] **Boş "Öne çıkan takaslar" bölümü** rozetli ilan yoksa hiç çizilmiyor
      (sitede de aynı kusur vardı, aynı turda kapandı).

### Ekran denetimi — uydurma veri temizliği (2026-08-14)

Yirmi iki ekranın hepsi telefon kadrajında yakalanıp tek tek incelendi.
Onu kusurluydu; hepsi kapandı. Ortak kusur şuydu: **maket verisi gerçek
veriymiş gibi duruyordu.**

- [x] **Güvenlik ekranı olmayan bir doğrulamayı onaylı gösteriyordu.**
      “T.C. Kimlik doğrulaması · Onaylandı” yazıyordu — böyle bir doğrulama
      hiç yapılmadı ve Ana Doküman T.C. kimlik numarasının saklanmadığını
      söylüyor. Satır tamamen kaldırıldı: saklamayacağımız bir veriyi
      doğrulama listesinde tutmak, ileride saklayacağımızı ima eder.
      Gömülü `blaixs@gmail.com` ve `0532 *** ** 41` yerine oturumun kendi
      e-postası ve gerçek doğrulanma durumu. Hiçbir şeye bağlı olmayan
      “iki adımlı doğrulama” ve “biyometrik giriş” anahtarları silindi;
      “şifre değiştir” artık gerçekten sıfırlama bağlantısı gönderiyor.
- [x] **Güven skoru iki ekranda çelişiyordu.** Cüzdan “96”, Hesabım “henüz
      oluşmadı” diyordu. Kök sebep `lib/wallet.ts` içindeydi: canlı yolda
      bile `trustScore: 96` sabit yazılıydı. Artık `profile_stats`ten geliyor
      ve null olabiliyor.
- [x] **Hesabım kendi içinde çelişiyordu.** “Yayındaki ilan 0” derken üç sabit
      ürün fotoğrafı gösteriyordu; “Mesajlarım · 2 okunmamış” rozeti varken
      Mesajlarım ekranı boştu. İkisi de gerçek sayıya bağlandı.
- [x] **Adreslerim iki sahte adres gösteriyordu** (gerçek görünümlü sokak
      bilgisi, maskeli telefon). Dürüst boş durumla değişti; defterin açılması
      hâlâ bekleyen bir KVKK kararı ve ekran artık bunu söylüyor.
- [x] **Davet ekranında sahte davet listesi vardı.** Kimse davet edilmemişken
      “Ayşe K. · Katıldı +100 puan” yazıyordu.
- [x] **Giriş ekranı eski dairesel logo işaretini taşıyordu** — marka
      revizyonunda atlanmıştı.

Yöntem not: ekranlara ulaşmak için anahtarsız bir web derlemesi alındı;
`supabaseConfigured` false olunca oturum kapısı uygulanmıyor. Metro önbelleği
eski anahtarları yeniden kullandığı için `--clear` şart.

### Güvenlik (P0 — 2026-08-07)
- [x] **Defter değişmezliği** — `wallet_entries` üzerinde UPDATE/DELETE trigger ile
      engellendi; `service_role` dahil hiçbir rol geçemez
- [x] **`earn_points` idempotent** — idempotency anahtarı zorunlu; tekrar denemede
      bonus ikinci kez yazılmıyor. hold/release/refund'a türetilmiş anahtarlar eklendi
- [x] **İlan fiyat kilidi** — satıcı `points` ve `status` kolonlarını doğrudan
      değiştiremiyor; fiyat yalnızca `set_product_points()` ile ve yalnızca aşağı
- [x] **Sunucu tarafı fiyatlandırma** — `shipping_rates` + `fee_settings` +
      `quote_trade_price()`; tutar artık istek gövdesinden gelmiyor
- [x] **Ödeme yetkilendirmesi** — `cargo-payment-init` çağıranı bearer token'dan
      çözüyor ve takasın alıcısı olduğunu doğruluyor
- [x] **Callback idempotency** — işlenmiş ödeme tekrar işlenmiyor; takas durumu
      yalnızca POINTS_HELD → SHIPPED yönünde ilerliyor, geriye sarmıyor
- [x] `supabase/config.toml` — JWT muafiyeti artık repoda yazılı, deploy bayrağında değil
- [x] **Ürün rezervasyonu** — `create_trade()` ürünü kilitleyip rezerve ediyor;
      yabancı anahtar + kısmi benzersiz indeks aynı ürüne ikinci takası engelliyor;
      trigger ilan durumunu takasla senkron tutuyor (COMPLETED→SOLD, REFUNDED→ACTIVE)
- [x] **İlan ekleme gerçek** — `create_listing()` RPC'si; form desi kademesi ve konum
      soruyor, "Rafa ekle" gerçekten `products`'a yazıyor
- [x] **Satın alma gerçek** — "Takas et" `create_trade()` çağırıyor; onay diyaloğu,
      sunucudan gelen kargo/hizmet/işlem payı kırılımı, hata mesajları
- [x] **Satıcı kendi ilanını görebiliyor** — `products` SELECT politikası yalnızca
      ACTIVE diyordu; satılan ilan "Yayınladığım İlanlar"dan düşüyordu
- [x] **YEDİ KARE — yönlendirmeli fotoğraf çekimi** (Ana Doküman 4.2)
      İlan artık `DRAFT` açılıyor ve vitrine ancak kareler tamamlanıp incelemeden
      geçince çıkıyor. `product_photos` tablosu + `photo_slot` tipi, `listing-photos`
      depolama kovası (klasör sahipliğine bağlı politikalar), `required_slots()` ve
      `publish_listing()` kapısı. Uygulama tarafında `app/listing-photos.tsx` kullanıcıyı
      ürünün etrafında dolaştırıyor: ön · arka · sol · sağ · etiket zorunlu, hasar beyan
      edilmişse yakın çekim, set ise parça bütünlüğü. Her kare `photo-check` Edge
      Function'ında yapay zekâya inceletiliyor (çocuk yüzü, arka plan, stok görsel,
      bulanıklık, yanlış açı). **Şüphede onay yok:** servis erişilemezse kare `pending`
      kalır, kapı `pending`i geçirmez, ilan insan kuyruğunda bekler.
      Kapak `is_cover` ile işaretleniyor; `products.image_key` artık kapağın türevi
- [x] **Puan havuzdan çıkıyor** — puanı havuza alan uç bağlıydı, çıkaran uç açıktı:
      `release_points()` yazılıydı ama kimse çağırmıyordu, satıcı puanını hiç
      alamıyordu. Ayrıca kargo bedelini ödemeyen alıcının puanı sonsuza kadar
      havuzda kalıyor, ilan `RESERVED`'de takılıyordu — sessiz sızıntı.
      Gelenler: `trade_timings` (1 saat ödeme · 3 gün şube · 48 saat onay),
      takvim kolonları ve damgaları trigger'da basan `trades_stamp_timeline()`,
      alıcıya `confirm_delivery()` ve `open_dispute()`, kargo tarafına
      `mark_delivered()`, hepsini toplayan `expire_stale_trades()` ve saatlik
      pg_cron görevi. Satıcı kendi takasını onaylayamaz; itiraz sayacı durdurur;
      ödemesi alınmış takas zaman aşımıyla iade edilmez, uyarı verip insana kalır
- [x] **48 saat otomatik onay** — teslimattan sonra sayaç işliyor, dolunca puan
      satıcıya geçiyor (`expire_stale_trades`)
- [x] **Takaslar ekranı → canlı `trades`** — mock zaman çizelgesi kaldırıldı;
      durum, kalan süre, "Teslim aldım" ve "Sorun var" gerçek RPC'lere gidiyor
- [x] **Yaptırım merdiveni (Ana Doküman 5.5)** — beş olay skoru düşürüyordu ama
      düşük skorun hiçbir sonucu yoktu: ceza sayılıyor, uygulanmıyordu.
      `sanction_settings` + `user_sanctions`; uyarı ve kısıt otomatik, **kalıcı
      kapatma her zaman insan kararı** (5.5). Kısıtın dişi var: trigger yeni
      ilanı ve yeni takası durduruyor — kayıt tutmak yaptırım değildir.
      Süren takaslar tamamlanabiliyor, testi bunu ayrıca sınıyor.
      Yanlış uygulanan kısıt `admin_lift_sanction()` ile kaldırılabiliyor:
      otomatik bir karar, itiraz edilemez bir karar olmamalı.
      **Merdiven KAPALI kuruluyor** — eşikler kurucu kararı (yukarıdaki maddeye
      bakın). Profilde yaptırım en üstte yazılı: kullanıcı kısıtlı olduğunu bir
      işlem denerken hata mesajından öğrenmemeli
- [x] **Mesaj şikâyeti ve moderasyonu** — sohbeti açtık ve içeriğine bakan kimse
      yoktu. `message_reports` + sohbette basılı tutarak şikâyet + panelde
      üçüncü kuyruk. **Platform dışına çıkarma girişimi** (telefon/IBAN) sistem
      tarafından otomatik işaretleniyor ama **mesaj engellenmiyor**: "0-3 yaş"
      da rakam dizisidir ve masum bir cümleyi durdurmak kullanıcıyı gerçekten
      başka kanala iter. İşaret yalnızca insana bakılacak kuyruk üretiyor.
      **Açık şikâyet skoru düşürmez** — yalnızca onaylanmış ihlal düşürür;
      aksi hâlde şikâyet bir silaha dönüşürdü. İhlalde mesaj silinmiyor
      (uyuşmazlıkta kanıt), sonuç güven skoruna yazılıyor ve iki tarafa da
      bildiriliyor
- [x] **Mesajlaşma** — sohbet ekranları sabit metinlerle doluydu, iki kullanıcı
      birbirine tek kelime yazamıyordu. Bedeli yalnızca eksik özellik değildi:
      itiraza giden soruların çoğu ("kutusu var mı", "şu çizik ne kadar derin")
      konuşularak çözülür.
      Sohbet **ürüne** bağlı, takasa değil — alıcının satın almadan önce soru
      sorabilmesi gerekiyor; takas açılınca aynı sohbet devam ediyor.
      Gönderilmiş mesaj değiştirilemiyor ve silinemiyor: uyuşmazlıkta konuşma
      kaydı kanıttır, sonradan düzenlenebilen kanıt kanıt değildir.
      **Her mesaja bildirim gitmiyor** — karşı tarafın okunmamış mesajı varsa
      ikincisi gönderilmiyor; aksi hâlde bildirimler kapatılırdı.
      Realtime aboneliği var ama zorunlu değil: yayın kapalıysa ekran yine
      çalışıyor, kullanıcı tazeliyor
- [x] **Güven skoru ve profil istatistikleri** — profil dört sabit sayı
      gösteriyordu: skor 96, 38 takas, 1.260 puan, 4,9 değerlendirme. Dördü de
      uydurmaydı ve biri karşılığı hiç olmayan bir sistemi ima ediyordu.
      **Değerlendirme kaldırıldı** (yıldız puanı diye bir şey yok), yerine
      yayındaki ilan sayısı kondu. `user_trust()` skoru gerçekleşmiş olaylardan
      hesaplıyor: kabul edilen iade −15, reddedilen asılsız talep −10,
      ödenmemiş borç −10, geç kargo −15; taban 0.
      **Yeterli işlemi olmayanın skoru YOKTUR** — null döner ve ekran "—" der;
      uydurulmuş bir 100, uydurulmuş bir 96 kadar yanlıştır.
      Skor gerekçesiyle gösteriliyor: nedenini söylemeden skor vermek,
      kullanıcıya düzeltme imkânı vermemek demek. `seller_trust_score()`
      vitrine yalnızca özet skoru veriyor, ceza kırılımını değil
- [x] **Bildirim kuyruğu** — sistem hiçbir şey haber vermiyordu. En ağır sonucu:
      "48 saat içinde onaylamazsanız puan satıcıya geçer" kuralı, kullanıcı
      teslimattan haberdar olmadığında bir kural değil tuzaktı.
      `notifications` + trigger'lar: ilan yayına girdi, kare reddedildi, takas
      açıldı, kargoya verildi, teslim edildi, tamamlandı, iade edildi, itiraz
      açıldı/karara bağlandı, kampanya puanı verildi.
      Metinleri **sunucu yazıyor**: uygulama katmanına bırakılsaydı aynı olay
      iki yerde iki farklı cümleyle anlatılırdı. Ekran canlı, "tümünü okundu"
      çalışıyor, anasayfadaki rozet artık sabit "3" değil gerçek sayı
- [x] **Kampanya puanı motoru (Ana Doküman 2.4)** — soğuk başlangıcı kıran
      mekanizma. Hak **ilan yayına girdiğinde** doğuyor (satışta değil):
      `campaign_grants` + trigger'lar. Dört kapı: telefon doğrulanmamışsa hak
      yok, hesap başına bir kez, aynı numara ikinci hesapla aynı hakkı alamaz,
      1000 kullanıcı kontenjanı. Yüklenen hak geri alınmıyor — kaydı silmek
      defterdeki hareketi bırakıp hakkı serbest bırakmak olurdu.
      Hak verme **sessiz**: koşul sağlanmazsa hata vermiyor, çünkü kampanya
      kuralı yüzünden bir ilanın yayına girmemesi kabul edilemez.
      `campaign_status()` dağıtılan toplamı ve kalan kontenjanı panelde
      gösteriyor — 500.000 puan kalıcı bir yükümlülük, ölçülmezse yönetilemez
- [x] **Yönetim paneli — iki kuyruk, tek ekran** (`app/admin.tsx`)
      Yetki `admins` tablosunda, JWT'de değil: rol iddiası oturum yenilenene
      kadar geçerli olmaz ve yetkisi alınmış bir yönetici elindeki token'la
      karar vermeye devam ederdi. Tablo anında etki eder, testi de bunu sınıyor.
      `admin_photo_queue()` bekleyen kareleri, `admin_dispute_queue()` karar
      bekleyen itirazları eşik ve kanıt sayısıyla getiriyor.
      `admin_moderate_photo()` ve `admin_resolve_dispute()` **gerekçesiz karar
      kabul etmiyor**; iade mantığı tek yerde (`resolve_dispute`) kalıyor,
      yönetici katmanı yalnızca yetkiyi doğrulayıp kararı verenin kimliğini
      geçiriyor. Panel ekranı gizli ama gizlilik bir önlem değil — kuyruklar
      sunucuda `is_admin()` süzgecinden geçiyor
- [x] **`audit_logs`** — her insan kararı kaydediliyor: kim, ne, hangi kayıt,
      hangi gerekçe. Defterle aynı mantıkla değiştirilemez ve silinemez
      (trigger). 5.5 gerekçenin denetim kaydına yazılmasını istiyordu
- [x] **İade ve uyuşmazlık (Ana Doküman Bölüm 5)** — itiraz kapısı açıktı ama
      arkası boştu: kanıt yüklenemiyor, karar verilemiyordu.
      `disputes` + `dispute_evidence` (özel kova, klasör sahipliği) +
      `seller_debts`; `open_dispute` artık kayıt açıyor ve kanıt istiyor,
      `add_dispute_evidence` talebi karar kuyruğuna alıyor, `resolve_dispute`
      500 puan eşiğine göre ürünün alıcıda mı kalacağına yoksa satıcıya mı
      döneceğine karar veriyor (eşiğin üstünde iade kargosu satıcıya borç
      yazılıyor). `cancel_trade` kargo öncesi iptali veriyor (5.1).
      Karar **yalnızca `service_role`'da** — kendi itirazına karar verebilen bir
      alıcı platformu boşaltırdı. Kanıt gelmezse makine reddediyor (kanıtsız
      talep değerlendirilemez) ama ayıplı olup olmadığına asla karar vermiyor;
      karar süresi aşılınca yalnızca kuyruğa alıyor
- [x] **SAYAÇ HATASI DÜZELTİLDİ** — 5.4 "reddedilen talepte sayaç kaldığı yerden
      devam eder, sıfırlanmaz" diyor. İlk yazdığımda durdururken kalan süreyi
      siliyordum: her reddedilen talepten sonra alıcı sıfırdan 48 saat
      kazanıyordu — dokümanın tam da uyardığı suistimal. `deadline_remaining`
      ile kalan süre saklanıyor ve dönüşte aynen sürüyor
- [x] **Ödeme ekranı — zincirin kopuk halkası** — `cargo-payment-init` yazılıydı
      ama uygulamada çağıran yoktu. Takas açılıyor, puan havuza giriyor, alıcı
      kargo bedelini ödeyemiyor ve bir saat sonra takas kendiliğinden iptal
      oluyordu. `app/payment.tsx` tutarı sunucudan alıyor, fatura bilgisini
      soruyor, iyzico sayfasını `openAuthSessionAsync` ile sistem tarayıcısında
      açıyor ve `kidstrade://payment-result` dönüşünü yakalıyor. Kart bilgisi
      uygulamanın WebView'ünden geçmiyor. Dönen sonuç bilgilendirmedir; gerçeği
      RETRIEVE ile doğrulayan `iyzico-callback` belirler

### Backend
- [x] Puan defteri (güvenli havuz): `wallets`/`wallet_entries`/`trades`, atomik
      `earn/hold/release/refund` (yarış-koşulsuz, negatif/çift harcama engelli, RLS + test)
- [x] iyzico Checkout Form — kargo tahsilatı + komisyon (IYZWSv2 imza doğrulandı)
- [x] Ürünler → Supabase `products` tablosu (RLS + seed); `useProducts`/`useProduct` canlı/demo
- [x] Cüzdan → canlı puan defteri (loading + pull-to-refresh + demo fallback)
- [x] Supabase Auth — Google/Apple OAuth (PKCE) + e-posta/şifre + oturum yönlendirme
- [x] SMS/OTP backend — Supabase Send SMS Hook → NetGSM OTP (imza doğrulamalı, skeleton)

### Güvenlik (P0 — 2026-08-09, canlıya çıkınca görülenler)
- [x] **RPC yetkileri** — `public` şemasındaki HER fonksiyon `anon` rolüne
      açıktı. Anon anahtarı uygulamaya gömülüdür, gizli değildir; elinde
      olan herkes `/rest/v1/rpc/earn_points` çağırıp istediği hesaba istediği
      kadar puan basabilirdi. Kapalı devre ekonomi tek çağrıyla çökerdi.
      `release_points`, `refund_points`, `grant_campaign_points` ve
      `resolve_dispute` de aynı şekilde açıktı. Yerelde PostgREST olmadığı
      için hiçbir test bunu göremezdi.
      Artık anon **hiçbir** fonksiyonu çağıramıyor; `authenticated` yalnızca
      çağıranını kendi doğrulayan 29 fonksiyonu çağırabiliyor
- [x] **Ciro sızıntısı** — `daily_commission` görünümü anon'a okumaya açıktı
      ve SECURITY DEFINER olduğu için `cargo_payments`'ın RLS'ini aşıyordu.
      Tek istekle günlük ciro, kargo maliyeti ve komisyon görünüyordu.
      Artık `security_invoker` ve yalnızca `service_role` okuyor
- [x] **`my_trade_quote()`** — `quote_trade_price()` çağıranı doğrulamıyor ve
      marjımızı (kargo maliyeti + komisyon) döndürüyordu. Takasın tarafı
      olduğunu doğrulayan, marjı döndürmeyen sarmalayıcı yazıldı
- [x] **Sabit `search_path`** — dört tetikleyici fonksiyonunda eksikti
- [x] **PKCE gerçekten çalışıyor** — Hermes'te WebCrypto olmadığı için
      supabase-js sessizce `plain` yöntemine düşüyordu; `code_verifier` ile
      `code_challenge` aynı değer oluyordu, yani PKCE hiçbir şey korumuyordu.
      `kidstrade://` şemasını kaydeden başka bir uygulama yetkilendirme kodunu
      yakalarsa oturumu devralabilirdi. `lib/webcrypto.ts` expo-crypto'nun
      yerel SHA-256'sını WebCrypto arayüzü olarak kuruyor. Cihazda doğrulama:
      konsoldaki "WebCrypto API is not supported" uyarısı kaybolmalı

### Depo görünürlüğü — karar bekliyor (2026-08-14)

- [ ] **Bu repo herkese açık, pazarlama sitesi reposu özel.** Muhtemelen ters.
      `blaixs-max/Takas-WebSite` → **public** · `blaixs-max/Takas-site` → private.

      Bugün bir sızıntı yok: `service_role` repoda hiçbir yerde geçmiyor, anon
      anahtarı zaten uygulama paketine gömülü ve korumayı RLS yapıyor. Yani
      açık olması *savunulabilir* — ama bilinçli bir karar mı, emin değilim.

      Somut sonucu şu: Vercel deploy hook URL'si göç dosyasına yazılamıyor
      (yazıldı, commit'ten önce çıkarıldı). Yetki bağlantıları ve ileride
      eklenecek her sır bu repoda duramaz.

      Karar: açık kalacaksa "burası açıktır" CLAUDE.md'ye kural olarak yazılsın;
      kapanacaksa Settings → Danger Zone → Change visibility.

### Hâlâ maket olan ekranlar

- [x] **`addresses.tsx` artık maket değil** (2026-08-14 denetimi). Bu madde
      "sabit iki adres gösteriyor" diyordu; sahte adresler ekran denetimi
      turunda kaldırılmıştı, madde güncellenmemiş. Ekran şimdi boş durumda
      "Kayıtlı adresiniz yok" diyor ve adres defterinin neden açılmadığını
      anlatıyor. Tablonun açılması hâlâ bir KVKK kararı — o aşağıda.

## ⏳ Sıradaki (öncelik sırası)

### Marka revizyonunun panelde tamamlanması gereken iki adımı

Şema `kidstrade` → **`eldenele`** oldu. Kodda dört yerdeydi, hepsi
`lib/brand.ts`e taşındı; ama iki ayar repoda değil, panelde:

- [ ] **Supabase Auth → Redirect URLs.** İzin listesine `eldenele://auth-callback`
      eklenmeli. Eklenmezse Google/Apple ile giriş tarayıcıdan geri dönemez;
      kullanıcı açık bir sekmeyle kalır, hata da görmez.
- [ ] **`iyzico-callback` Edge Function → `APP_RETURN_URL` sırrı.** Fonksiyonun
      koddaki varsayılanı güncellendi, ama ortamda bir değer **atanmışsa** o
      kazanır ve hâlâ `kidstrade://payment-result` döndürür. Ödeme sonrası
      uygulamaya dönüş kırılır. Değeri `eldenele://payment-result` yapın ya da
      sırrı tamamen silin.

Uygulama mağazalarda olmadığı için paket kimliği (`com.kidstrade.app` →
`com.eldenele.app`) ve slug bu turda değiştirildi; yayımlandıktan sonra ikisi de
değiştirilemez.

- [x] **Kategori göçü canlıya uygulandı** (2026-08-13) —
      `20260813100000_kategori_matrisi.sql` canlı projede (`kategori_matrisi`).
      Uygulama öncesi durum: 1 ilan (`Beslenme`, SOLD), ağaç tabloları yok,
      eski CHECK yerinde. Sonrası: 9 ana + 62 alt satır, tek ilan
      `Beslenme / Sofra ürünleri`'ne taşındı, eski CHECK kalktı, iki dış
      anahtar kuruldu, `anon`'un çağırabildiği fonksiyon sayısı **0**.
      Canlıda üç ret yolu denendi ve üçü de doğru reddetti: ağaçta olmayan
      kategori, yanlış ana/alt çifti, doğrudan kategori UPDATE'i. Deneme hiç
      satır yazmadı.

      > **Şema kayması kapandı** (2026-08-14). Canlıda repoda bulunmayan üç
      > göç vardı — `rpc_grants_public_default`, `acl_probe`,
      > `rpc_grants_final`. Üçünün de gerçek SQL'i canlıdan okundu ve dosyaya
      > döküldü. `acl_probe` bir tanı adımıydı (yeni bir fonksiyonun PUBLIC
      > yetkisiyle doğup doğmadığına bakmak için); sonraki göç onu düşürüyor,
      > ama repo canlının geçmişini birebir yürüyebilsin diye o da yazıldı.
      >
      > Aynı turda repo **sıfırdan kurulabilir** hâle geldi: `vitrin_tazele`
      > düz `create extension pg_net` yazıyordu ve sade PostgreSQL'de o satır
      > göçü sert biçimde durduruyordu — yani dosyadan sonraki her göç ve
      > bütün yerel testler de duruyordu. Uzantı yoksa göç devam ediyor,
      > `vitrin_tazele()` kendini kapatıyor. Canlıda davranış aynı.
      >
      > Doğrulandı: 29 göç sırayla uygulandı, 9 ana + 62 alt kategori,
      > `anon`ın çağırabildiği fonksiyon **0**, `authenticated` 31 (hepsi
      > kasıtlı; `vitrin_tazele` listede yok).
- [x] **Dört test paketi düzeltildi** (2026-08-14) — **17/17 geçiyor.** Teşhis
      kısmen yanlıştı: dördü de "yetkiye takılıyor" diye yazılmıştı, biri
      değildi.
      - `points_ledger` — yetkiyle ilgisi yoktu. `ledger_hardening`
        `p_idempotency_key`i **zorunlu** yaptı, test hâlâ iki argümanlı eski
        imzayı çağırıyordu. Ayrıca var olmayan `expensive` kimliğine takas
        açıyordu; `products` yabancı anahtarı eklenince satır hiç yazılamaz
        oldu. Test artık kendi ilanını kuruyor.
      - `listing_insert` — `quote_trade_price` yerine uygulamanın gerçekten
        çağırdığı `my_trade_quote`. Aynı beş sütun, doğru yol.
      - `product_photos` — `required_slots` iç bir yardımcı (uygulama kareleri
        istemcide hesaplıyor); üç çağrı yetkili role alındı, ilan oluşturma ve
        yayına alma `authenticated` kaldı.
      - `trust` — 8. bölüm "başkasının özet skoru görünür, kırılım görünmez"
        diyordu ve 70 bekliyordu. `rpc_grants` o yetkiyi geri aldı: herkesin
        istediği kullanıcının skorunu sorgulayabilmesi sızıntıydı. Test artık
        **reddedilmeyi** doğruluyor — yani yeni güvenlik duruşunu.
- [x] **İlk yönetici eklendi** — bu madde "`auth.users` henüz **boş**" diyordu;
      2026-08-14 ölçümünde `auth.users` 3, `admins` 1 satır. Artık geçersiz.
- [ ] **Hiç profil yok** (2026-08-14 ölçümü) — `profiles` **0 satır**.
      `20260814110000_profiller` göçü canlıda ve `edit-profile` ekranı
      çalışıyor; henüz kimse kaydetmedi. Sonucu sitede görünüyor: `seller_name`
      hâlâ e-postadan türüyor ve vitrin bunu **"Üye"** diye yazıyor — doğru
      davranış, ama gerçek ad değil. Uygulamada Profil → Profili düzenle'den ad
      kaydedilince tetikleyici vitrini tazeliyor ve kart "Emrah A." çıkıyor.
- [ ] **Edge Function ortam değişkenleri** — fonksiyonlar yayında ama gizli
      değerleri yok. Panelden girilecek: `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`,
      `IYZICO_CALLBACK_URL`, `APP_RETURN_URL`, `AI_VISION_API_KEY`,
      `NETGSM_USERCODE`, `NETGSM_PASSWORD`, `NETGSM_HEADER`,
      `SEND_SMS_HOOK_SECRET`
- [x] **Kare akışı cihazda çalıştı** (2026-08-09) — ilk gerçek ilan verildi:
      beş kare çekildi, depoya yüklendi, `product_photos` satırları düştü.
      Kamera akışının cihazda ilk koşusu
- [x] **Taslak ilan çıkmazı** — `listing-photos` ekranına yalnızca ilan
      oluşturulduktan hemen sonra girilebiliyordu. O ekrandan çıkan kullanıcı
      taslak ilanına bir daha ulaşamıyor, "yayına al" düğmesini hiçbir yerde
      bulamıyordu; ilan veri tabanında DRAFT olarak kalıyor, kullanıcı ise
      ilanını verdiğini sanıyordu. `app/drafts.tsx` + profildeki "Yarım kalan
      ilanlar" satırı ile kapatıldı
- [x] **Kapak karesi vitrine bağlandı** — `publish_listing()` kapağı
      `is_cover` ile işaretliyor ama `products.image_key`'e yazmıyordu; alan
      null kalınca uygulama paketli demo görsele düşüyordu. Gerçek bir ilan
      vitrinde başka bir ürünün stok fotoğrafıyla görünüyordu — eksik görsel
      değil, YANLIŞ görsel. Artık kapağın depolama yolu yazılıyor ve uygulama
      onu imzalı bağlantıya çeviriyor. Bağlantı üretilemezse görsel boş
      kalıyor; demo görsele düşmek yok
- [x] **Galeri kareleri bağlandı** — detay ekranı `gallery_keys` üzerinden
      paketli görsellere bakıyordu; gerçek ilanda o kolon boş olduğu için tek
      bir demo fotoğraf çıkıyordu. Artık kareler `product_photos`'tan
      okunuyor (kapak başta), imzalı bağlantıya çevriliyor
- [x] **Depo okuma politikası** — asıl kusur buydu. Tabloda "yayındaki ilanın
      kareleri açık" politikası vardı ama görsellerin durduğu kovada okuma
      yalnızca klasör sahibine ve yöneticiye açıktı. Alıcı satırı görüyor,
      görseli göremiyordu: vitrin satıcıda dolu, alıcıda boş görünüyordu —
      satıcı kendi ilanına baktığı için fark edilmesi zor bir kusur.
      Yeni politika tablo kuralını yansıtıyor, bir sıkı şartla: yalnızca
      ONAYLANMIŞ kare açılır. Canlıda iki yönden doğrulandı — alıcı yayındaki
      ilanın 5 karesini görüyor, ilan taslağa çekilince 0
- [x] **Kayıt akışına ad alanı eklendi** (2026-08-14) — `signUp` yalnızca
      e-posta ve şifre alıyordu, `raw_user_meta_data` boş kalıyordu ve satıcı
      adı e-postanın `@` öncesine düşüyordu. Sitedeki "Üye" yaması bunun
      sonucuydu; kök sebep kullanıcıya adın hiç sorulmamasıydı. Alan zorunlu
      (sonradan doldurulabilir bırakmak, çoğu kişide hiç doldurulmaması
      demek) ve altında ne kadarının yayınlandığı yazıyor: "Zeynep D." gibi.
- [x] **Ürün detayı galerisi gerçekten galeri oldu** — büyük kare tek bir
      `Image`'dı: parmakla kaydırmak hiçbir şey yapmıyordu, alttaki noktalar
      düğme gibi duruyor ama basılamıyordu. Artık sayfalı kaydırma, basılabilir
      noktalar, uçta gizlenen ileri/geri okları ve kareye dokununca tam ekran
      görüntüleyici var (iOS'ta iki parmakla yakınlaştırma)
- [x] **Ürün detayındaki uydurma rozetler kaldırıldı** — "AI onaylı fotoğraf"
      ve "48 parça tam" her ilanda sabit yazıyordu. İkisi de yanlıştı:
      `AI_VISION_API_KEY` tanımlı değilken kareleri insan onaylıyor, parça
      sayısı ise hiç ölçülmüyor. Alıcı ikinci el üründe tam da bu iki iddiaya
      güvenir. Rozet artık "Kareler incelendi"; parça iddiası kaldırıldı,
      boş "Piyasa karşılığı" ve "0 km" gizleniyor
- [ ] **Android'de yakınlaştırma** — tam ekran görüntüleyici iOS'ta
      ScrollView'ün kendi yakınlaştırmasını kullanıyor; Android'de kare tam
      ekran açılıyor ama yakınlaştırma için `react-native-gesture-handler`
      gerekiyor
- [ ] **Kare akışının kalan uçları** — kamera bu ortamda test edilemiyor.
      Expo Go'da yedi karenin çekimi, yeniden çekim ve yayın kapısı elden geçirilmeli
- [x] **İnsan moderasyon kuyruğu zaten var** (2026-08-14 denetimi) —
      `app/admin.tsx` içinde "Kareler" sekmesi, `loadPhotoQueue()` +
      `moderatePhoto()`. Canlıda kullanıldı: ilk gerçek ilanın kareleri
      buradan onaylandı. Madde yazıldığı gün doğruydu, sonra yapıldı ve
      güncellenmemiş.
- [ ] **`AI_VISION_API_KEY` ayarlanması** — anahtar girilene kadar hiçbir kare
      otomatik onaylanmaz (tasarım gereği güvenli taraf), yani yayın akışı durur
- [ ] **iyzico sandbox ucundan uca test** — ödeme akışı yazıldı ama gerçek bir
      kartla hiç koşmadı. Sandbox anahtarları olmadan 3D Secure dönüşü, callback
      ve `SHIPPED`'e geçiş doğrulanamıyor
- [ ] **Adres defteri kararı** — fatura bilgisi ve T.C. kimlik numarası şu an
      saklanmıyor, her ödemede yeniden soruluyor. Saklamaya geçmek bir KVKK
      kararıdır (Ana Doküman 7.4 · 7)
- [ ] **Kargo aggregator** (Navlungo/Kolay Gelsin) — `iyzico-callback` etiket üretimi.
      Teslimat webhook'u `mark_delivered()` çağıracak; şu an o fonksiyonu
      çağıran kimse yok, yani 48 saatlik sayaç pratikte hiç başlamıyor
- [x] **pg_cron doğrulaması** — canlıda bakıldı: `kt-expire-stale-trades`
      (`7 * * * *`) ve `kt-expire-stale-disputes` (`22 * * * *`), ikisi de aktif

## 🔜 Sonra
- [ ] Ürün Ekle: dinamik puan önerisi (kareler ve kategoriden değerleme)
- [ ] Kapakta zorunlu durum rozeti (hasar beyanı ilan kartında görünsün)
- [ ] Bildirimler → **push** (Expo Notifications). Kuyruk hazır ve doluyor ama
      kullanıcı uygulamayı açmadan hiçbirini görmüyor; sayaçların işe yaraması
      için push şart. Cihaz jetonu tablosu + EAS kimlik bilgileri gerekiyor
- [ ] Favori/Sepet → oturum açıkken Supabase'e senkron (cihaz + bulut)
- [ ] **MERDİVENİ AÇ (kurucu kararı)** — mekanizma kurulu ama **kapalı**:
      `update sanction_settings set active = true;`
      Kapalı bırakmam bilinçli: eşikler (uyarı 70, kısıt 40) birer başlangıç
      önerisi, karar değil. Çok sert bir eşik dürüst satıcıyı da vurur ve o kişi
      bir daha dönmez; çok gevşek olanı merdiveni anlamsız kılar. Sayıları
      onaylayın, sonra açalım
- [ ] Satıcının güven skorunu ilan kartında göster (`seller_trust_score` hazır)
- [ ] Dekoratif linkler (Anasayfa "Tümü/Harita") → gerçek hedef

## 🚀 Yayın (config gerektirir)
- [ ] Supabase dashboard: Google/Apple provider + redirect `eldenele://auth-callback`
      (şema değişti; bu satır `kidstrade` yazıyordu — yukarıdaki "panelde
      tamamlanması gereken iki adım" maddesiyle aynı iş)
- [ ] iyzico **sandbox** anahtarları → uçtan uca ödeme testi → canlı anahtar
- [ ] EAS build + submit (App Store + Google Play) — `mobile/README.md`
- [ ] Gizlilik politikası (KVKK), mağaza görselleri, yaş derecelendirmesi

## 📌 Bağımlılıklar (bizde değil — kullanıcı sağlamalı)
- iyzico sandbox/canlı API key + secret
- Supabase dashboard OAuth config (proje ve anahtarlar artık hazır)
- Kargo aggregator hesabı + anlaşmalı tarife
- Apple Developer + Google Play hesapları (mevcut)
