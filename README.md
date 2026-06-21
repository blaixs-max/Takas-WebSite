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
| 7 ekranlık Material Design 3 arayüz | ✅ |
| Puan defteri — atomik HOLD/RELEASE/REFUND (testli) | ✅ |
| iyzico Checkout Form — kargo tahsilatı + komisyon | ✅ (skeleton, sandbox testine hazır) |
| Supabase Auth — Google/Apple OAuth + e-posta | ✅ |
| Cüzdan → canlı puan defteri bağlantısı | ✅ |
| Ürün listesi (statik → Supabase `products`) | ⏳ |
| Kargo aggregator (etiket üretimi) | ⏳ |
| EAS mağaza derleme/gönderim | ⏳ (rehber hazır) |

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
