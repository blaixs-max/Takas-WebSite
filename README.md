# KIDS TRADE

Puanlı çocuk ürünü takas pazaryeri. Kullanılmayan oyuncak, kitap ve montessori
ürünleri **Takas Puanı**'na çevrilir; ürün teslim edilene kadar puan **güvenli
havuzda** bekler ve sistem hem alıcıyı hem satıcıyı korur.

## Yapı

| Klasör | Açıklama |
|--------|----------|
| **`mobile/`** | **Aktif proje** — Expo + React Native uygulaması (iOS + Android), Material Design 3 v2. |
| `supabase/` | Backend — puan defteri (güvenli havuz) + iyzico kargo tahsilatı/komisyon (Edge Functions) |
| `screens/` | Tasarımın render edilmiş ekran görüntüleri |
| `archive/` | Önceki HTML projesi (web prototipi + tasarım mockup'ı) — referans amaçlı |

## Mimari

```
Mobil (Expo / RN)                Supabase                         iyzico
─────────────────                ────────                         ──────
Auth (Google/Apple/e-posta) ───► auth.users
Cüzdan ekranı ──────────────────► wallets / wallet_entries (RLS)
                                   trades (durum makinesi)
                                   hold/release/refund (atomik)
Kargo ödemesi ──► Edge Function ─► cargo_payments ──► Checkout Form ──► (sandbox/prod)
```

- **Güvenli havuz = PUAN** (gerçek para değil) → kendi çift girişli defterimiz.
- **Gerçek para = yalnızca kargo** → iyzico tek üye işyeri; komisyon = kargo marjı.
- Puanlar parayla satın alınmadığı için e-para lisansı gerekmez; kargo fiziksel
  hizmet olduğu için App Store/Play IAP zorunlu değildir.

## Özellik durumu

| Alan | Durum |
|------|-------|
| Material Design 3 v2 arayüz (Expo SDK 54, Expo Go'da çalışır) | ✅ |
| Özel alt menü: Anasayfa · Sepetim · Ürün Ekle · Favoriler · Hesabım | ✅ |
| Tüm ekranlar (mock veri) + dead-end yok | ✅ |
| 14 kategori (tek kaynak) | ✅ |
| Favori (kalp) + Sepet + Paylaş (WhatsApp) — kalıcı | ✅ |
| Puan defteri — atomik HOLD/RELEASE/REFUND (testli) | ✅ |
| iyzico Checkout Form — kargo tahsilatı + komisyon | ✅ (skeleton, sandbox testine hazır) |
| Supabase Auth — Google/Apple OAuth + e-posta | ✅ |
| Cüzdan + Ürün listesi → canlı Supabase (demo fallback) | ✅ |
| İlan ekleme — gerçek insert + görsel yükleme | ⏳ |
| Takaslar → canlı `trades` · Ödeme WebView · Kargo aggregator | ⏳ |
| EAS mağaza derleme/gönderim | ⏳ (rehber hazır) |

> Ayrıntılı yapılacaklar için `TODO.md`.

## Çalıştırma

```bash
cd mobile
npm install
npx expo start          # QR → Expo Go; veya npm run web
```
Anahtar yoksa uygulama **demo** modda çalışır. Backend kurulumu ve mağaza yayını
için `mobile/README.md` ve `supabase/README.md` dosyalarına bakın.

## Ekranlar
Giriş/Onboarding · Takas Rafı · Ürün Detayı · Ürününü Puana Çevir ·
Güvenli Havuz Akışı · Cüzdan · Profil & Güven
