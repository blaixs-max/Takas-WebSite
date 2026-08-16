# ELDENELE — Yol Haritası / TODO

Son güncelleme: 2026-08-16 · Branch: `main`

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
- [x] **Tazeleme otomatik.** `20260814083631_vitrin_tazele.sql`: `pg_net`,
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
      2026-08-16'da denetim **kıyaslamalı** oldu ve reddedilen kare depodan
      siliniyor — aşağıdaki "Kare denetimi" bölümüne bak.
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

### Depo görünürlüğü — KARAR VERİLDİ (2026-08-16): arka uç private olacak

Bu repo (`blaixs-max/Takas-WebSite`) **public**, pazarlama sitesi
(`blaixs-max/Takas-site`) private. Ters ve düzeltiliyor.

Gerekçe sızıntı değil — `service_role` repoda geçmiyor, anon anahtarı zaten
uygulama paketine gömülü ve korumayı RLS yapıyor. İki başka sebep var:
şema, RLS politikaları ve iş kuralları saldırgana yol haritası veriyor; ve
hiçbir sır konulamıyor — Vercel deploy hook URL'si bir kez yazıldı, commit'ten
önce çıkarıldı.

- [ ] **Sende, tek adım:** github.com → `blaixs-max/Takas-WebSite` → Settings →
      en altta **Danger Zone** → *Change repository visibility* → **Private**.
      API'den yapılamıyor, panel gerektiriyor. GitHub Actions ve Vercel
      bağlantıları private repoda da çalışmaya devam eder; bir şey yeniden
      bağlanmaz.

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

- [x] **Giriş ekranına "Şifremi unuttum" eklendi** (2026-08-14). Sıfırlama
      zaten vardı ama `Güvenlik & doğrulama` ekranındaydı ve oraya girmek için
      **oturum açmış olmak** gerekiyordu — yani tam da şifresini unutan kişinin
      ulaşamadığı yerdeydi. Cevap hesabın var olup olmadığını söylemiyor;
      aksi hâlde ekran bir hesap sayacına dönerdi.
- [ ] **E-posta gerçekten gidiyor mu — DOĞRULANMADI.** Kod doğru ama teslimat
      proje ayarına bağlı ve panelden bakılmalı:
      · **SMTP** — Supabase'in yerleşik gönderimi yalnızca geliştirme içindir
        ve saatte birkaç postayla sınırlıdır. Yayın öncesi kendi SMTP'miz
        (Resend/Postmark/SES) tanımlanmalı, yoksa kullanıcıların çoğu
        sıfırlama postasını hiç almaz.
      · **Redirect URL** — aşağıdaki maddeyle aynı: `eldenele://auth-callback`
        izin listesinde değilse posta gelse bile bağlantı uygulamaya dönmez.
      · **`app/auth-callback` ekranı YOK.** `_layout.tsx` onu `AUTH_ROUTES`
        içinde sayıyor ama dosya yok. OAuth akışı tarayıcı oturumunu kendi
        yakaladığı için şimdilik patlamıyor; **şifre sıfırlama bağlantısı ise
        doğrudan o rotaya düşer** — ekran yazılmalı.
- [ ] **Alan adı `eldeneletakas.com` alındı, hiçbir yere bağlanmadı**
      (2026-08-14 ölçümü). DNS hâlâ GoDaddy park sunucularını gösteriyor
      (`13.248.243.5`, `76.223.105.230`), MX ve TXT kaydı yok, Vercel
      projesinin `domains` listesinde yalnızca üç `vercel.app` adresi var.
      Adım adım talimat: **`KURULUM.md`**.
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
      `20260813072758_kategori_matrisi.sql` canlı projede (`kategori_matrisi`).
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
      `20260814090949_profiller` göçü canlıda ve `edit-profile` ekranı
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
- [x] **Android'de yakınlaştırma eklendi** (2026-08-14) —
      `components/YakinlastirilabilirKare.tsx`. `ScrollView`in
      `maximumZoomScale`/`minimumZoomScale` özellikleri yalnızca iOS'ta
      çalışıyor, Android'de sessizce yok sayılıyorlardı. iOS yolu **aynen
      bırakıldı** (çalışan, platformun kendi davranışı); Android'e
      `PinchGestureHandler` kondu ve kök düzen `GestureHandlerRootView` ile
      sarmalandı — o olmadan jest işleyicisi Android'de hiçbir şey yapmıyor.

      > **Cihazda doğrulanmadı.** İki parmak jesti bu ortamda sınanamıyor;
      > web derlemesi de onu çalıştırmıyor. Tip denetimi ve derleme geçti,
      > iOS yolu değişmedi. Android'de bir aksaklık olursa en kötü ihtimalle
      > bugünkü duruma dönülür (orada zaten yakınlaştırma yoktu).
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
- [x] **Adres defteri — KARAR VERİLDİ (2026-08-16): saklanmayacak.** Fatura
      bilgisi ve T.C. kimlik numarası her ödemede sorulmaya devam edecek,
      yalnızca o istekte iyzico'ya iletilecek. Her seferinde sormak biraz
      sürtünme ama **saklamadığın veri sızmaz**: KVKK yükümlülüğü, VERBİS
      eşiği ve ihlal riski hep birden düşük kalıyor. Bu artık açık bir soru
      değil, verilmiş bir karar — `addresses` tablosu açılmayacak.
- [ ] **Kargo aggregator** (Navlungo/Kolay Gelsin) — `iyzico-callback` etiket üretimi.
      Teslimat webhook'u `mark_delivered()` çağıracak; şu an o fonksiyonu
      çağıran kimse yok, yani 48 saatlik sayaç pratikte hiç başlamıyor
- [x] **pg_cron doğrulaması** — canlıda bakıldı: `kt-expire-stale-trades`
      (`7 * * * *`) ve `kt-expire-stale-disputes` (`22 * * * *`), ikisi de aktif

## 🔜 Sonra
- [ ] Ürün Ekle: dinamik puan önerisi (kareler ve kategoriden değerleme)
- [x] **Kapakta hasar beyanı rozeti** (2026-08-14) — `products.has_damage`
      `product_photos` göçünden beri vardı ve yedinci kareyi zorunlu yapıyordu,
      ama `COLS`ta hiç seçilmiyordu: arayüz sütunu göremiyordu bile. Alıcı
      hasarı ancak ilanı açıp yedinci kareye bakınca görüyordu. İkinci el
      üründe en çok merak edilen şeyin kartta olmaması, kusuru saklamak gibi
      okunuyor. Rozet uyarı değil bilgi: beyan edilmiş olması iyi bir şey.
- [ ] Bildirimler → **push** (Expo Notifications). Kuyruk hazır ve doluyor ama
      kullanıcı uygulamayı açmadan hiçbirini görmüyor; sayaçların işe yaraması
      için push şart. Cihaz jetonu tablosu + EAS kimlik bilgileri gerekiyor
