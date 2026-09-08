# ELDENELE — Elle onay ve satıcı kargosu kurgusu (plan)

**Tarih:** 2026-09-08 · **Durum:** taslak, onay bekliyor · **Kapsam:** iki repo + Supabase

Bu belge 2026-09-08'de kullanıcının verdiği yeni kurguyu, alınan kararları ve
kararları koda çevirme sırasını yazıyor. Onaylanınca `CLAUDE.md`, `TODO.md`,
Ana Doküman v2.0 ve karşı repodaki `/gizlilik/` bu belgeye uyarlanır.

---

## 1. Yeni kurgu (kullanıcının ağzından, sıra korunarak)

1. İlan oluştururken yapay zekâ **yok**. Kareler çekilir, ilan **yönetici
   onayına** düşer; biz elle bakıp karar veririz.
2. Biz ürünün sıfır fiyatına, hasarına vb. bakıp **her ilana puanı elle**
   belirler ve onaylarız.
3. Onaydan sonra ilan vitrine çıkar.
4. Alıcı ilanı sepete atar; puanı yetiyorsa takası başlatır.
5. Ürün rezerve olur, vitrinden kalkar.
6. Puan **güvenli havuza** çekilir — iyzico değil, kendi iç defterimiz.
7. Satıcıya kargoya vermesi için **4 gün** verilir.
8. Satıcı, sistemdeki alıcı bilgisi ve adresine göre kargolar. Kargo
   entegrasyonu **kapsam dışı.**
9. Satıcı **kendi kargo ücretini** öder.
10. Satıcı sisteme **kargo numarasını** girer → "ürün kargoda".
11. Alıcı kargoyu alır, uygulamada **onay verir.**
12. Havuzdan puanlar satıcıya aktarılır.
13. iyzico yalnızca **puan satın almak** isteyenler için: kredi kartıyla puan
    satışından gelir.

## 2. Alınan kararlar (2026-09-08 görüşmesi)

| Konu | Karar |
|---|---|
| Satıcı 4 günde kargo numarası girmezse | **Otomatik iptal + iade.** Puan alıcıya döner, ilan vitrine çıkar. |
| Alıcı onay vermezse | **Kargo numarası girildikten 7 gün sonra** puan satıcıya kendiliğinden geçer. İtiraz açılırsa sayaç durur. |
| Yapay zekâ | **Tamamen kapanıyor.** Fotoğraf denetimi, değerleme, metin denetimi, avatar denetimi — hiçbiri modele gitmiyor. |
| İtiraz akışı | **Olduğu gibi kalıyor.** Alıcı itiraz açar, kanıt ekler, yönetici karar verir. |
| Kampanya puanı | **Devam ediyor.** İlk 50 kullanıcıya 1000+1000, sonrakilere 300+300. |
| Gelir | **Yalnızca kredi kartlı puan satışından.** Satış **marjlı**: puanın harcama değeri 1 puan = 1 TL kalır, satış fiyatı üstünde. |
| Puan satışının yeri ve yolu | **ERTELENDİ.** Sebep aşağıda (§3). Bu turda satış kurulmaz; kampanya puanıyla test devam eder. |

## 3. Ertelenen karar: puan satışı nerede satılır

Karar verilmeden önce bilinmesi gerekenler yazıya döküldü, çünkü sonradan
değiştirilemez:

- **Mağaza kuralı (IAP).** Uygulama içinde tüketilen dijital bakiye Apple/Google
  kuralına göre **yalnızca onların ödeme sisteminden** satılabilir. Kesinti
  %30 (ilk yıl %15). Uygulama içine iyzico koymak **yasak** — uygulama
  reddedilir ya da kaldırılır. Bugünkü kargo ödemesi fiziksel hizmet olduğu
  için muaftı; puan muaf değil.
- **Web'den satış** iyzico'yu kullanmanın tek yolu (~%3). İki biçimi var:
  **A)** `hesap.eldeneletakas.com` gibi ayrı, girişli bir mini site (uygulamayla
  aynı hesap, e-posta+şifre / Google). Pazarlama sitesinin "veri tabanına
  bağlanılmaz" kuralı bozulmaz, çünkü ayrı proje. Mağaza kuralına tam uyumlu.
  **B)** Uygulamadan tek kullanımlık jetonlu bağlantı, girişsiz. Daha az iş,
  ama Apple'ın Türkiye mağazasında **dış satın almaya yönlendirme yasağı**
  hâlâ geçerli; risk.
