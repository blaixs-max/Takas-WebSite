# KIDS TRADE

Puanlı çocuk ürünü takas pazaryeri. Kullanılmayan oyuncak, kitap ve montessori
ürünleri **Takas Puanı**'na çevrilir; ürün teslim edilene kadar puan **güvenli
havuzda** bekler ve sistem hem alıcıyı hem satıcıyı korur.

## Yapı

| Klasör | Açıklama |
|--------|----------|
| **`mobile/`** | **Aktif proje** — Expo + React Native mobil uygulaması (iOS + Android), Material Design 3 v2 tasarımı. |
| `supabase/` | Ödeme backend'i — iyzico Checkout Form ile kargo tahsilatı + komisyon (Edge Functions) |
| `screens/` | Tasarımın render edilmiş ekran görüntüleri (7 ekran) |
| `archive/` | Önceki HTML projesi (web prototipi + tasarım mockup'ı) — referans amaçlı |

## Mobil uygulama

Geliştirme ve mağaza yayını için `mobile/README.md` dosyasına bakın.

```bash
cd mobile
npm install
npx expo start
```

## Ekranlar
Giriş/Onboarding · Takas Rafı · Ürün Detayı · Ürününü Puana Çevir ·
Güvenli Havuz Akışı · Cüzdan · Profil & Güven
