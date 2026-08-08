# KIDS TRADE — Yol Haritası / TODO

Son güncelleme: 2026-08-07 · Branch: `claude/mobil-guvenlik-p0`

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

### Backend
- [x] Puan defteri (güvenli havuz): `wallets`/`wallet_entries`/`trades`, atomik
      `earn/hold/release/refund` (yarış-koşulsuz, negatif/çift harcama engelli, RLS + test)
- [x] iyzico Checkout Form — kargo tahsilatı + komisyon (IYZWSv2 imza doğrulandı)
- [x] Ürünler → Supabase `products` tablosu (RLS + seed); `useProducts`/`useProduct` canlı/demo
- [x] Cüzdan → canlı puan defteri (loading + pull-to-refresh + demo fallback)
- [x] Supabase Auth — Google/Apple OAuth (PKCE) + e-posta/şifre + oturum yönlendirme
- [x] SMS/OTP backend — Supabase Send SMS Hook → NetGSM OTP (imza doğrulamalı, skeleton)

## ⏳ Sıradaki (öncelik sırası)
- [ ] **Para ve puan katmanını bağla** — ödeme başarılı olunca `hold_points`,
      teslim onayında `release_points` çağrılsın. Şu an callback puana hiç dokunmuyor
- [ ] **İlan formuna desi kademesi** — `products.size_class` şemada var, formda yok;
      fiyatlandırma buna bağlı
- [ ] **48 saat otomatik onay** — zamanlanmış görev ve sayaç yok
- [ ] **İlan ekleme — gerçek insert** — Ürün Ekle formu Supabase `products`'a yazsın
      (şu an UI hazır, kayıt yok) + görsel yükleme (Supabase Storage).
      Form artık `size_class` (desi kademesi) de sormalı — fiyatlandırma buna bağlı
- [ ] **Satın alma → `create_trade()`** — uygulama takası doğrudan insert etmemeli,
      RPC'yi çağırmalı; rezervasyon ve emanet oradan işliyor
- [ ] **Takaslar ekranı → canlı `trades`** — gerçek durum makinesi + aksiyonlar
- [ ] **Ödeme WebView ekranı** — `cargo-payment-init` token'ı ile iyzico ödeme
      (WebView) + `kidstrade://payment-result` deep-link dönüşü
- [ ] **Kargo aggregator** (Navlungo/Kolay Gelsin) — `iyzico-callback` etiket üretimi

## 🔜 Sonra
- [ ] Ürün Ekle: kamera + gerçek AI fotoğraf kontrolü + dinamik puan
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
