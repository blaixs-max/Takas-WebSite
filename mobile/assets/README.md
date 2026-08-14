# Marka varlıkları

## Kaynak

Elimizdeki tek kaynak `brand/marka-paketi-sayfasi.jpg` — marka paketinin yedi
bölümlük tek sayfalık dökümü, **1448×1086**, WhatsApp üzerinden geldiği için
yeniden sıkıştırılmış progresif JPEG.

`brand/amblem.png`, o sayfanın 1. bölümündeki ana amblemin ayıklanmış hâli:
**400×452**, saydam zeminli. Zemin küresel bir "beyaz → saydam" ile değil,
kenardan taşkın doldurma ile silindi; öyle olmasaydı ayının burnundaki,
biberondaki ve tulumdaki beyazlar da delinirdi. Paneller arasındaki açık gri
ayraç çizgileri de temizlendi.

## Çözünürlük sınırı — nerede yeter, nerede yetmez

Amblemin en büyük kopyası 452 piksel. Hedeflerin gerektirdiği ölçüler:

| Hedef | Gereken | Amblem kaynağı | Durum |
|---|---|---|---|
| iOS ana ekran simgesi (60 pt @3x) | 180 | 452 | küçültme — net |
| Android başlatıcı (48 dp @xxxhdpi) | 192 | 452 | küçültme — net |
| Açılış ekranında amblem (150 pt @3x) | 450 | 452 | birebir |
| Google Play mağaza simgesi | 512 | 452 | 1.13× — sınırda, kabul edilebilir |
| **App Store pazarlama simgesi** | **1024** | **452** | **2.3× — yetmez** |

`app/icon.png` 1024×1024 üretiliyor çünkü Expo öyle istiyor, ama içindeki
amblem 452'den büyütülmüş. Cihazda hiç görünmez (orada 180 piksele iniyor);
**yalnızca App Store liste görselinde** yumuşak çıkar. Mağazaya çıkmadan önce
amblemin vektör ya da ≥1024 piksel özgün dosyası alınmalı — bu tek eksik.

Küçük boylarda ayrı bir sorun var: amblem sekiz ayrı eşya taşıyor ve 48
pikselde bunlar okunmuyor. Marka sayfasının 5. bölümü bunun için zaten
**kompakt işaret**i ("e" + kıvılcımlar) veriyor. Bildirim simgesi gerektiğinde
oradan üretilecek, amblem küçültülerek değil.

## Üretilen dosyalar

| Dosya | Ölçü | Zemin | Not |
|---|---|---|---|
| `app/icon.png` | 1024² | beyaz | Marka sayfası 5. bölüm, birinci seçenek. Köşeleri işletim sistemi maskeler. |
| `app/adaptive-icon.png` | 1024² | saydam | Amblem 640 px — güvenli dairenin (676) içinde. Zemin `app.json`'da beyaz. |
| `app/splash.png` | 1024² | saydam | Amblem + kelime logosu + slogan. Zemin `app.json`'da `#faf7f2`. |
| `app/favicon.png` | 256² | beyaz | Expo web. |

Uyarlanabilir simgenin zemini eskiden `#008BAA` idi; amblemin kendi turkuaz
kolu o zeminde kayboluyordu. Beyaza alındı.

`brand/amblem.png` koda doğrudan girmiyor — yukarıdaki dördünün kaynağı. Kod
tarafında `components/brand/AcilisEkrani.tsx` `app/splash.png`'nin kendisini
çiziyor.

## Yeniden üretim

Amblem ya da kilit değişirse dördü birlikte yenilenir. Tarif:

1. Amblemi saydam zeminli PNG olarak ayıkla (kenardan taşkın doldurma; küresel
   beyaz silme **değil**).
2. Dördünü de tarayıcıda çiz ve ekran görüntüsü al — böylece kelime logosu
   sitedeki `eldenele-logo.svg` konturlarından, slogan da Nunito 800'den
   geliyor. Nunito'nun bir kopyası, gövdesine gömülü olarak
   `eldenele-kilit.svg` içinde duruyor.
