# CLAUDE.md

Bu dosya, Claude Code (ve diğer AI ajanları) için proje bağlamıdır. Yeni bir
oturuma başlarken önce burayı oku.

## Proje
**KIDS TRADE** — puanlı çocuk ürünü takas pazaryeri. Kullanılmayan oyuncak/kitap/
montessori ürünleri **Takas Puanı**'na çevrilir; ürün teslim edilene kadar puan
**güvenli havuzda** (escrow) bekler. Hedef pazar: Türkiye. Arayüz dili: **Türkçe**.

## DAĞITIM ÖNCESİ KONTROL LİSTESİ (KURAL — atlanamaz)

Her push ve her merge öncesinde, sırayla:

1. **Dokümanlar güncel mi?** Yapılan değişiklik ilgili dokümanlara işlendi mi —
   bu dosya, `TODO.md`, Ana Doküman ve karşı reponun dokümanları. Kod bir kararı
   değiştiriyorsa önce doküman güncellenir, sonra kod yazılır.
2. **İki repo da yerelde senkron mu?** Hem burada hem `blaixs-max/Takas-site`
   içinde `git fetch origin` ardından `git status -sb`: ne ileri ne geri fark
   olmalı, çözülmemiş çakışma olmamalı.
3. **Kontroller geçiyor mu?** `cd mobile && npx tsc --noEmit`, ve para
   fonksiyonlarına dokunulduysa pgTAP testleri.

Üçü de doğrulanmadan push yok; push edilmeden merge yok. Bu sıra kısaltılmaz.

## Karşı repo

`blaixs-max/Takas-site` — ELDENELE pazarlama sitesi (Vite + React, Vercel).
Veri tabanına bağlanmaz. Kategori listesi buradaki `mobile/data/categories.ts`
dosyasının aynasını taşır (`src/data/categories.ts`); burada bir kategori
eklenir ya da adı değişirse orası da aynı turda güncellenir.

## Mimari
| Klasör | Ne |
|--------|----|
| `mobile/` | Expo SDK **54** + RN 0.81 + Expo Router (TS strict). Material Design 3 v2. Aktif proje. |
| `supabase/` | Postgres migrations + Edge Functions (Deno). Puan defteri + iyzico kargo + products. |
| `screens/`, `rn-screens/`, `test-screens/` | Render edilmiş tasarım/uygulama görüntüleri. |
| `archive/` | Eski HTML prototipi + mockup (referans). Yeni kod buraya YAZILMAZ. |

## Gezinme & ekranlar
- Özel alt menü (`components/TabBar.tsx`): **Anasayfa · Sepetim · [Ürün Ekle] · Favoriler · Hesabım**.
  Ortadaki "Ürün Ekle" yükseltilmiş primary buton; `/add-listing` modalını açar (sekme değil).
- Sekmeler: `app/(tabs)/` → index(Anasayfa), cart(Sepetim), favorites, profile(Hesabım).
- Takaslar (`app/trades.tsx`) ve Cüzdan (`app/wallet.tsx`) sekme DEĞİL; Hesabım altından açılır.
- Diğer rotalar `app/`: product/[id], add-listing, notifications, messages, chat/[id],
  addresses, security, help, invite, edit-profile, onboarding, sign-in.
- İstemci durumları: `lib/favorites.tsx` (kalp), `lib/cart.tsx` (sepet) — AsyncStorage'da kalıcı.
- Kategoriler tek kaynak: `data/categories.ts` (14 kategori + ikon). Ürün görselleri `data/productImages.ts`.

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