- **E-para sorusu** IAP'den bağımsız. Parayla alınıp başkalarının mallarına
  harcanan bakiye 6493 sayılı kanunda ön ödemeli araç tartışmasına girer;
  kapalı devre (TL'ye geri çevrilemez) lehimize ama **hukukçu görüşü şart.**
- Öneri: A. Karar kullanıcıda.

Bu turdaki tasarım satışa **temiz bir yuva** bırakır: `wallet_entries.type`
için `PURCHASE` değeri ve `iyzico-callback`in ödeme doğrulama gövdesi.
Satış eklenince yalnızca o iki yer dolar.

## 4. Mevcut sistemle çakışma haritası

| Bugün | Yeni | Etki |
|---|---|---|
| `photo-check` (Gemini) kareleri denetler; `listing-value` (Gemini) sıfır fiyatı bulur, metni denetler; `avatar-check` (Gemini) avatarı denetler | Hiçbiri çağrılmaz | Üç Edge Function emekli; `ilan_yayina_al` kapısındaki `degerleme_at`, `metin_uygun`, `puan_bandi_disinda` kontrolleri anlamsızlaşır |
| Son kare onaylanınca tetikleyici ilanı **kendisi** yayına alır | İlanı **yönetici** yayına alır | `product_photos_karar_sonrasi` otomatik yayını kalkar |
| Alıcı kargo bedelini iyzico ile öder (₺52 + ₺17,90 + %6), 1 saat içinde ödemezse iptal | Alıcı TL ödemez; satıcı kendi kargosunu öder | `cargo-payment-init`, `payment.tsx`, `fee_settings`, `payment_window`, `my_trade_quote` emekli |
| `POINTS_HELD → SHIPPED` geçişini iyzico callback'i yapar (ödeme alındı = etiket üretildi) | Geçişi **satıcı** yapar: kargo firması + takip numarası girer | Yeni RPC `mark_shipped` |
| `SHIPPED → DELIVERED` kargo entegrasyonuyla gelecekti (hiç gelmedi) | `DELIVERED` kullanılmaz; alıcı onayı `SHIPPED → COMPLETED` | Enum değeri kalır, yol kalkar |
| Satıcının 3 günü var (şubeye bırakma), alıcının teslimden sonra 48 saati | Satıcının **4** günü var (kargo numarası), alıcının kargo numarasından sonra **7** günü | `trade_timings` satırı ve `trades_stamp_timeline` |
| Gelir = alıcının ödediği kargo bedeli − gerçek kargo maliyeti | Gelir = puan satışı marjı (ertelendi) | Ana Doküman 3.1 ücret tablosu geçersiz |

## 5. Tasarım

### 5.1 İlan yaşam döngüsü

```
DRAFT ──(satıcı: Onaya gönder)──► IN_REVIEW ──(yönetici: Onayla + puan)──► ACTIVE
  ▲                                   │
  └────────(yönetici: Reddet + gerekçe)┘
```

- **Yeni durum `IN_REVIEW`.** `products.status` kısıtına eklenir. Bu durumda
  satıcı ilanı düzenleyemez (düzenlemek isterse "Geri çek" → DRAFT); vitrinde
  görünmez; yönetici kuyruğu bu durumu listeler.
- **`submit_listing(p_product_id)`** — satıcı çağırır. Kontroller: sahiplik,
  `DRAFT`, alt kategori var, zorunlu kareler (`required_slots()`) yüklü.
  Yapay zekâ kontrolü yok. `IN_REVIEW`e alır, `submitted_at` damgalar.
- **`withdraw_listing(p_product_id)`** — satıcı `IN_REVIEW`den `DRAFT`a çeker.
- **`admin_review_queue(p_limit)`** — yönetici için: ilan, satıcı, başlık,
  açıklama, kategori/alt kategori, kondisyon beyanı, hasar beyanı, bütün
  kareler (yol), kaç saattir bekliyor. En eski üstte.
- **`admin_approve_listing(p_product_id, p_sifir_fiyat numeric, p_puan_override integer default null, p_cover_slot default 'front', p_not text default null)`**
  - Puan hesabı: `p_sifir_fiyat × puan_orani(kondisyon, hasar)` — **mevcut
    katsayılar ve 50 taban aynen kullanılır**, formül değişmez. Yönetici
    `p_puan_override` verirse o yazılır; her iki durumda `degerleme_kaynak =
    'admin'`, `degerleme_at = now()`, `sifir_fiyat` saklanır.
  - Bütün `pending` kareler `approved` olur (yönetici bakıp onayladı demek).
  - `ilan_yayina_al`ın kapak/ACTIVE/`image_key` kısmı çalışır; yapay zekâ
    kontrolleri kapıdan çıkarılır.
  - Kampanya tetikleyicisi ACTIVE geçişinde **aynen** çalışır.
  - Bildirim: `listing.published` (var). Gerekçe/not varsa gövdeye eklenir.
  - `audit('listing.approve', ...)`.
- **`admin_reject_listing(p_product_id, p_gerekce)`** — gerekçe zorunlu.
  `DRAFT`a döner, `review_reason` yazılır, satıcıya `listing.rejected`
  bildirimi. Kareler **silinmez** — yönetici "arka kare bulanık" dediyse
  satıcı yalnızca onu yeniden çeker. (Bugünkü "reddedilen kare depodan
  silinir" kuralı güvenlik retleri içindi; onlar için yönetici ayrıca kare
  düzeyinde `admin_moderate_photo(false)` kullanabilir, o yol duruyor.)
- **`admin_puan_hesapla(p_sifir_fiyat, p_condition, p_has_damage)`** — panelin
  canlı önizleme için çağırdığı saf hesap; sunucudaki formülün aynısı.
- Mevcut **8 ACTIVE ilan** olduğu gibi kalır (`degerleme_kaynak = 'gemini'`
  tarihsel kayıt). Mevcut **2 DRAFT** satıcı gönderirse yeni yoldan geçer.

### 5.2 Avatar

Yapay zekâ kapandığı için avatar da elle: yüklenen fotoğraf `pending` kalır,
yönetici panelinde "Avatarlar" listesinde görünür, `admin_avatar_karar(uid,
uygun, gerekçe)` sarmalayıcısı mevcut `avatar_karar`ı çağırır. Onaylanmadan
kimse görmez — bu kural zaten depolama politikasında, değişmiyor.

### 5.3 Takas yaşam döngüsü

```
create_trade ──► CREATED ──► POINTS_HELD ──(satıcı: mark_shipped)──► SHIPPED ──(alıcı: confirm_delivery)──► COMPLETED
                              │  4 gün                                  │  7 gün
                              └──► REFUNDED (otomatik)                  └──► COMPLETED (otomatik)
                                                                        └──(alıcı: open_dispute)──► DISPUTED → yönetici
```

- **`create_trade`** değişmez: rezerve + `hold_points` → `POINTS_HELD`.
- **`mark_shipped(p_trade_id, p_kargo_firmasi text, p_takip_no text)`** —
  yalnızca satıcı, yalnızca `POINTS_HELD`. Boş takip numarası reddedilir.
  `trades.kargo_firmasi`, `trades.takip_no`, `shipped_at` yazılır →
  `SHIPPED`. Alıcıya `trade.shipped` bildirimi (var), gövdede firma + numara.
- **`confirm_delivery`** — zaten `SHIPPED`i kabul ediyor; değişmez.
- **`cancel_trade`** — alıcı `POINTS_HELD`de iptal edebilir (kargodan önce);
  içindeki `cargo_payments` kontrolleri kalkar.
- **`trade_timings`**: `payment_window` kolonu kalkar; `dropoff_window` → **4
  gün** (anlamı: "kargo numarası girme süresi"); `confirm_window` → **7 gün**
  (anlamı: "kargo numarasından sonra onay süresi").
- **`trades_stamp_timeline`**: `POINTS_HELD` → `now() + dropoff_window`;
  `SHIPPED` → `now() + confirm_window`; `DELIVERED` dalı kalır ama erişilmez.
- **`expire_stale_trades`**: `POINTS_HELD` süresi dolmuş → `refund_points`
  ("Satıcı ürünü 4 gün içinde kargoya vermedi"); `SHIPPED` süresi dolmuş →
  `release_points`. `cargo_payments` kontrolü kalkar. `CREATED`de takılı
  kalan (hold başarısız olmuş, olamaz ama) → iade.
- **Alıcı bilgisi satıcıya nasıl gider:** `my_trades` satıcı tarafında
  `POINTS_HELD` ve sonrasında alıcının **ad, adres, telefon**unu döndürür
  (alıcının varsayılan adresi; yoksa takas başlatılırken adres seçtirilir —
  `create_trade`'e `p_address_id` eklenir, `trades.address_id` saklanır).
  **Bu yeni bir veri akışı:** alıcının adresi ve telefonu artık satıcıya
  gösteriliyor. Gizlilik sayfası aynı turda güncellenir.
- Mevcut açık takaslar: göç sırasında `CREATED/POINTS_HELD` olanların sayacı
  `now() + 4 gün` yapılır, iki tarafa bildirim gider.

### 5.4 Emekli edilenler

| Ne | Nasıl |
|---|---|
| `photo-check`, `listing-value`, `avatar-check`, `cargo-payment-init` | Repodan silinir, Supabase'den kaldırılır (`config.toml` girdileri de). Yayında duran ama çağrılmayan bir Gemini ucu, anahtarı boşuna taşır. Git geçmişinde dururlar. |
| `iyzico-callback` | **Kalır** ama takasa dokunan kısmı kalkar; ödeme doğrulama gövdesi puan satışı için yuva. |
| `fee_settings`, `cargo_payments`, `my_trade_quote`, `admin_degerleme_ayarla`nın `puan_per_try` dışı parametreleri | Tablolar kalır (geçmiş), RPC'ler `revoke` ile kapatılır. Katsayı ayarı kalır — yönetici formülü değiştirebilmeli. |
| `payment.tsx`, `payment-result.tsx`, `lib/trades.ts › quotePrice` | Silinir; gezinmeden çıkar. |
| `puan_bandi_disinda`, `metin_uygun` kapısı, `ai_suggested_points` | Kapıdan çıkar; kolonlar tarihsel kalır. |
| `product_photos_karar_sonrasi` otomatik yayın | Tetikleyici kalkar. Kare reddi bildirimi (`photo.rejected`) kalır — yönetici kare düzeyinde reddederse satıcı haber alır. |
| `GEMINI_API_KEY` / model env değerleri | Fonksiyonlar kaldırıldıktan sonra Supabase sırlarından silinir. |

### 5.5 Mobil

- **İlan sihirbazı sonu** (`listing-photos.tsx`): "Yayına al" → **"Onaya
  gönder"**. Analiz/değerleme çağrıları kalkar. Başarı mesajı: "İlanın
  incelemeye alındı. Ekibimiz bakıp puanını belirleyecek; onaylanınca
  bildirim göndereceğiz." Kondisyon adımındaki "Puanı sen belirlemiyorsun"
  kutusu kalır, metni "ekibimiz belirliyor" olur.
- **Taslaklar** (`drafts.tsx`): `IN_REVIEW` ilanlar "İncelemede" rozetiyle
  görünür, düzenlenemez, "Geri çek" düğmesi vardır. Reddedilen ilan
  `review_reason`u kırmızı kutuda gösterir.
- **Yönetici paneli** (`admin.tsx`): ilk sekme **"İlanlar"** olur — kuyruk
  kartı: kareler (yatay kaydırma, dokununca büyür), başlık, açıklama,
  kategori, kondisyon, hasar beyanı, satıcı, bekleme süresi. Altında:
  "Sıfır fiyatı (TL)" alanı → canlı "→ N puan" önizlemesi
  (`admin_puan_hesapla`), isteğe bağlı "Puanı elle yaz", "Onayla ve yayınla"
  / "Reddet (gerekçe)". Eski "Kareler" sekmesi **"Avatarlar"** olur. Diğer
  sekmeler (İtiraz, Şikâyet, Hatalar) durur.
- **Takaslar** (`trades.tsx`): ödeme düğmesi kalkar. Satıcı `POINTS_HELD`de
  **alıcının adını, adresini, telefonunu** ve "Kargoya verdim" formunu görür
  (kargo firması seçimi: Yurtiçi, Aras, MNG, PTT, Sürat, HepsiJet, Trendyol
  Express, Kolay Gelsin, Diğer; takip numarası). Alıcı `SHIPPED`de firma +
  numarayı ve "Teslim aldım, onaylıyorum" / "Sorun var" düğmelerini görür.
  Durum metinleri ve sayaç açıklamaları yeni sürelere göre yazılır.
- **Ürün sayfası**: "Takası başlat" onay metni kargo/ücret satırını kaldırır;
  "Satıcı ürünü 4 gün içinde kargoya verir, kargo ücreti satıcıya ait" der.
  Varsayılan adres yoksa adres seçtirir.
- **Bildirimler**: `listing.rejected` (yeni), `trade.shipped` gövdesi.

### 5.6 Site (`Takas-site`)

- `/gizlilik/` **§3** yeniden yazılır: fotoğraflar ve ilan metni **ekibimiz
  tarafından elle** incelenir; üçüncü tarafa gönderilmez; onaylanmadan
  vitrine çıkmaz; reddedilen ilan gerekçesiyle geri döner. Profil fotoğrafı
  aynı şekilde elle. **§4**: Google satırı kalkar; iyzico satırı "şu anda
  kullanılmıyor" değil — satır kalkar, satış açıldığında geri gelir; "Kargo
  firması" satırı → **"Satıcı"**: aldığınız ürünün satıcısına teslimat için
  ad, adres ve telefonunuz gösterilir. Veri tablosuna "teslimat adresi →
  satıcıyla paylaşılır" notu.
- `HowItWorks` adım 2 metni ("değerlendirmeye gönder") doğru kalıyor;
  standartlar metni ("fotoğraflar ile ürün bilgileri birlikte
  değerlendirilir") doğru kalıyor. Değişiklik yok.
- Site `CLAUDE.md`: karşı repo bağı notuna bu tur eklenir.

### 5.7 Dokümanlar

- **Ana Doküman v2.0.** Kaynağı hiçbir repoda yok (docx bir oturumun
  geçici klasöründe üretilmişti). Bu turda kaynak **`docs/ana-dokuman.md`**
  olarak uygulama deposuna girer, docx ondan üretilir. Değişen bölümler:
  1.x denetim (elle), 3.1 ücret (kalkar; gelir = puan satışı, ertelendi),
  4.x takas akışı (4 gün / 7 gün, satıcı kargosu, kargo numarası), 5.x
  itiraz (aynı), 7.x açık kararlar (puan satışı yeri, e-para görüşü).
- **Uygulama `CLAUDE.md`**: "Kritik iş kuralları"nda ters dönen maddeler
  yeniden yazılır ("Gerçek para yalnızca kargo için akar" → kalkar; "Puanlar
  parayla satın alınmaz" → "satın alınacak, yeri kararlaştırılmadı, IAP/e-para
  notu"); "Değerleme", "Denetim: altı engel", "Metin denetimi", "Puan tavanı
  yok", "Bekleyen kare" bölümleri **tarihsel** olarak işaretlenir (silinmez —
  neden vazgeçildiği yazılır); yeni bölüm "Elle onay ve satıcı kargosu
  (2026-09-08)".
- **`TODO.md`**: yapay zekâ ve iyzico-kargo maddeleri kapanır; puan satışı,
  hukukçu görüşü, IAP kararı açılır.

## 6. Sıra (turlar)

Her tur: test → canlıya göç → commit → push → doküman aynı turda.

**Tur 1 — Arka uç.** Tek göç dosyası `20260908…_elle_onay.sql`: `IN_REVIEW`,
`submitted_at`/`review_reason`/`kargo_firmasi`/`takip_no`/`address_id`
kolonları, `submit/withdraw/admin_review_queue/admin_approve/admin_reject/
admin_puan_hesapla/admin_avatar_karar/mark_shipped`, `ilan_yayina_al`
kapısının sadeleşmesi, otomatik yayın tetikleyicisinin kalkması,
`trade_timings` 4g/7g, `trades_stamp_timeline`, `expire_stale_trades`,
`cancel_trade`, `my_trades` alıcı bilgisi, emekli RPC'lerin `revoke`u, açık
takasların sayaç sıfırlaması. Test takımı: bozulan testler (yayın kapısı,
değerleme, zamanlayıcı) güncellenir; yeni testler: gönder/onayla/reddet,
`mark_shipped` yetki ve durum kontrolleri, 4 gün iade, 7 gün aktarım, alıcı
adresinin yalnızca satıcıya ve yalnızca `POINTS_HELD` sonrası görünmesi.

**Tur 2 — Mobil.** §5.5'in tamamı. `tsc` temiz. Ekran görüntüleri.

**Tur 3 — Emeklilik + dokümanlar + site.** Edge Function'lar silinir ve
Supabase'den kaldırılır; sırlar temizlenir; `CLAUDE.md`, `TODO.md`, Ana
Doküman v2.0 (md + docx); site `/gizlilik/` ve `CLAUDE.md`; PR.

Tur 3 mobil dağıtımla **aynı gün** gitmeli: uygulama modeli çağırmayı
bıraktığı an gizlilik sayfası "Google'a gönderilir" derse yanlış beyan olur.

**Sonra (ayrı karar):** puan satışı (§3), hukukçu görüşü, kargo aggregator
(kapsam dışı), push bildirim.

## 7. Riskler ve açık notlar

- **İnceleme yükü insanda.** Her ilan bir insan bekliyor. 6 kullanıcıda
  sorun değil; yüzlerce ilanda kuyruk süresi ürünün kendisi olur. Panelde
  "kaç saattir bekliyor" bu yüzden en görünür alan.
- **Güvenlik süzgeci yok.** Müstehcen kare ya da çocuk yüzü yönetici görene
  kadar depoda durur. Kova özel (`public=false`), onaysız kare kimseye
  görünmez — yani maruz kalan yalnızca yönetici. Ama "hızlı bak" bir
  yönetim disiplini hâline gelir.
- **7 gün kargo teslimi bilinmeden akıyor.** Kargo 8 gün sürerse puan alıcı
  ürünü görmeden satıcıya geçer. Çare: alıcı `SHIPPED` sırasında istediği an
  itiraz açabilir (sayaç durur) — ekranda "ürün gelmediyse süre dolmadan
  'Sorun var'a bas" yazar. 7 gün yetmezse `trade_timings`ten uzatılır,
  kod değişmez.
- **Satıcı kargo parasını ödüyor.** Düşük puanlı ürünlerde satıcı "kargo
  ürünü geçer" diyebilir. Teknik değil, ürün kararı; vitrindeki taban 50
  puan bu yüzden yeniden düşünülebilir.
- **Alıcının adresi satıcıya açılıyor.** Bugüne kadar hiçbir kullanıcı
  başka bir kullanıcının adresini görmüyordu. Gizlilik sayfası bunu
  açıkça söylemeli; ayrıca yalnızca **süren takasın satıcısı**, yalnızca
  **`POINTS_HELD` ve sonrası** görür — RLS değil RPC süzer, çünkü RLS bir
  filtre değil sınırdır (`CLAUDE.md`).
- **Puan satışı olmadan ekonomi kapalı.** Kampanya puanı tek kaynak;
  7000 puanlık ilanı alacak cüzdan yok (2026-08-18 ölçümü). Satış kararı
  gecikirse bu sorun büyür.

## 8. Varsayılan seçtiğim küçük kararlar (itiraz yoksa böyle)

1. Yönetici puanı **sıfır fiyat girip formülle** hesaplatır, isterse elle
   yazar. Formül ve katsayılar değişmez.
2. Reddedilen ilanda kareler **silinmez**; satıcı yalnızca söylenen kareyi
   yeniden çeker.
3. `DELIVERED` durumu kullanılmaz; alıcı onayı doğrudan `COMPLETED`.
4. Kargo firması **sabit listeden + "Diğer"**; takip numarası serbest metin.
5. Mevcut 8 yayındaki ilan **olduğu gibi** kalır; yeniden değerlenmez.
6. Emekli Edge Function'lar **silinir ve kaldırılır**, arşivde tutulmaz.
7. Ana Doküman'ın kaynağı **`docs/ana-dokuman.md`** olur; docx üretilir.