3. Ölçüler yukarıdaki tabloda. Uyarlanabilir simgede amblem 640 pikseli
   geçmemeli.
4. `AcilisEkrani` `splash.png`'yi olduğu gibi çizdiği için ayrıca elle
   güncellenecek bir yerleşim yok.

Slogan **bilerek** görselin içine pişirilmiş, uygulamada metin olarak
yazılmıyor: uygulama Nunito'yu yüklemiyor, metin olsaydı yerel açılış
ekranındakinden farklı bir yüzle çizilirdi.

## Açılış ekranı üç katman

Karıştırılması kolay olduğu için: açılışta arka arkaya üç ayrı şey çıkıyor ve
üçü ayrı yerden besleniyor.

1. **Expo Go'nun yükleme ekranı** — `app.json`'daki `icon` + `name`.
   `splash.png`'yi *hiç* kullanmaz. Expo Go'da gördüğün ilk kare budur.
2. **Yerel açılış ekranı** — `splash.png`. Yalnızca kendi derlemende
   (dev-client / mağaza derlemesi) çıkar.
3. **`components/brand/AcilisEkrani.tsx`** — paket yüklendikten sonra oturum
   çözülene kadar. Her iki ortamda da çıkar, slogan burada da var.

Üçünün zemini aynı olmalı; ayrışırsa geçişte zemin sıçraması görünür.

## Palet — `#00B8AA` değil `#008BAA`

Marka sayfasının 6. bölümü ana turkuazı **`#00B8AA`** yazıyor. Kullandığımız
değer **`#008BAA`**: web sitesinin paleti, `theme/tokens.ts` ve marka
dokümanının 6. bölümü bu değeri taşıyor ve site yayında bu renkle duruyor.

Bu bilinen ve **karara bağlanmış** bir fark: palet `#008BAA` kalıyor, sayfadaki
değer takip edilmiyor. `amblem.png` sayfadan kırpıldığı için amblemin içindeki
turkuaz hâlâ `#00B8AA`'ya yakın; ikisi yan yana durduğunda göze çarpmıyor,
ama amblem yeniden çizilirse `#008BAA`'ya çekilir.

## Slogan

"Paylaş, değiştir, mutlu et!" **yalnızca açılış ekranında**. Kaynağı
`lib/brand.ts` içindeki `SLOGAN`. Marka sayfasının 3. bölümündeki kilit ayrıca
bir alt yazı taşıyor ("Bebek ve çocuk ürünlerinde akıllı takas."); o bilerek
alınmadı — istenen slogandı ve iki satır üst üste açılış ekranını kalabalık
yapıyor.

## Ürün ve karşılama fotoğrafları

`products/` altındaki dosyaların **dördü tasarım paketinden** geliyor
(`tasarim/photos_4k/`, 3840×2160 PNG). Kaynaklar 16:9; uygulamada
kullanıldıkları yerin oranı farklı olduğu için oraya göre kırpıldılar.
`resizeMode="cover"` zaten kırpardı ama kadrajı gözetmeden, ortadan.

| Dosya | Kırpma oranı | Çıktı | Nerede |
|---|---|---|---|
| `onboarding-aile.jpg` | 1.234 | 1200×973 | Karşılama sanat alanı (tasarımda tam genişlik, 316 pt) |
| `urun-montessori-set.jpg` | 1.5 | 1400×933 | `blocks` ilanının kapağı |
| `urun-puset.jpg` | 1.5 | 1400×933 | `puset` ilanı |
| `urun-kitap-seti.jpg` | 1.5 | 1400×933 | `kitaplar` ilanı |

JPEG kalite 82, 129–236 KB. Uzun kenar 1400: kart en fazla 172 pt × 3 = 516
piksel istiyor, 1400 tam ekran görüntüleyiciye de yetiyor.

Yeniden üretmek gerekirse ölçüler yukarıdaki tabloda; kırpma **ortadan
hizalı**, önce orana göre kesilip sonra ölçekleniyor.
