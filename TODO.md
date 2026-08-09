# KIDS TRADE — Yol Haritası / TODO

Son güncelleme: 2026-08-09 · Branch: `claude/expo-ilan-ve-satinalma`

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
- [x] Keşfet → Anasayfa'ya katıldı (arama + 14 kategori filtresi)
- [x] Takaslar & Cüzdan → Hesabım (Profil) altına taşındı

### Ekranlar (mock veri + tema uyumlu)
- [x] Anasayfa, Ürün Detayı, Sepetim, Favoriler, Profil/Hesabım
- [x] Ürün Ekle, Takas durumu, Cüzdan, Bildirimler, Sohbet, Mesajlarım
- [x] Adreslerim, Güvenlik & doğrulama, Yardım & güvenli havuz, Davet et, Profili düzenle
- [x] Onboarding + e-posta giriş/kayıt ekranı

### İşlevler
- [x] **Kategoriler** — 14 kategori (tek kaynak `data/categories.ts`, ikon eşlemeli)
- [x] **Favori** — kalp toggle, AsyncStorage'da kalıcı (`lib/favorites.tsx`)
- [x] **Sepet** — alma sepeti, toplam puan + bakiye kontrolü (`lib/cart.tsx`)
- [x] **Paylaş** — native Share (WhatsApp/mesaj/e-posta)
- [x] Tüm buton bağlantıları (dead-end yok)

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

## ⏳ Sıradaki (öncelik sırası)
- [ ] **İlk yöneticiyi ekle** — `auth.users` henüz **boş**; bu yüzden yönetici
      satırı da yok. İlk kayıttan hemen sonra Supabase SQL editöründen:
      `insert into admins (user_id, note) values ('<uuid>', 'kurucu');`
- [ ] **Edge Function ortam değişkenleri** — fonksiyonlar yayında ama gizli
      değerleri yok. Panelden girilecek: `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`,
      `IYZICO_CALLBACK_URL`, `APP_RETURN_URL`, `AI_VISION_API_KEY`,
      `NETGSM_USERCODE`, `NETGSM_PASSWORD`, `NETGSM_HEADER`,
      `SEND_SMS_HOOK_SECRET`
- [ ] **Kare akışının cihazda denenmesi** — kamera bu ortamda test edilemiyor.
      Expo Go'da yedi karenin çekimi, yeniden çekim ve yayın kapısı elden geçirilmeli
- [ ] **İnsan moderasyon kuyruğu** — `pending` kalan kareler için yönetim yüzeyi.
      Şu an anahtar yoksa ya da model yanıt vermezse ilan sessizce bekliyor,
      kimse bakmıyor. En azından bir liste ve onayla/reddet aksiyonu gerekiyor
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
- [ ] Supabase dashboard: Google/Apple provider + redirect `kidstrade://auth-callback`
- [ ] iyzico **sandbox** anahtarları → uçtan uca ödeme testi → canlı anahtar
- [ ] EAS build + submit (App Store + Google Play) — `mobile/README.md`
- [ ] Gizlilik politikası (KVKK), mağaza görselleri, yaş derecelendirmesi

## 📌 Bağımlılıklar (bizde değil — kullanıcı sağlamalı)
- iyzico sandbox/canlı API key + secret
- Supabase dashboard OAuth config (proje ve anahtarlar artık hazır)
- Kargo aggregator hesabı + anlaşmalı tarife
- Apple Developer + Google Play hesapları (mevcut)
