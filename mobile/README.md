# KIDS TRADE — Mobil Uygulama (Expo + React Native)

Puanlı çocuk ürünü takas pazaryerinin **native mobil uygulaması**. Tek kod tabanından
**hem iOS hem Android** için derlenir ve **EAS** ile doğrudan App Store + Google Play'e
gönderilir. Material Design 3 tema, file-based routing (Expo Router) ile kurulmuştur.

> Neden bu yığın? Expo + EAS bugün cross-platform mobil için en yaygın, modern çözümdür.
> En kritik avantaj: **iOS derlemesi için Mac gerekmez** — EAS Build bulutta `.ipa` üretir.

## Teknoloji
- **Expo SDK 52** + **React Native 0.76**
- **Expo Router** (dosya tabanlı navigasyon, `app/` klasörü)
- **TypeScript** (strict)
- **@expo/vector-icons** (Material Icons) · **react-native-svg** · **expo-linear-gradient**
- **Supabase** (`@supabase/supabase-js`) — Auth + puan defteri okuma
- **EAS Build / Submit** (mağaza derleme + yayın)

## Gezinme & ekranlar
Özel alt menü (`components/TabBar.tsx`): **Anasayfa · Sepetim · Ürün Ekle (ortada) · Favoriler · Hesabım**.
Ortadaki "Ürün Ekle" yükseltilmiş primary buton, `/add-listing` modalını açar (sekme değil).

| Yol | Ekran |
|-----|-------|
| `app/(tabs)/index.tsx` | Anasayfa — arama + 14 kategori + öne çıkanlar + ızgara |
| `app/(tabs)/cart.tsx` | Sepetim — alma sepeti, toplam puan, "Takas et" |
| `app/(tabs)/favorites.tsx` | Favoriler (kalp deposu) |
| `app/(tabs)/profile.tsx` | Hesabım — güven skoru, Cüzdanım/Takaslarım/Mesajlarım, ayarlar |
| `app/product/[id].tsx` | Ürün detayı (galeri, güvenli havuz, sepete ekle, paylaş) |
| `app/add-listing.tsx` | Ürün Ekle (foto + AI + kategori/kondisyon + puan) |
| `app/trades.tsx` · `app/wallet.tsx` | Takas durumu · Cüzdan (Hesabım altından) |
| `app/messages.tsx` · `app/chat/[id].tsx` | Mesajlarım · Sohbet |
| `app/addresses.tsx` · `app/security.tsx` · `app/help.tsx` · `app/invite.tsx` · `app/edit-profile.tsx` | Hesap alt sayfaları |
| `app/onboarding.tsx` · `app/sign-in.tsx` | Giriş/Onboarding · e-posta giriş |

İstemci durumları: `lib/favorites.tsx`, `lib/cart.tsx` (AsyncStorage). Kategoriler: `data/categories.ts`.

## Backend bağlantısı (Supabase)
Cüzdan ve auth, `../supabase/` altındaki puan defterine bağlanır.
- `lib/supabase.ts` — ANON anahtarla istemci (PKCE akışı)
- `lib/auth.tsx` — `AuthProvider` / `useAuth`: e-posta + Google/Apple OAuth, oturum
- `lib/wallet.ts` + `hooks/useWallet.ts` — `wallets`/`wallet_entries` okuma

**Ortam değişkenleri** (`.env.example` → `.env`):
```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```
> Anahtar **yoksa** uygulama otomatik **DEMO** modda çalışır (örnek veri, giriş
> kapısı uygulanmaz) — tasarım incelemesi için idealdir. Anahtar + oturumla
> cüzdan/profil **canlıya** döner (RLS `auth.uid()` üzerinden korunur).
> `service_role` anahtarı **asla** mobilde olmaz; yalnızca backend'de.

OAuth'un gerçek çalışması için Supabase dashboard'da Google/Apple provider'ları
etkinleştirilmeli ve redirect URL'e `kidstrade://auth-callback` eklenmelidir.
E-posta/şifre ise ekstra config gerektirmez.

## Yerel geliştirme
```bash
cd mobile
npm install
npx expo start         # QR kodu Expo Go ile telefonda aç
# veya: npm run ios / npm run android (simülatör/emülatör)
```

---

## Mağazalara yayınlama (EAS)

### 0. Tek seferlik hazırlık
```bash
npm install -g eas-cli
eas login                       # Expo hesabı (ücretsiz)
cd mobile
eas build:configure
```

`app.json` içindeki kimlikler hazır:
- iOS bundle id: `com.kidstrade.app`
- Android package: `com.kidstrade.app`

### 1. Derleme (build)
```bash
# Her iki platform için production derlemesi (bulutta çalışır, Mac gerekmez)
eas build --platform all --profile production
```
Çıktı: Android `.aab` + iOS `.ipa`. EAS imzalama anahtarlarını sorar:
- **Android:** "Generate a new keystore" → EAS sizin için üretip saklar.
- **iOS:** Apple hesabınızla giriş → EAS sertifika + provisioning profile'ı otomatik yönetir.

### 2. App Store Connect / Google Play kayıtları
İlk gönderimden önce uygulama kaydını oluşturun:
- **Apple:** https://appstoreconnect.apple.com → "+ New App"
  → `eas.json`'daki `ascAppId` ve `appleTeamId` alanlarını gerçek değerlerle doldurun.
- **Google Play:** https://play.google.com/console → "Create app"
  → Bir **service account** JSON anahtarı indirip `mobile/google-play-service-account.json`
    olarak koyun (bu dosya `.gitignore`'da — repoya **girmez**).

### 3. Gönderim (submit)
```bash
eas submit --platform ios --profile production --latest
eas submit --platform android --profile production --latest
```
- iOS: build TestFlight'a düşer → App Store Connect'te "Submit for Review".
- Android: `internal` track'e yüklenir → Play Console'da production'a yükseltin.

### 4. İnceleme
- **Apple:** tipik 24–48 saat inceleme.
- **Google:** tipik birkaç saat – 2 gün.

---

## Yayın öncesi kontrol listesi
- [ ] `app.json` → `version` ve `ios.buildNumber` / `android.versionCode` güncel
- [ ] Gizlilik politikası URL'i (her iki mağaza zorunlu kılar — KVKK ile uyumlu)
- [ ] Mağaza ekran görüntüleri (iPhone 6.7" + 5.5", çeşitli Android boyutları)
- [ ] Uygulama açıklaması, anahtar kelimeler, kategori (Alışveriş)
- [ ] Yaş derecelendirmesi anketi
- [ ] iOS: App Privacy ("veri toplama") beyanı
- [ ] Apple Developer (99$/yıl) ve Google Play (25$ tek sefer) hesapları aktif

## Notlar
- `assets/app/icon.png`, `adaptive-icon.png`, `splash.png` marka placeholder'larıdır;
  nihai görsellerle değiştirilebilir.
- Ürün verisi şimdilik `data/products.ts` içinde statiktir; canlıya geçişte
  `products` tablosuna bağlanır (cüzdan + auth zaten Supabase'e bağlı).
- `metro.config.js`, `supabase-js`'in opsiyonel `@opentelemetry/api` importunu boş
  modüle yönlendirir (web + native build için gerekli).