- [x] **Favori/Sepet buluta senkron** (2026-08-14) — ikisi de yalnızca
      `AsyncStorage`daydı: telefon değişince ya da uygulama silinince liste
      kayboluyordu, aynı hesaba başka cihazdan girildiğinde favoriler boş
      görünüyordu.

      `favorites` ve `cart_items` tabloları, RLS açık, üçer politika
      (`select`/`insert`/`delete`). `insert` politikasının **`with check`**
      yanı ayrı yazıldı: yalnızca `using` yazmak, kullanıcının başkasının
      adına satır eklemesine izin verirdi ve bu, yalnızca okumaya bakan bir
      testten kaçardı. Test tam olarak onu sınıyor.

      Miktar sütunu yok — sepet bir küme. Her ilan tek ve benzersiz bir ikinci
      el ürün; çokluk sütunu olmayan bir yeteneği şema düzeyinde vaat ederdi.

      **Birleştirme kuralı "bulut kazanır" değil, birleşim.** Kullanıcı oturum
      açmadan önce favorilediği şey onun niyetidir ve giriş yapmak onu
      silmemeli. İlk turdan sonra her değişiklik iki tarafa birden yazılıyor,
      yani ikinci bir birleştirme gerekmiyor ve silinen bir şey dirilmiyor.

      Bulut yazımları bilerek beklenmiyor ve hataları yutuluyor: ağ yokken
      kalbe basmak çalışmaya devam etmeli, liste zaten cihazda kayıtlı.

      Doğrulandı: **18/18 test geçiyor** (yeni `favoriler_sepet_test` dahil),
      göç canlıya uygulandı — RLS açık, `anon` okuyamıyor.
- [x] **Yaptırım merdiveni — KARAR VERİLDİ (2026-08-16): kapalı kalıyor.**
      `sanction_settings.active = false` bilinçli bir durum, eksik bir iş
      değil. Gerekçe: launch'ta kullanıcı da yok güven skoru da yok, yani
      merdiven boşa çalışır ve ilk dürüst satıcıyı vurabilir — o kişi bir daha
      dönmez. Eşikler (uyarı 70, kısıt 40) yazılı duruyor ama **onaylanmadı**.
      Yeniden gündeme geleceği an: gerçek takas verisi birikip güven skorları
      anlam kazandığında. O zamana kadar bu madde açık soru değil.
- [x] **Güven skoru ilan kartında** (2026-08-14) — bir şartla: satıcı **en az
      bir takas tamamladıysa**. `products.seller_trust` varsayılanı 90; hiç
      takas yapmamış birinde 90 göstermek, profil ekranının "Güven skoru henüz
      oluşmadı" demesiyle çelişirdi ve kazanılmamış bir sayıyı kazanılmış gibi
      sunardı — cüzdandaki uydurma 96'nın aynısı.
- [x] **Dekoratif linkler kaldırıldı** (2026-08-14) — dördü de `Pressable`
      bile değildi, mikrofonla aynı sınıf kusur. Gerçek hedef verilemedi çünkü
      hedef yoktu:
      - Anasayfa "Öne çıkan takaslar → Tümü" — öne çıkanlar hemen altındaki
        rafın alt kümesi, tam liste zaten aynı ekranda.
      - Anasayfa "Yakınındaki raflar → Harita" — uygulamada harita ekranı yok.
      - Cüzdan "Son hareketler → Tümü" — liste zaten son 50 hareketin hepsini
        çiziyor, ayrı bir geçmiş ekranı yok. Başlıktaki ölü `history` ve
        `more-vert` simgeleri de kalktı.
      - Profil "İlanlarım → Tümü" — hemen altındaki kutu zaten rafa götüren
        gerçek düğme; ikisinden biri çalışıyordu, diğeri süstü.

## 🎨 Yeni UI turu (2026-08-14 · sürüyor)

Kaynak: `tasarim/` — "Eldenele App Metin ve UX Rehberi (Nihai, 14 Ağustos
2026)", 24 benzersiz ekran tasarımı ve 4 fotoğraf.

**Kapsam yalnızca görünüm ve metin.** Kullanıcı kararıyla fonksiyon aynı
kalıyor: ürün durumları bizim üçlümüz (veri tabanı kısıtı değişmiyor),
filtre/sırala bizim çip satırımız (rehberdeki iki ayrı ekran yapılmıyor),
kartta avatar + güven skoru + hasar rozeti duruyor, ürün detayında küçük
resim şeridi duruyor.

**Palet değişmedi.** Rehber aynı sekiz rengi ve "yeni ana renk eklenmez"
kuralını tekrarlıyor. Değişen, çevresindeki krem ve turkuaz basamaklar —
hepsi 24 ekranın baskın renkleri sayılarak ölçüldü, göz kararı seçilmedi.

- [x] **Tema tokenları** — zemin `#FBF8F2`, kart `#FFFFFF`, alt bar
      `#FFF9EF`, ayraç `#F3EBDD`, arama alanı `#F3EBDD`, açık turkuaz
      `#DDF5F8`, ikincil metin `#5E6876`, cüzdan gradyanı
      `#008BAA → #1896B2`. `primary` `#00718A`de kaldı; tasarımdaki seçili
      çip metnini ölçtüğümde `#006F84` çıktı, yani tasarım da aynı koyu
      turkuazı kullanıyor.
- [x] **Ürün kartı** — beyaz gövde, 1.5 oranlı görsel, açık turkuaz puan
      hapı, görselde durum çipi + hasar rozeti, konum satırında güven skoru,
      alt satırda hap + kalp. Ölçüler tasarımdan piksel piksel okundu
      (`08_04_Anasayfa.png`, 739×1600 = 390×844 @1.895): kenar 18, kart arası
      10, kart 172, hap y22, kalp 26.
- [x] **Öne çıkan kart** — siyah gradyan perdeli eski kart dili kalktı;
      artık raf kartıyla **aynı** dili konuşuyor: aynı genişlik, aynı stiller,
      tek farkı rozet. Stiller `ProductCard`'tan geliyor.
- [x] **Anasayfa** — selamlama, dolu krem arama alanı, beyaz/turkuaz
      çipler, bölüm başlıkları, "Tümünü gör" ve "Haritada gör" çalışıyor.
- [x] **Punto ölçeği — tasarımla eski hâlin ortası** (kullanıcı kararı).
      Önce tasarımın ölçüsüne çekilmişti (selamlama 22, bölüm başlığı 17,
      kart başlığı 12.5); kullanıcı iri hâli daha okunaklı bulunca ikisinin
      ortasında durduk: **selamlama 24, bölüm başlığı 18, kart başlığı 13.5,
      hap 10.5**. Tasarımın oranları korunuyor, hepsi birlikte ~%8 büyüdü.
      Ölçüm aynı yazı tipiyle yapıldı, göz kararı değil.

      Alt şerit tasarımdaki gibi kaldı: zemin `#FFF9EF`, etiket "Ürün ekle".
