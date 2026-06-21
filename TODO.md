# KIDS TRADE — Yol Haritası / TODO

Son güncelleme: 2026-06-21 · Branch: `claude/happy-thompson-omacgb`

## ✅ Tamamlandı
- [x] Material Design 3 v2 tasarımı — 7 ekran (HTML mockup + render görüntüleri)
- [x] Expo + React Native uygulama iskeleti (TS strict, Expo Router, EAS config)
- [x] Marka uygulama ikonu + splash
- [x] Önceki HTML projesi `archive/`'e taşındı
- [x] Puan defteri (güvenli havuz): `wallets` / `wallet_entries` / `trades`
  - [x] Atomik `earn` / `hold` / `release` / `refund` (yarış-koşulsuz, negatif/çift harcama engelli)
  - [x] RLS + yerel Postgres'te uçtan uca test (`supabase/tests/`)
- [x] iyzico Checkout Form backend — kargo tahsilatı + komisyon (Edge Functions)
  - [x] IYZWSv2 imza (doğrulandı), init + callback (RETRIEVE doğrulamalı)
- [x] Cüzdan ekranı → canlı puan defteri (loading + pull-to-refresh + demo fallback)
- [x] Supabase Auth — Google/Apple OAuth (PKCE) + e-posta/şifre + oturum yönlendirme
- [x] Dokümanlar (README'ler + CLAUDE.md + bu dosya)

## ⏳ Sıradaki (öncelik sırası)
- [ ] **Ürün listesi → Supabase** — `products` tablosu + migration; `data/products.ts`
      yerine canlı veri; ilan ekleme (`Ürün ekle` FAB akışı)
- [ ] **Ödeme WebView ekranı** — `cargo-payment-init` token'ı ile iyzico ödeme
      ekranı (WebView) + `kidstrade://payment-result` deep-link dönüşü
- [ ] **Takaslar ekranı → canlı `trades`** — gerçek durum makinesi + aksiyonlar
- [ ] **Kargo aggregator** (Navlungo/Kolay Gelsin) — `iyzico-callback` içindeki
      etiket üretimi `TODO`'su; `carrier_cost`'u gerçek tarifeden al

## 🔜 Sonra
- [ ] "Ürününü Puana Çevir" tam ekran (kamera + AI fotoğraf kontrolü + puan hesabı)
- [ ] Keşfet sekmesi gerçek içerik (konum/öneri)
- [ ] Mesajlaşma (alıcı–satıcı)
- [ ] Bildirimler (push) — takas/teslim/onay
- [ ] Güven skoru hesaplama (zamanında kargo, düşük itiraz)
- [ ] İtiraz/dispute akışı (DISPUTED → hakemlik)

## 🚀 Yayın (config gerektirir)
- [ ] Supabase dashboard: Google/Apple provider + redirect `kidstrade://auth-callback`
- [ ] iyzico **sandbox** anahtarları → uçtan uca ödeme testi → canlı anahtar
- [ ] EAS build + submit (App Store + Google Play) — `mobile/README.md`
- [ ] Gizlilik politikası (KVKK), mağaza görselleri, yaş derecelendirmesi

## 📌 Bağımlılıklar (bizde değil — kullanıcı sağlamalı)
- iyzico sandbox/canlı API key + secret
- Supabase proje ref + anon/service_role anahtarları
- Kargo aggregator hesabı + anlaşmalı tarife
- Apple Developer + Google Play hesapları (mevcut)
