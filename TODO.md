# KIDS TRADE — Yol Haritası / TODO

Son güncelleme: 2026-08-08 · Branch: `claude/expo-ilan-ve-satinalma`

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

## ⏳ Sıradaki (öncelik sırası)
- [ ] **Yönetim paneli** — `resolve_dispute()` yazıldı ve doğrulandı ama yalnızca
      `service_role`'a açık; kararı verecek bir yüzey yok. Şu an itiraz kuyruğunu
      görmenin tek yolu SQL. Aynı panel `pending` kalan ilan karelerini de
      görmeli — iki kuyruk, tek yüzey
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
- [ ] **pg_cron doğrulaması** — görev yalnızca uzantı kuruluysa kuruluyor.
      Supabase panelinde `cron.job` içinde `kt-expire-stale-trades` görünmeli

## 🔜 Sonra
- [ ] Ürün Ekle: dinamik puan önerisi (kareler ve kategoriden değerleme)
- [ ] Kapakta zorunlu durum rozeti (hasar beyanı ilan kartında görünsün)
- [ ] Mesajlaşma/sohbet → gerçek zamanlı (Supabase Realtime)
- [ ] Bildirimler → push (Expo Notifications)
- [ ] Favori/Sepet → oturum açıkken Supabase'e senkron (cihaz + bulut)
- [ ] Güven skoru hesaplama (zamanında kargo, düşük itiraz)
- [ ] İtiraz/dispute akışı (DISPUTED → hakemlik)
- [ ] Dekoratif linkler (Anasayfa "Tümü/Harita") → gerçek hedef

## 🚀 Yayın (config gerektirir)
- [ ] Supabase dashboard: Google/Apple provider + redirect `kidstrade://auth-callback`
- [ ] iyzico **sandbox** anahtarları → uçtan uca ödeme testi → canlı anahtar
- [ ] EAS build + submit (App Store + Google Play) — `mobile/README.md`
- [ ] Gizlilik politikası (KVKK), mağaza görselleri, yaş derecelendirmesi

## 📌 Bağımlılıklar (bizde değil — kullanıcı sağlamalı)
- iyzico sandbox/canlı API key + secret
- Supabase proje ref + anon/service_role anahtarları + dashboard OAuth config
- Kargo aggregator hesabı + anlaşmalı tarife
- Apple Developer + Google Play hesapları (mevcut)