- [x] **Alt sekme şeridi** — zemin `#F6F3ED` idi, yani sayfa zemininden
      **koyu**; tasarımda `#FFF9EF`, yani bir ton açık. Etiket "Ürün Ekle"
      değil "Ürün ekle" (rehber 09).

> **Yazı tipi Nunito değil.** Bir tur Nunito bağlandı ve geri alındı:
> tasarım kareleri de pazarlama sitesi de grotesk kullanıyor (sistem yığını /
> Roboto). Nunito markanın **kelime logosunun** yüzü — `splash.png` içinde ve
> sitenin logo SVG'sinde kontur olarak var, gövde metninde hiçbir yerde yok.
> Bağlansaydı uygulama hem tasarımdan hem siteden ayrılırdı. Telefonda
> platformun kendi grotesk'i (SF Pro / Roboto) zaten tasarımdaki yüz.
- [x] **Ürün detayı** — hero oranı 1.54, değer bloğu ("Takas değeri" +
      "420 Takas Puanı"), iki çip, sade satıcı satırı, Güvenli Havuz kartı,
      alt barda iki konturlu daire + tek satırlık CTA.
- [x] **Boş durumlar tek bileşende** (`components/BosDurum.tsx`) — sepet,
      favoriler, mesajlar, bildirimler, takaslar, taslaklar, cüzdan. Altı ayrı
      kopya vardı ve hiçbiri diğerine benzemiyordu.
- [x] **Bağlantı hatası boş durumdan ayrıldı** — rehber 12/15/16 bunu açıkça
      istiyor. Sunucuya ulaşılamıyorken "hiç mesajın yok" demek yanlış bilgi;
      artık "Mesajlar yüklenemedi · Yeniden dene" çıkıyor.
- [x] **Profil** — beyaz kartlar, turuncu avatar, 36 pt turkuaz ikon yuvaları,
      "Bildirimler" satırı menüye eklendi (ekran vardı, menüde yoktu).
- [x] **Cüzdan** — kart ve tipografi ölçeği, rehberdeki hareket örnekleri.
- [x] **Ton senli** — rehberin bütün nihai metinleri senli; uygulamada kalan
      otuz kadar sizli kalıp tek tek çevrildi (düz arama-değiştirme Türkçede
      yanlış çekim üretir).
- [x] **Ürün ekle · fotoğraflar** — bilgi kartı, versal alan etiketleri, tek
      cümlelik eksik-alan uyarısı, çekim yönergeleri, "Kontrole gönder".
- [x] **Adresler** — boş durum + iki bilgi kartı (turkuaz "ne yapabilirsin",
      mor "seninle ilgili ne yapmıyoruz").
- [x] **Yardım & Güvenli Havuz · Davet et · Karşılama · Giriş yap · Yetkisiz
      alan · Kargo ödemesi** — rehberin nihai metinleri.
- [x] **Marka terimi tek yazımda** — "Güvenli Havuz"un iki kelimesi de büyük
      harfle başlıyor (rehber 01); "puan" geçen yerler "Takas Puanı" oldu.
- [x] **Sohbet · mesaj listesi** — sohbetin tepesine tasarımdaki ürün şeridi
      geldi (görsel, başlık, karşı taraf, puan; dokununca ilana gider).
      Sohbet ürün detayından açıldığında hangi ilandan konuşulduğu başka
      türlü görünmüyordu. Liste satırları beyaz karta ve yeni ölçüye alındı.
- [x] **Güvenlik · profili düzenle** — ölçü turu yapıldı; form etiketleri
      ilan formundaki `flabel` ile aynı (versal, 10/800), kartlar beyaz.
- [x] **Dört fotoğraf** — `tasarim/photos_4k/` içindeki 3840×2160 kareler
      kullanıldıkları yerin oranına göre kırpılıp `mobile/assets/products/`
      altına alındı (karşılama 1.234, ürün kareleri 1.5; uzun kenar 1200/1400,
      JPEG q82, 129–236 KB). Vitrine iki demo ilan eklendi: **Adaçayı yeşili
      puset** (Bebek Arabası & Puset) ve **Resimli kitap seti**
      (Kitap & Eğitim) — dördü de ahşap oyuncaktı ve hepsi tek kategorideydi,
      yani dokuz kategorili bir ürünü tek kategoriyle tanıtıyordu.

> **Rehberin üç uygulama notu daha uygulandı.** (1) Yardım kartındaki
> dördüncü adımdan "48 saat" düştü: süre doğru ama not, sabit süre sözünün
> yalnızca yürürlükteki operasyon kuralı varsa yazılmasını istiyor ve özet
> kartında rakam, koşulları okunmadan taahhüt gibi okunuyor — rakam
> soru-cevapta duruyor. (2) Yetkisiz alan ekranı "Bu alan yönetim içindir"
> diyordu, yani olmadığı söylenen şeyin yerini işaret ediyordu; artık
> "Bu sayfaya erişimin yok". (3) Adres ekranında "Adres ekle" CTA'sı yok —
> bu akışta adres önceden kaydedilmiyor.

> **Rehberin iki açık yasağı uygulandı.** (1) "Kullanıcı adı yerine 'Üye'
> yazılmaz" — profil başlığı ad yokken artık "Profilini tamamla". (2) Ürün
> detayında "Piyasa karşılığı" ve TL aralığı gösterilmez; blok kaldırıldı.
> Ayrıca cüzdanın örnek hareketlerinden "AI onaylı" ve "ürün eklendi +puan"
> düştü: ilki marka terminolojisinin yasakladığı iddia, ikincisi rehber 14'ün
> uygulama notunun yasakladığı hareket.

> **"Haritada gör" arkasında harita ekranı yok.** Kullanıcı kararıyla duruyor
> ve şimdilik dokunulunca ne olduğunu söylüyor — sessizce hiçbir şey yapmayan
> bir bağlantı değil. Yayından önce ya harita yazılacak ya bağlantı düşecek.

## 📷 Kare çekimi (2026-08-14)

- [x] **Galeriden seçme kaldırıldı** — ilan kareleri yalnızca kamerayla.
      Satıcı stok fotoğrafı ya da başkasının karesini yükleyemiyor. Tam
      güvence değil (kararlı biri ekranı fotoğraflar) ama kolay yolu kapatmak
      dolandırıcılığın büyük kısmını keser, çünkü kolay olduğu için yapılıyor.
