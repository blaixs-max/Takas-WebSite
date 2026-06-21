# CLAUDE.md

Bu dosya, Claude Code (ve diğer AI ajanları) için proje bağlamıdır. Yeni bir
oturuma başlarken önce burayı oku.

## Proje
**KIDS TRADE** — puanlı çocuk ürünü takas pazaryeri. Kullanılmayan oyuncak/kitap/
montessori ürünleri **Takas Puanı**'na çevrilir; ürün teslim edilene kadar puan
**güvenli havuzda** (escrow) bekler. Hedef pazar: Türkiye. Arayüz dili: **Türkçe**.

## Mimari
| Klasör | Ne |
|--------|----|
| `mobile/` | Expo SDK 52 + RN 0.76 + Expo Router (TS strict). Material Design 3 v2. Aktif proje. |
| `supabase/` | Postgres migrations + Edge Functions (Deno). Puan defteri + iyzico kargo ödemesi. |
| `screens/`, `rn-screens/` | Render edilmiş tasarım/uygulama görüntüleri. |
| `archive/` | Eski HTML prototipi + mockup (referans). Yeni kod buraya YAZILMAZ. |

## Kritik iş kuralları (mimariyi belirler)
- **Güvenli havuz = PUAN tutar, gerçek para DEĞİL.** Escrow kendi çift girişli
  defterimizdedir (`wallets` + `wallet_entries`), PSP escrow'u kullanılmaz.
- **Gerçek para yalnızca KARGO için akar.** iyzico **tek üye işyeri** (Pazaryeri/
  alt-üye YOK). Komisyon = alıcı kargo fiyatı − anlaşmalı kargo maliyeti.
- Puanlar **parayla satın alınmaz** → e-para lisansı gerekmez. Kargo fiziksel
  hizmet → App Store/Play **IAP zorunlu değil** (iyzico serbest).

## Güvenlik kuralları (ASLA ihlal etme)
- `service_role` / iyzico `secret key` **asla mobilde** olmaz; yalnızca backend.
- Mobilde yalnızca `EXPO_PUBLIC_SUPABASE_ANON_KEY`. RLS, `auth.uid()` ile korur.
- Puan yazan fonksiyonlar `SECURITY DEFINER` + yalnızca `service_role`'a `grant`.
- iyzico callback'inde gövdeye güvenme; her zaman **RETRIEVE ile doğrula**.

## Konvansiyonlar
- Tüm kullanıcıya görünen metin **Türkçe**. Kod yorumları Türkçe.
- Renk/ölçü için `mobile/theme/tokens.ts` (M3 tonal palet). Sabit renk yazma.
- İkonlar: `@expo/vector-icons/MaterialIcons`.
- Para olmayan model: cüzdan anahtarsızken **DEMO** veriye düşer (kırılmaz).

## Komutlar
```bash
# Mobil
cd mobile && npm install
npx tsc --noEmit                      # tip kontrolü (commit öncesi)
npx expo start                        # geliştirme (Expo Go)
EXPO_NO_TELEMETRY=1 CI=1 npx expo export --platform web   # derleme doğrulama

# Supabase puan defteri testi (yerel geçici Postgres ile)
psql "$DB" -f supabase/migrations/20260621130000_points_ledger.sql
psql "$DB" -f supabase/tests/points_ledger_test.sql
```

## Git akışı
- Geliştirme branch'i: `claude/happy-thompson-omacgb`. Burada geliştir, commit, push.
- `main`'e merge yalnızca kullanıcı isteyince (fast-forward tercih).
- Commit mesajları Türkçe + açıklayıcı.

## Çalışma alışkanlığı
- Değişiklik sonrası **`npx tsc --noEmit`** çalıştır; mümkünse web export ile render et.
- Yeni RN ekranı eklerken Hermes'te `Intl`'e güvenme (manuel biçimlendir).
- Mevcut durum ve sıradaki işler için `TODO.md`'ye bak/güncelle.