- [x] **Zorunlu kırpma kaldırıldı** — `allowsEditing` + `aspect: [4,3]`
      çekimden sonra sistemin kırpma ekranını açıp kareyi 4:3'e indiriyordu;
      telefon 16:9 çektiğinde alttan belirgin bir parça gidiyordu ve kaybolan
      yer çoğu zaman ürünün tabanı oluyordu. Artık kamera karesi olduğu gibi
      yükleniyor; kırpma yalnızca gösterim anında (kart 1.5, hero 1.54).
      Önizleme `contain` — satıcı yükleyeceği karenin tamamını görüyor.
- [x] **`trades.tsx` kanıt akışındaki galeri geri dönüşü düzeltildi**
      (2026-08-16). Kamera izni reddedilince galeri izni **hiç istenmeden**
      `launchImageLibraryAsync` çağrılıyordu; iOS'ta sessizce boş dönüyordu.
      Artık galeri izni ayrıca isteniyor, ikisi de reddedilirse ne yapılacağını
      söyleyen bir uyarı çıkıyor. Kanıt için galeri **bilinçli** bir yedek
      olarak duruyor (hasar, kutu açılırken çekilmiş olabilir).

## 🔒 Yayın öncesi güvenlik turu (KURAL — atlanamaz)

Launch'tan önce hem site hem uygulama için ayrı ayrı, kapsamlı bir güvenlik
analizi yapılıp bulunan her açık kapatılacak. Tur, yayın kontrol listesinin
**önünde** gelir: kapanmamış bulgu varsa mağazaya gönderim yok.

Bugüne kadarki bulgular bu turun neden gerektiğini gösteriyor — üçü de
yalnızca canlıda ya da gerçek veriyle ortaya çıktı, yerel testlerde
görünmüyordu:

- Her fonksiyon `anon`a açıktı; elinde uygulama paketindeki anahtar olan
  herkes `earn_points` çağırıp kendine puan basabilirdi (`rpc_grants`).
- `alter default privileges` yetmedi, PostgreSQL yeni fonksiyonları yine
  PUBLIC yetkisiyle doğurdu (`rpc_grants_final`).
- İlk gerçek ilan vitrine kişinin e-postasının yarısıyla düştü.

### Birinci geçiş — 2026-08-16 (ölçüldü, biri düzeltildi)

**🔴 BULGU · düzeltildi — `anon` her tabloya yazabiliyordu.** 30 tablonun
hepsinde INSERT/UPDATE/DELETE yetkisi vardı: `wallets`, `wallet_entries`,
`admins`, `audit_logs`, `trades`, `campaign_grants`, `user_sanctions`,
`seller_debts` dahil. Kaynağı Supabase'in kurulum betiğindeki
`grant all on all tables ... to anon, authenticated, service_role`.

Sömürülebilir **değildi** ve bu doğrulandı: 30 tablonun hepsinde RLS açık ve
hiçbirinde `anon`a yazma izni veren politika yok. Ama tek savunma katmanı
buydu — `anon` ile cüzdan tablosu arasında duran tek şey bir politikanın
**yokluğu**. RLS'i açmayı unutan bir göç ya da fazla geniş tek bir politika
yeterdi.

Bu depo aynı mekanikten iki kez yaralandı (`rpc_grants`, `rpc_grants_final`);
fonksiyon tarafı kapatılmış, **tablo tarafı açık kalmıştı.**

Göç: `20260816131944_yetki_daraltma.sql`. Yazma yetkisi, o rol için yazma
politikası **bulunmayan** her tablodan geri alındı — 30 tablonun 22'si, yani
yazmanın zaten reddedildiği yerler. Davranış değişmedi, ikinci kilit eklendi.
`favorites`/`cart_items` politikaları da `to public` yerine `to authenticated`
oldu. Ölçüm sonrası: **anon yazma yetkisi 0**, anon yazma politikası 0,
RLS kapalı tablo 0, `authenticated` yazma yetkisi yalnızca gerçekten yazdığı
8 tabloda.

- [x] **RPC yetki matrisi.** 71 fonksiyon: `anon` çağırabilen **0**,
      `authenticated` 31, `SECURITY DEFINER` olup `search_path`'i sabitlenmemiş
      **0**. Her yeni göç sonrası tekrar ölçülmeli — bu bir kerelik değil.
- [x] **RLS politikaları tablo tablo.** 30 tablonun hepsinde RLS açık.
      Politikası hiç olmayan tek tablo `site_settings` — yani `service_role`
      dışında kimse okuyup yazamıyor; bilinçli görünüyor ama teyit edilmeli.
      **Not — eski maddedeki "eksik `with check` başkasının satırına yazdırır"
      cümlesi yanlıştı:** PostgreSQL, UPDATE politikasında `with check`
      verilmemişse `using` ifadesini yeni satıra da uyguluyor. `profiles`
      UPDATE'i bu yüzden açık değil. Gerçek risk, `using`'den **daha gevşek**
      bir `with check` yazmak; öyle bir politika yok.
- [x] **Depolama politikaları.** İki kova da özel (`listing-photos` 8 MB,
      `dispute-evidence` 10 MB). Yazma ve okuma `foldername(name)[1] =
      auth.uid()` ile klasör sahibine bağlı — başkasının klasörüne yazılamıyor.
      `anon` yalnızca **yayındaki ilanın onaylanmış** karesini okuyabiliyor
      (politika `product_photos` + `products` durumunu birlikte denetliyor).
- [x] **Puan ekonomisi.** `earn_points`, `release_points`, `refund_points`,
      `grant_campaign_points`, `hold_points` — beşi de `SECURITY DEFINER` ve
      yalnızca `service_role`da; `anon` ve `authenticated` için ikisi de false.
- [x] **Göç sürüm numaraları hizalandı — KARAR VERİLDİ (2026-08-16).**
      31 göçün hepsinde ad ve sıra aynıydı ama numaralar farklıydı: repo elle
      seçilmiş yuvarlak damgalar kullanıyordu, `schema_migrations` gerçek
      uygulama anını. `supabase db push` çalıştırıldığı gün CLI hiçbir sürümü
      eşleştiremeyip bütün göçleri baştan uygulamaya kalkardı.

      Yerel dosyalar sunucudaki sürümlere göre yeniden adlandırıldı. Bu yön
      seçildi çünkü **sunucu, neyin çalıştığının doğruluk kaynağı** — ve bu
      yönde veri tabanına hiç yazılmıyor.

      Yol üstünde bir tutarsızlık daha çıktı: bugün iki göçü sunucuya *ayrı*
      uygulamış ama yerelde *tek dosyaya* yazmıştım. Dosyalar bölündü; artık
      **36 sunucu kaydı ↔ 36 yerel dosya**, birebir. Eski dosya adlarına yapılan
      atıflar beş dosyada güncellendi.
- [x] **JWT muafiyetleri gerekçelendirildi.** Dördü de `config.toml`'da yazılı
      ve doğru: `iyzico-callback` (iyzico oturum taşıyamaz) ve `send-sms`
      (hook imzası fonksiyonun içinde) muaf; `photo-check` ve
      `cargo-payment-init` oturum istiyor. Yayındaki değerler dosyayla uyuşuyor.
- [x] **`expire_stale_trades` artık `trade_id` ile anahtarlıyor** (2026-08-16).
      Canlıdaki tanım `pg_get_functiondef` ile alınıp yalnızca aranan kolon
      değiştirildi — transkripsiyon riski böyle kapatıldı.

      Yol üstünde ayrı bir bulgu: **yayındaki gövdede yorumlar yoktu.** Göç
      dosyası sekiz yorum satırı taşıyor, canlı tanım hiçbirini. Mantık satır
      satır aynıydı ama bu, depo ile veri tabanının sessizce ayrışabildiğinin
      kanıtı. Gövde yorumlarıyla birlikte geri yazıldı.

- [x] **Idempotency zaten sınanıyormuş** (2026-08-16). Yeni test yazmak
      gerekmedi: `ledger_hardening_test.sql`'in ilk bölümü tam olarak bunu
      yapıyor — `earn_points` aynı anahtarla iki kez çağrılıyor, ikinci çağrının
      puan basmadığı ve defterde tek satır kaldığı doğrulanıyor. Anahtarsız
      çağrının reddedildiği de sınanıyor. **Koşuldu ve geçti.**

- [x] **`cargo-payment-init` okundu.** Gerisi sağlam: fiyatı sunucu hesaplıyor
      (`quote_trade_price`), çağıranın takasın **alıcısı** olduğu doğrulanıyor,
      durum `POINTS_HELD` değilse reddediliyor, PAID ödeme varsa ikinci kez
      başlatılmıyor.

### Kapsam — uygulama
- [x] **Sırlar.** Mobil ağaçtaki tek JWT `"role":"anon"`; `service_role` yalnızca
      bir yorum satırında geçiyor, iyzico sırrı hiç yok. Pakete inebilecek tek
      değişken sınıfı `EXPO_PUBLIC_*` ve yalnızca ikisi tanımlı:
      `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
      Yani kaynakta olmayan bir şey pakete de inemez — TODO "derlenmiş pakette
      ara" diyordu, `EXPO_PUBLIC_` listesi bunun daha güçlü hâli.
- [x] **Derin bağlantılar incelendi** (2026-08-16). `openCheckout` sağlam:
      dönüş `openAuthSessionAsync` ile yakalanıyor, sonuç **bilgilendirme
      olarak** ele alınıyor (kanıt değil — gerçeği `iyzico-callback` belirler)
      ve bilinmeyen durum güvenli dala düşüyor.

      **Ama `payment-result` ekranı yoktu** — `auth-callback` ile tam olarak
      aynı kusur. Normalde görünmüyor çünkü tarayıcı oturumu dönüşü kendi
      yakalıyor; uygulama tarayıcı açıkken **öldürülürse** (Android'de düşük
      bellekte sık) sistem o rotayla soğuk açıyor ve yakalayacak oturum
      kalmıyordu. Kullanıcı parasını ödeyip eşleşmeyen bir ekrana iniyordu.
      Ekran yazıldı; `status`'ü kanıt saymıyor, yalnızca cümle kurup
      Takaslarım'a gönderiyor.
- [ ] **`+not-found` ekranı yok.** Eşleşmeyen her derin bağlantı Expo'nun
      geliştirici ekranını gösteriyor. `auth-callback` ve `payment-result`
      yazıldı ama üçüncü bir eşleşmeyen adres yine boşluğa düşer.
- [ ] **Oturum saklama — ikinci geçişe kaldı.** Jeton `AsyncStorage`'da, yani
      **şifresiz**. Root'lu/jailbreak'li cihazda okunabilir. Karar gerektiriyor:
      `expo-secure-store`'a taşımak native modül demek değil (Expo Go'da var).

### Kapsam — site
- [x] **Vitrin anlık görüntüsünde kişisel veri.** Repodaki `liveListings.json`
      boş yer tutucu (`kaynak: "ornek"`), gerçek anlık görüntü Vercel'de
      derleme anında üretiliyor — yani depoda kişisel veri yok.
      `vitrin-cek.mjs` iki katmanda korunuyor: SELECT listesi açık bir izin
      listesi (mesafe alanı hiç seçilmiyor) **ve** üretilen nesne alan alan
      yazılıyor, spread yok. Yeni bir kolon sessizce sızamaz.
      **Küçük not:** `seller.id` alanına satıcının değil **ilanın** kimliği
      yazılıyor. Semantik olarak yanlış ama sonucu iyi — satıcının UUID'si
      siteye hiç çıkmıyor. Biri bunu "düzeltirse" gerçek kullanıcı kimlikleri
      açık web'e iner; `vitrin-cek.mjs` içine bu uyarı düşülmeli.
- [x] **Derleme ortamı sırları.** `npm run build` çalıştırıldı; `dist/`
      içinde JWT, `service_role` ya da deploy hook URL'si **yok**.
- [x] **Bağımlılık taraması.** Sitede `npm audit --omit=dev` → **0 açık**;
      tümünde 1 yüksek (`nanoid`, yalnızca geliştirme bağımlılığı, pakete
      inmiyor). TODO'daki "29 uyarı" aslında **mobil** tarafın sayısıydı ve
      hâlâ 29 — ama 29'un neredeyse tamamı **derleme araç zinciri**
      (`@expo/cli`, `metro`, `tar`, `xcode`, `shell-quote`, `js-yaml`);
      uygulamanın JS paketine inen kod değil. Expo bunları normal bağımlılık
      olarak listelediği için `--omit=dev` de ayıklamıyor, sayı yanıltıcı.
      **`npm audit fix --force` çalıştırılmayacak:** `react-native` ve `expo`
      sürümlerini SDK 54 hizasından çıkarır. Bunlar Expo SDK yükseltmesiyle
      kapanır.

### Kapsam — süreç
- [ ] **Depo görünürlüğü kararı** (yukarıda açık madde) bu turdan önce
      verilmeli; açık repoda sır tutulamaz.
- [ ] Bulguların her biri ya kapatılır ya da "kabul edildi, gerekçesi şu"
      diye yazılır. Sessizce bırakılan bulgu yok.

## 📸 Kare denetimi — sahtecilik ve mahremiyet (2026-08-16)

`photo-check` **canlıda: sürüm 3, ACTIVE, `verify_jwt = true`.** Yayındaki dosya
içeriği repodakiyle birebir doğrulandı.

**Bu turda yapıldı:**

- [x] **Kıyaslamalı denetim.** `photo-check` yeni kareyi ilanın **onaylanmış
      bütün açı kareleriyle** birlikte modele gönderiyor; "aynı ürün mü",
      "hiçbiriyle aynı açı değil mi". Ürünün tek yüzünü beş slota çekmek de,
      iki yüzü dönüşümlü çekmek de yakalanıyor.
- [x] **Kıyas kareleri küçültülerek gönderiliyor** (depolama dönüşümü: denetlenen
      kare 1280, kıyas kareleri 640) + 8 MB bayt bütçesi ve dönüşüm kapalıysa
      tam boya düşen yedek yol. Dört tam boy fotoğraf tek isteğe sığmıyordu.
- [x] **Reddedilen kare depodan siliniyor.** Çocuk yüzü içerdiği için reddedilen
      görsel kovada süresiz duruyordu; artık karar anında siliniyor.
- [x] **Çekim ekranı kararı bekliyor**, reddedilen karede sonraki slota geçmiyor.
- [x] Ekrandan/basılı fotoğraftan çekim istem maddesine eklendi.
- [x] `String.fromCharCode(...bytes)` parçalı çevrime alındı — kova sınırı 8 MB
      ve tek seferlik yayma büyük karelerde çağrı yığınını taşırıyordu. Küçük
      fotoğrafta çalışıp büyüğünde patlayan cinsten gizli bir hataydı.

**Geriye dönük temizlik gerekmedi:** ölçüldü, `product_photos`'ta 15 kare var ve
hepsi `approved`. Reddedilmiş kare yok, yani silinecek birikmiş görsel de yok.

### Kapanmayan açıklar — bu konunun devamı

- [x] **Dönüşümlü aynı açı kapatıldı** (2026-08-16, aynı gün). Zincir ardışık
      çiftlere bakıyordu; A → B → A sırası her çiftte farklı görünüp geçiyordu.
      Kıyas artık önceki **tüm** onaylı açılarla yapılıyor.
- [ ] **İlanlar arası kare yeniden kullanımı.** Kıyas ilanın içinde kalıyor.
      Satıcının kendi eski ilanından ya da **başka bir hesabın** ilanından kare
      kopyalaması yakalanmıyor. Gerekli: kare başına parmak izi (pHash ucuz ve
      birebir kopyayı, embedding aynı ürünün farklı karesini yakalar), bir tablo
      ve yükleme anında veri tabanı geneli arama. Eşleşme **otomatik ret değil,
      incelemeye düşürme** olmalı — aynı üründen ikinci bir tane satmak meşru.
- [ ] **Alıcının itiraz fotoğrafı ile satıcının kareleri kıyaslanmıyor.**
      Dolandırıcılığın gerçekten *kanıtlandığı* yer burası ve aynı parmak izi
      altyapısını kullanıyor. Yukarıdaki maddeyle aynı turda yapılmalı.
- [ ] **Çekim telemetrisi kaydedilmiyor.** Kareler arası süre ve cihaz yönü
      (`expo-sensors`, Expo Go'da çalışır) bedava sinyaller ve hiçbiri
      tutulmuyor. Beş kare üç saniyede geldiyse kimse ürünün etrafında
      dolaşmadı. **Sert kapı olmasın, güven skoruna girsin** — dürüst sınır:
      küçük üründe doğru yöntem eşyayı çevirmek, telefon yerinde durur ve yön
      değişmez. Yön büyük ürün kategorilerinde anlamlı, zıbında değil.
- [ ] **Yanlış reddin itiraz yolu yok.** Model hatalı reddederse satıcı yalnızca
      yeniden çekebiliyor; "bu karar yanlış, insan baksın" diyemiyor. `pending`
      insan kuyruğu zaten var, ret için de bir kapı açılmalı.
- [ ] **`pending` kuyruğunu kimse izlemiyor.** Yapay zekâ erişilemezse kareler
      doğru şekilde `pending` kalıyor ve ilan yayına giremiyor — ama kuyruğa
      bakan biri yoksa satıcı süresiz bekler. Operasyon kararı, kod değil.
- [ ] **Silme başarısız olursa artık kalıyor.** `remove()` hata verirse log'a
      düşüyor ve nesne kovada kalıyor; toparlayan periyodik bir iş yok.
      Yeniden çekilen kare aynı yola `upsert` edildiği için kendiliğinden
      üzerine yazılıyor — açık olan tek durum, **reddedilip hiç yeniden
      çekilmeyen** kare, yani ilanı yarıda bırakan kullanıcı.
- [ ] **Model maliyeti ölçülmüyor, sınırı yok.** Beş karenin dördü artık iki
      görsel taşıyor; ilan başına maliyet hâlâ kuruş mertebesinde ama **ölçülmüş
      bir rakam yok** ve oran sınırı da yok. Kimlik doğrulaması istiyoruz, yani
      rastgele biri değil — ama oturum açmış bir kullanıcı arka arkaya kare
      yükleyerek kotayı yakabilir.
- [ ] **Cihazda, deklanşörden önce yüz tanıma.** Görsel hâlâ sunucuya çıkıyor
      (saniyeler için, saklanmadan). Hiç çıkmaması için ML Kit / vision-camera
      gerekiyor → development build → Expo Go biter. Launch öncesi güvenlik
      turunda ayrı bir karar olarak ele alınacak.

## 🩹 Üç kusur kapatıldı (2026-08-16)

- [x] **`app/auth-callback` ekranı yazıldı** — rota `_layout.tsx`'te
      `AUTH_ROUTES` içinde sayılıyordu ama **dosyası hiç yoktu.** OAuth dönüşü
      `openAuthSessionAsync` ile uygulama içinde yakalandığı için bugüne kadar
      görünmemişti; **şifre sıfırlama bağlantısı doğrudan o rotaya düşüyor**,
      yani SMTP kurulur kurulmaz kullanıcı boş bir ekrana inecekti.

      Üç bağlantı biçimi de karşılanıyor: `?code=` (PKCE, varsayılan),
      `?token_hash=&type=` (doğrulama), `#access_token=` (örtük). Parça
      `Linking` ile okunuyor — expo-router'ın `useLocalSearchParams`'ı yalnızca
      sorgu dizesini görür.

      Sıfırlama `/yeni-sifre` rotasına devrediyor. Kendi rotası olması teknik
      bir zorunluluk: oturum açıldığı anda kapı `AUTH_ROUTES` içindeki her
      rotayı `/(tabs)`'a atıyor, form `auth-callback` içinde olsaydı görünür
      görünmez kaybolurdu.

      Bir de bayrak var (`sifirlamaBayragiYaz`): PKCE akışında Supabase dönüş
      adresine `type=recovery` yazmayabiliyor ve o durumda kullanıcı içeri
      girer ama şifre formu hiç açılmazdı. Bayrak sıfırlama isteği
      gönderilirken yazılıp dönüşte siliniyor, ömrü bir saat.
- [x] **Türkçe arama düzeltildi** (`lib/arama.ts`). İki ayrı kusur vardı:
      `"İpekyol".toLowerCase()` birleşen noktalı bir `i` üretiyor ve düz
      "ipek" ile eşleşmiyordu; şapkasız yazan ("cocuk", "ahsap", "puset")
      hiçbir şey bulamıyordu. Taranan alanlara **açıklama ve konum** da
      eklendi, sorgu kelimelere bölünüyor (sıra dayatılmıyor).
      12 vaka ile doğrulandı.
- [x] **İtiraz kanıtında galeri izni isteniyor** (`trades.tsx`). Kamera izni
      reddedilince galeri izni **hiç istenmeden** `launchImageLibraryAsync`
      çağrılıyordu; iOS'ta sessizce boş dönüyor, kullanıcı "Fotoğraf ekle"ye
      basıp hiçbir şey olmadığını görüyordu — 24 saatlik kanıt sayacı işlerken
      ve parası havuzda rehinken. İkisi de reddedilirse artık ne yapacağını
      söyleyen bir uyarı çıkıyor.

## 🌐 Alan adı — `eldeneletakas.com` (2026-08-16 · sürüyor)

Alan adı GoDaddy'den alındı. Adım adım talimat **`KURULUM.md`** dosyasında;
burada yalnızca durum takibi var. Sıra bozulmaz: DNS yeşile dönmeden Resend
doğrulanmaz, Resend doğrulanmadan SMTP tanımlanmaz.

**Panelde yapılacaklar (kullanıcıda):**

- [ ] **Vercel — alan adı eklenir.** `takas-site` → Settings → Domains.
      `eldeneletakas.com` ve `www.eldeneletakas.com` ayrı ayrı eklenir.
      **"Redirect apex domains to www" işareti kaldırılır** — ana adres apex
      (`eldeneletakas.com`), `www` ona yönlenir. Ters kurulsaydı paylaşım
      kartındaki ve uygulamadaki beş sabit adres `www`'lu olmak zorunda kalırdı.
- [ ] **GoDaddy — iki DNS kaydı Vercel'in verdiği değerlerle düzenlenir.**
      `A · @` (şu an park IP'si `13.248.243.5` / `76.223.105.230`) ve
      `CNAME · www` (şu an `eldeneletakas.com.`).
      **Silinmez, düzenlenir** — Domain Forwarding açıksa silinen kayıt geri
      yazılır ve neyin ne olduğu karışır. TTL 600.
      Ayrıca **Domain Forwarding kapalı** olmalı; açık kaldığı sürece bütün
      düzenlemeleri geri alır.
      Doğrulama: Vercel'de iki adresin de yanında yeşil tik, tarayıcıda
      `https://eldeneletakas.com` ELDENELE sitesini açıyor.
- [ ] **Resend** — hesap, `eldeneletakas.com` alan adı (bölge **EU/Ireland**),
      verdiği 3–4 kayıt GoDaddy'ye girilir, "Verified" beklenir, sonra
      `supabase-auth` adlı API anahtarı üretilir (`re_…`, bir kez gösterilir).
- [ ] **Supabase SMTP** — `smtp.resend.com:465`, kullanıcı `resend`, gönderen
      `destek@eldeneletakas.com`.
- [ ] **Supabase URL yapılandırması** — Site URL `https://eldeneletakas.com`,
      izin listesine `eldenele://auth-callback`.
- [ ] **E-posta şablonları Türkçe'ye çevrilir** (dördü de varsayılanda İngilizce).
- [ ] **GoDaddy e-posta yönlendirmesi** — `destek@eldeneletakas.com` kendi
      kutuna düşsün; `noreply@` kullanılmıyor, cevap yazan kullanıcı boşluğa
      yazmasın diye.

**Kodda yapılacaklar (bende — DNS yeşile döndükten sonra):**

- [x] **`app/auth-callback` ekranı yazıldı** (2026-08-16) — alan adını
      beklemiyordu, ayrıntısı yukarıdaki "Üç kusur kapatıldı" bölümünde.
- [ ] `index.html` — dört meta etiketinde `takas-site.vercel.app` →
      `eldeneletakas.com` (canonical, og:url, og:image, twitter:image)
- [ ] `mobile/lib/brand.ts` — `WEB_URL` aynı şekilde
- [ ] Alan adı iki reponun dokümanlarına işlenecek

**Ertelendi (kullanıcı kararı):** Vercel'deki artık `takas-web-site` projesi
silinecek — acelesi yok. Not: o projede **Vercel Authentication zaten açık**
(`all_except_custom_domains`), yani dışarıya açık değil.

## 🧭 Kapsam denetimi — listede hiç olmayanlar (2026-08-16)

Bu bölüm bir tur işi değil, bir **eksik listesi**. Yukarıdaki 45 açık madde
"başladığımız işlerin kalanı"; aşağıdakiler hiç başlamamış ve çoğu yazılı
bile değildi. Dördü ölçülerek doğrulandı (kodda arandı, yok).

### A · Mağaza reddi sebebi — bunlar olmadan yayın olmaz

- [x] **Hesap silme yazıldı** (2026-08-16). `delete_own_account` +
      Güvenlik ekranının altında kırmızı bölüm, iki adımlı onay.
      Açık takas, rezerve ilan ya da ödenmemiş borç varsa **reddediliyor** ve
      sebebi söyleniyor ("silemezsin" değil, "şunu bitir sonra silebilirsin").
      Bakiye deftere `CLOSE` hareketiyle düşüyor — yeni hareket türü eklendi.
      `auth.users` silinince yalnızca `profiles`, `favorites`, `cart_items`
      zincirleme gidiyor (ölçüldü); defter, denetim kaydı, takas ve mesajlar
      kasıtlı olarak duruyor, geride yalnızca `uuid` kalıyor.
      **Cihazda denenmedi** — kamera gibi bu da gerçek bir hesap gerektiriyor.
- [x] **Kullanıcı engelleme yazıldı** (2026-08-16). `user_blocks` tablosu,
      `block_conversation_peer` / `unblock_user`, sohbet başlığında düğme.
      Engel `send_message` içinde **iki yönlü** denetleniyor. Hedef sunucuda
      sohbetten türetiliyor: karşı tarafın kimliği istemciye hiç verilmiyor.
      Sohbet gizlenmiyor (kanıt), takas durdurulmuyor (kilitlenirdi), hangi
      tarafın engellediği söylenmiyor.
- [ ] **Engellenenler listesi ekranı yok.** Engel kurulabiliyor ama kullanıcı
      kimleri engellediğini göremiyor ve kaldıramıyor. `unblock_user` hazır,
      `user_blocks` kendi satırlarını okumaya açık — eksik olan tek şey ekran.
- [x] **Gizlilik politikası yazıldı ve yayına girdi** (2026-08-16) —
      `/gizlilik/`, site deposunda `public/gizlilik/index.html`. Tek dosya,
      derleme yok, React'ten bağımsız: uygulamanın sürümü değişince mağazadaki
      adres kırılmamalı. Eski modal girdisi kaldırıldı (iletişim adresi de
      yanlıştı). Metin ölçülerek yazıldı — konum izni istenmediği için
      "konumunuzu telefondan almıyoruz" denilebildi.

      **İki şey eksik ve ikisi de sende:**
      - [ ] `destek@eldeneletakas.com` **çalışmıyor.** Metin bu adresi veriyor;
            GoDaddy e-posta yönlendirmesi kurulmadan mağaza gönderimi yapılmamalı.
      - [ ] **Hukuki inceleme yapılmadı.** Metin uygulamanın gerçek davranışını
            doğru anlatıyor; KVKK kapsamında eksiksiz olup olmadığı avukat işi.
            Aynı turda veri sorumlusunun tüzel kişi adı da netleşmeli — şu an
            yalnızca marka adı yazıyor.

### B · Hukuk (Türkiye) — avukat sorusu, kod sorusu değil

- [ ] **ETBİS kaydı.** Elektronik ticaret bilgi sistemine kayıt, ticari
      faaliyet yürüten site ve uygulamalar için zorunlu.
- [ ] **KVKK: aydınlatma metni + açık rıza + VERBİS.** Fotoğraf ve konum
      işliyoruz; aydınlatma metni ayrı bir belge ve rıza akışı ayrı bir ekran.
      VERBİS kaydı gerekip gerekmediği veri hacmine bağlı, sorulmalı.
- [ ] **Mesafeli satış / ön bilgilendirme ve cayma hakkı.** Puan takası
      "satış" sayılmasa da kargo bedeli gerçek parayla tahsil ediliyor.
      6502 sayılı kanunun cayma hakkı 14 gün; bizim itiraz penceremiz 48 saat.
      Bu ikisi çelişiyor olabilir — **kurgu değişebilir, önce sorulmalı.**
- [ ] **Yaş sınırı.** Kayıt sırasında 18 yaş kontrolü yok. Reşit olmayanla
      sözleşme kurmak ve onun verisini işlemek ayrı bir sorun.

### C · Ekonomi ve operasyon — en büyük iki risk burada

- [ ] **Puan enflasyonu: değerlemeyi kimse denetlemiyor.** `create_listing`
      puanı **satıcıdan** alıyor. Kullanılmış bir zıbınayı 5000 puan yazmayı
      engelleyen bir kural yok. Kapalı devrede bu doğrudan para basmaktır ve
      birkaç kötü ilan bütün ekonomiyi bozar. "Dinamik puan önerisi" TODO'da
      tek satır olarak duruyor ama bu bir öneri değil, **tavan/kontrol**
      meselesi. Yayın öncesi en az kaba bir sınır: kategori × durum × desi
      bandına göre üst sınır.
- [ ] **İtiraza bakacak insan yok.** `resolve_dispute` bilerek yalnızca
      insanda. Operatör olmadan yayına çıkılırsa itirazlar birikir ve **alıcının
      puanı havuzda donar**. Aynı şey `pending` kare kuyruğu için de geçerli.
      Bu bir kod maddesi değil, "kim, hangi saatlerde bakıyor" sorusu.
- [ ] **Kargo maliyeti varsayım.** ₺52 rakamı anlaşma olmadan konuldu. Gerçek
      tarife ₺75 çıkarsa her takas zarar eder. Anlaşma imzalanana kadar ücret
      tablosu **varsayım** olarak işaretli kalmalı.
- [ ] **Soğuk başlangıç coğrafi olarak çözülmeli.** Ülke geneline 15 ilanla
      açılmak, giren herkesin boş raf görüp bir daha dönmemesi demek. Kampanya
      puanı arz sorununu çözmüyor. Öneri: **tek ilçede** yoğunluk kurup oradan
      genişlemek.

### D · Site — pazarlama sitesinin asıl işi yapılmamış

- [ ] **Ölçüm yok.** Analitik hiç kurulu değil; sitenin işe yarayıp
      yaramadığını bilmiyoruz. Vercel Analytics tek satır ve çerezsiz.
- [ ] **Tek indekslenebilir adres var.** Site tek sayfa. Oysa edinim kanalı
      tam olarak burası olurdu: "ikinci el bebek arabası takası" gibi
      aramalara karşılık gelen kategori sayfaları. Dokuz kategori × birer
      sayfa, vitrinden beslenir.
- [ ] **Mağaza karekodları henüz hiçbir yere gitmiyor.** Uygulama yayında
      olmadığı için `StoreQrCodes` bugün ölü. Yayın günü ilk düzeltilecek şey.
- [ ] **Siteden uygulamaya süreklilik yok.** Web'de bir ilana bakan kişi
      uygulamayı açtığında o ilana düşmüyor. Universal Links / App Links
      kurulursa mağaza yönlendirmesi kayıp olmaktan çıkar.

### E · Teknik borç — sessiz olanlar

- [ ] **Hata izleme yok.** Sentry benzeri hiçbir şey kurulu değil; canlıdaki
      çökmeleri **göremiyoruz**. Yayın günü en çok ihtiyaç duyulacak şey bu.
- [ ] **Uygulama tarafında tek bir test yok.** Veri tabanında 18 test var,
      React Native tarafında sıfır. Takas akışını sessizce bozan bir düzenleme
      hiçbir yerde yakalanmaz.
- [ ] **Geri dönüş planı doğrulanmadı.** Kötü bir göç ya da yanlış bir toplu
      güncelleme sonrası hangi noktaya dönebiliyoruz? Pro planın
      point-in-time recovery durumu teyit edilmeli — yayından **önce**.

## 🚀 Yayın (config gerektirir)
- [ ] Supabase dashboard: Google/Apple provider + redirect `eldenele://auth-callback`
      (şema değişti; bu satır `kidstrade` yazıyordu — yukarıdaki "panelde
      tamamlanması gereken iki adım" maddesiyle aynı iş)
- [ ] iyzico **sandbox** anahtarları → uçtan uca ödeme testi → canlı anahtar
- [ ] EAS build + submit (App Store + Google Play) — `mobile/README.md`
- [x] **Gizlilik politikası yazıldı** (2026-08-16) — `/gizlilik/`. Metnin
      verdiği destek adresinin çalışması ve hukuki inceleme hâlâ açık;
      ikisi "Kapsam denetimi" bölümünde ayrı madde.
- [ ] Mağaza görselleri (ekran görüntüleri, tanıtım metni), yaş derecelendirmesi

## 📌 Bağımlılıklar (bizde değil — kullanıcı sağlamalı)
- iyzico sandbox/canlı API key + secret
- Supabase dashboard OAuth config (proje ve anahtarlar artık hazır)
- Kargo aggregator hesabı + anlaşmalı tarife
- Apple Developer + Google Play hesapları (mevcut)
