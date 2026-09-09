# ELDENELE — Ana Doküman

**Sürüm 2.0 · 8 Eylül 2026**

Bu doküman ürün ve iş kararlarının **tek doğruluk kaynağıdır**. İki repo da
(`Takas-WebSite` — uygulama ve arka uç; `Takas-site` — pazarlama sitesi)
buradaki kararları uygular; kod ile bu metin çelişirse bu metin esastır ve
kod düzeltilir. Kod bir kararı değiştirecekse önce burası değişir.

> **Sürüm notu.** 1.x sürümleri bir `.docx` olarak üretilmiş ve hiçbir
> repoda tutulmamıştı; kaynağı kayboldu. 2.0 bu yüzden **ilk kez repoya
> giren** sürüm (`docs/ana-dokuman.md`) ve `.docx` bundan üretiliyor.
> 1.x'ten miras alınan bölümler `CLAUDE.md`, göç dosyaları ve
> `docs/plan-elle-onay-2026-09.md` içindeki kayıtlardan yeniden yazıldı;
> 2.0'da **değişen** kararlar §8'de tablo hâlinde listeleniyor.

---

## 1. Ürün ve ilkeler

### 1.1 Ne yapıyoruz

ELDENELE, kullanılmayan çocuk ürünlerinin (oyuncak, kitap, giyim, bebek
gereçleri, Montessori materyalleri vb.) **Takas Puanı** karşılığında el
değiştirdiği bir pazaryeridir. Satıcı ürününü ilana koyar, ilan onaylanınca
bir puan değeri alır; alıcı o puanı öder, ürünü teslim alır, puan satıcıya
geçer. Hedef pazar Türkiye, arayüz dili Türkçe.

### 1.2 Puan ekonomisi

- **1 puan = 1 TL ikinci el değeri.** Kullanıcı "990 puan" gördüğünde "₺990
  eder" diye okumalı.
- **Puan kapalı devrede paradır.** Basılan puan geri alınamaz; yanlış
  belirlenmiş bir puan, sahte basılmış para gibi davranır. Bu yüzden puanı
  hiçbir zaman istemci seçmez, her zaman sunucu yazar.
- **Güvenli havuz (emanet) puan tutar, para değil.** Alıcının puanı takas
  boyunca kendi çift girişli defterimizde (`wallets` / `wallet_entries`)
  bekler. Hiçbir ödeme kuruluşunun emanet hizmeti kullanılmaz.
- **Puanın kaynağı iki tane:** kampanya puanı (§2.4) ve kredi kartıyla satın
  alma (§3.1 — henüz açılmadı).

### 1.3 Denetim ilkesi: her ilanı ve her profil fotoğrafını bir insan görür

Vitrine çıkan her ilan ve yayınlanan her profil fotoğrafı, yayından önce
**ELDENELE ekibi tarafından elle** incelenir. Bu inceleme için kullanıcı
verisi (fotoğraf, metin) **hiçbir üçüncü tarafa, hiçbir yapay zekâ
hizmetine gönderilmez.**

Bu, 2.0'ın en büyük değişikliği. 16 Ağustos – 8 Eylül 2026 arasında kare
denetimi, metin denetimi, avatar denetimi ve fiyat bulma bir görüntü/dil
modeline (Google Gemini) yaptırıldı. Vazgeçme gerekçeleri:

1. Canlıdaki ilk gerçek kullanımda **sekiz reddin sekizi kadraj yüzündendi**;
   denetimin asıl sebebi (çocuk yüzü, uygunsuz içerik, sahtecilik) bir kez
   bile devreye girmedi. İnsanlar bir fotoğrafçılık sınavına sokuldu.
2. Değerleme, ürünü yanlış tanıdığında puanı yanlış basıyordu ve bu hata
   sınıfı kapalı devrede geri alınamaz.
3. Her yeni alan gizlilik metninde "Google'a gönderilir" cümlesini
   güncellemeyi gerektiriyordu; iki repo ayrı olduğu için bir kez bayatladı.
4. Kullanıcı sayısı (tek haneli) bir insanın bakmasına izin veriyor;
   ölçek geldiğinde karar yeniden ele alınır (§7).

**İnceleme yükü insanda** — bu bilinçli bir bedel. Yönetici panelinde "kaç
saattir bekliyor" bu yüzden en görünür alan.

---

## 2. Kullanıcı ve hesap

### 2.1 Hesap

E-posta + şifre; Google / Apple ile giriş. Kayıtta ad zorunlu (satıcı adı
e-postadan türemesin diye). 18 yaş şartı; uygulama çocuklardan bilerek veri
toplamaz.

### 2.2 Profil ve satıcı adı

Vitrinde ve pazarlama sitesinde ad **kısaltılmış** görünür ("Zeynep D.").
Ad e-postadan türemişse hiç yayınlanmaz, "Üye" yazılır. Konum "İlçe, İl"
biçiminde, listeden seçilir; mahalle ve mesafe hiç yayınlanmaz.

### 2.3 Profil fotoğrafı

İsteğe bağlı; kişinin kendisi olmak zorunda değil. Yükleme anında `pending`
olur, yalnızca sahibine görünür; **yönetici onaylayınca** herkese açılır,
reddedilirse gerekçesiyle geri döner ve dosya silinir. Kullanıcı istediği an
kaldırabilir.

### 2.4 Kampanya puanı (soğuk başlangıç)

Yeni kullanıcıya ilk ilanı **yayına girince** kampanya puanı verilir
(ilan başına 250, kullanıcı başına üst sınır 1000; `campaign_settings`).
Satışta değil yayında — soğuk başlangıcı kıran şey bu sıra. Hak verme
sessizdir: koşul sağlanmazsa hata vermez, yalnızca hak vermez.

### 2.5 Adres defteri

Kullanıcı birden fazla adres kaydeder, düzenler, siler; biri varsayılan.
**T.C. kimlik numarası hiçbir zaman istenmez ve saklanmaz.** Adres, takas
başlarken seçilir ve **o takasın satıcısına** gösterilir (§4.4, §6).

### 2.6 Hesap silme

Uygulama içinden, geri alınamaz. Süren takas ya da rezerve ilan varsa
reddedilir. Profil, avatar, adresler, favoriler, sepet silinir; tamamlanmış
takas, cüzdan ve mesaj kayıtları kimliksizleştirilerek kalır (karşı tarafın
da kaydı). Kalan puan düşer, nakde çevrilmez.

---

## 3. Gelir modeli

### 3.1 Tek gelir: kredi kartıyla puan satışı, marjlı

Kullanıcı puanı kredi kartıyla satın alır. **Harcama değeri sabittir (1 puan
= 1 TL)**, satış fiyatı bunun üstündedir; aradaki marj gelirdir. Ödeme
altyapısı iyzico (sanal POS / Checkout Form). Kart bilgisi uygulamaya hiç
girmez; ödeme sistem tarayıcısında açılır; sonuç yalnızca sunucudaki RETRIEVE
doğrulamasıyla kesinleşir; tutar da doğrulanır; işlem fikirsizdir.

### 3.2 Kargo bedeli alıcıdan alınmaz

Satıcı ürünü **kendi seçtiği kargo firmasıyla, kendi ödeyerek** gönderir.
Platform kargo tahsil etmez, komisyon almaz, kargo firmasıyla entegre
değildir (aggregator kapsam dışı). 1.x'teki "iyzico ile kargo tahsilatı +
komisyon" modeli kalktı (§8).

Bilinen bedel: düşük puanlı üründe satıcı "kargo ürünü geçer" diyebilir. Bu
teknik değil ürün sorunu; taban puan (§4.3) bu yüzden yeniden düşünülebilir.

### 3.3 Açık kararlar (§7'de)

Puan satışının **nereden** yapılacağı ve **e-para lisansı** sorusu
kararlaştırılmadı. Karar verilene kadar satış kapalı, tek puan kaynağı
kampanya.

---

## 4. İlan ve takas akışı

### 4.1 İlan sihirbazı

Altı adım: ad + açıklama · ana kategori · alt kategori · durum · kargo boyutu
· konum. Hiçbir adım önceden seçili gelmez. Dört kondisyon: **Yeni gibi ·
Az kullanılmış · İyi durumda · Hasarlı** — hasar ayrı bir kutu değil,
kondisyonun kendisi; 'Hasarlı' en az 10 karakterlik hasar notu ister.
Kategori ağacı "Kategori ve Filtreleme Matrisi" dokümanından: 9 ana, 62 alt;
her ürün tam olarak birer tanesine ait.

### 4.2 Yedi kare

Kareler **yalnızca kamerayla** çekilir (galeri kapalı — sahteciliğe karşı).
**Dördü zorunlu:** ön, arka, sol, sağ. Etiket isteğe bağlı; hasar karesi
'Hasarlı' seçilmişse, parça karesi ürün setse zorunlu. Tek kaynak veri
tabanındaki `required_slots()`; uygulama onun aynasıdır.

### 4.3 Onay ve puanlama

```
DRAFT ──submit_listing()──▶ IN_REVIEW ──admin_approve_listing()──▶ ACTIVE
  ▲                            │
  └────admin_reject_listing()──┘  (gerekçe + bildirim; kareler silinmez)
  ▲                            │
  └────withdraw_listing()──────┘  (satıcı geri çeker)
```

- Satıcı kareleri çekip **"Onaya gönder"** der ve ekrandan çıkar; sonucu
  bildirimle öğrenir. Onaydaki ilan düzenlenemez, geri çekilebilir.
- Yönetici kareleri, metni ve beyanı inceler; ürünün **sıfır (perakende)
  fiyatını** girer; sunucu puanı formülle hesaplar ve gösterir:
  `puan = sıfır fiyatı × kondisyon oranı`, oranlar **0,74 / 0,65 / 0,57 /
  0,41**, taban **50 puan** (altında kalırsa 50'ye yükseltilir ve ilan bunu
  taşır). Yönetici gerekirse puanı elle yazar. Tavan yok.
- Reddedilen ilan gerekçesiyle taslağa döner; satıcı düzeltir, yeniden
  gönderir. Reddedilen bir **kare** karar anında depodan silinir.
- Hiçbir kod yolu ilanı ya da kareyi kendiliğinden onaylamaz.

### 4.4 Takas

```
ACTIVE ilan ──create_trade(ilan, adres)──▶ POINTS_HELD   (ürün RESERVED, vitrinden gizli,
                                              │            puan emanette, satıcıya adres açılır)
                       4 gün içinde           │ mark_shipped(firma, takip no)
     kargolanmazsa ◀──────────────────────────┤
     REFUNDED (puan alıcıya,                  ▼
     ilan ACTIVE'e döner,                  SHIPPED ──confirm_delivery()──▶ COMPLETED (puan satıcıya)
     adres kopyası silinir)                   │
                                              └── 7 gün içinde onay yoksa ──▶ COMPLETED (otomatik)
                       herhangi bir anda alıcı "Sorun var" ──▶ DISPUTED (sayaç durur, §5)
```

1. **Sepet ve başlatma.** Alıcı sepete ekler; bakiyesi yetiyorsa takası
   başlatır. **Teslimat adresi zorunlu** — defterden seçilir, takasa anlık
   görüntü olarak kopyalanır (defterdeki adres sonradan silinse de gönderi
   adresi kalır).
2. **Rezervasyon ve emanet.** Ürün `RESERVED` olur ve vitrinden gizlenir;
   alıcının puanı iç emanete alınır.
3. **Satıcının 4 günü.** Satıcı alıcının adını, adresini, telefonunu görür;
   ürünü kendi seçtiği firmayla, kendi ödeyerek kargolar; uygulamada
   **kargo firması + takip numarası** girer → `SHIPPED`. 4 gün içinde
   girmezse takas **otomatik iptal**, puan alıcıya iade, ilan tekrar
   yayında, satıcıya bildirim.
4. **Alıcının 7 günü.** Alıcı takip bilgisini görür; ürün gelince
   **"Teslim aldım, onaylıyorum"** → puan satıcıya. 7 gün içinde onaylamaz
   ve itiraz da açmazsa puan **otomatik** satıcıya geçer. Ekranda açıkça
   yazar: "ürün gelmediyse süre dolmadan 'Sorun var'a bas."
5. **Satıcı kendi takasını onaylayamaz** — onaylayabilseydi ürünü
   göndermeden puanı alırdı. Puanı emanetten yalnızca üç şey çıkarır:
   alıcının onayı, süresi dolan sayaç, çözülen itiraz.

Süreler `trade_timings` tablosunda (kod değişmeden ayarlanır):
`dropoff_window = 4 gün`, `confirm_window = 7 gün`.

---

## 5. İade ve uyuşmazlık

### 5.1 İtiraz kapısı

Alıcı `SHIPPED` ve sonrasında, süre dolmadan, "Sorun var" ile itiraz açar.
İtiraz **kanıt ister** (galeriden fotoğraf eklenebilir — galeri iznine tek
istisna profil fotoğrafıyla birlikte budur). Kanıtsız talep otomatik
reddedilir; değerlendirilecek bir şey yoktur.

### 5.2 İnsan karar verir

İtiraza **makine karar vermez**. Yönetici kanıta ve mesajlara bakar; puanı
alıcıya iade eder ya da satıcıya aktarır. Her karar gerekçeyle
`audit_logs`'a yazılır; kayıt değiştirilemez, silinemez.

### 5.3 Sayaç durur, sıfırlanmaz

İtiraz açılınca kalan süre saklanır (`deadline_remaining`); talep
reddedilirse aynen sürer. Sıfırlansaydı art arda açılan asılsız talepler
satıcının puanını süresiz rehin alırdı. Ret, takası itirazdan önceki duruma
(`SHIPPED`) döndürür.

### 5.4 Mesaj şikâyeti ve engelleme

Kullanıcı bir mesajı şikâyet edebilir (moderasyon kuyruğu) ve bir
kullanıcıyı engelleyebilir (iki yönlü, geri alınabilir). Engelleme sohbeti
gizlemez, takası durdurmaz.

### 5.5 Yaptırım merdiveni — kapalı

Uyarı → kısıt → kapatma merdiveni yazılı (`sanction_settings`, eşikler
70/40) ama **kapalı**. Kullanıcı ve güven skoru birikmeden merdiven boşa
çalışır ve ilk dürüst satıcıyı vurabilir. Kurucu onaylamadan açılmaz;
açıldığında kalıcı kapatmayı her zaman insan verir.

---

## 6. Gizlilik ve veri

- Kaynak metin: pazarlama sitesindeki `/gizlilik/` sayfası
  (`Takas-site/public/gizlilik/index.html`). Sayfa siteyi değil
  **uygulamanın işlediği veriyi** anlatır; mağaza formlarına verilen kalıcı
  adres odur. **Uygulamadan dışarı yeni bir veri akışı çıkarsa ya da bir
  akış kalkarsa sayfa aynı turda güncellenir.**
- **Üçüncü tarafa giden veri:** Supabase (veri tabanı, Frankfurt), Vercel
  (site, anonim ölçüm), e-posta sağlayıcısı, yetkili merciler. Hiçbir yapay
  zekâ hizmeti yok. iyzico, puan satışı açıldığında geri gelir.
- **Üyeler arası tek kişisel veri akışı:** alıcının adı, adresi ve telefonu
  → o takasın satıcısına, yalnızca `POINTS_HELD` ve sonrasında, yalnızca
  takas sürerken. Kargolanmamış iptalde adres kopyası silinir. Bunu RLS
  değil RPC süzer — RLS bir sınırdır, filtre değil.
- **Hiç toplanmayan:** telefon konumu, T.C. kimlik numarası, fatura bilgisi,
  mahalle, mesafe.
- **Reddedilen görsel saklanmaz** (kare ve avatar, karar anında silinir).
- Sayfadaki her cümle bir taahhüttür; taahhüdün doğrulaması metni okumakla
  bitmez — sayfadaki bir hak (silme, kaldırma) ara ara **denenir**.

---

## 7. Açık kararlar

| # | Karar | Durum | Not |
|---|---|---|---|
| 7.1 | Puan satışının yeri | **Açık** | (A) giriş gerektiren web mini-sitesi — mağaza komisyonu yok, mağazaların anti-steering kuralına dikkat; (B) uygulama içi IAP — %15–30 komisyon, en az sürtünme; (C) uygulama içi iyzico — dijital ürün için mağaza kuralına aykırı, **seçilemez**. |
| 7.2 | E-para / ödeme kuruluşu lisansı | **Açık** | Puanın parayla alınıp yalnızca platform içinde harcanması 6493 sayılı kanun kapsamına giriyor mu — hukukçu görüşü alınacak. Satış bu görüşten önce açılmaz. |
| 7.3 | Taban puan 50 | Geçerli, yeniden bakılabilir | Satıcı kargoyu kendisi ödediği için düşük puanlı ürünün ekonomisi bozulabilir. |
| 7.4 | 7 günlük onay süresi | Geçerli | Kargo 7 günü aşarsa puan ürün görülmeden geçer; alıcı süre dolmadan itiraz açabilir. Yetmezse `trade_timings`ten uzatılır. |
| 7.5 | Yapay zekâ denetimi | Kapalı | İlan hacmi bir insanın bakamayacağı düzeye gelirse **yardımcı** (engellemeyen, işaretleyen) bir katman olarak yeniden değerlendirilebilir; kararı yine insan verir. |
| 7.6 | Kargo aggregator entegrasyonu | Kapsam dışı | Satıcı kendi gönderiyor; entegrasyon düşünülürse ayrı karar. |
| 7.7 | Push bildirim | Bekliyor | Bildirimler uygulama içi kuyrukta; push altyapısı yok. |
| 7.8 | Yaptırım merdiveni | Kapalı | §5.5. |

---

## 8. 1.x → 2.0: değişen kararlar

| Konu | 1.x | 2.0 |
|---|---|---|
| Kare denetimi | Gemini görüntü modeli, altı engel / üç uyarı | **İnsan**, yönetici panelinde |
| Metin denetimi | `listing-value` içinde model | İnsan, ilan incelemesinin parçası |
| Avatar denetimi | `avatar-check` (Gemini) | İnsan, avatar kuyruğu |
| Fiyat / puan | Model sıfır fiyatı bulur, formül puana çevirir | **Yönetici** sıfır fiyatı girer (ya da puanı elle yazar), formül aynı |
| Yayın | Son kare onaylanınca otomatik | Yönetici onayıyla |
| Kargo bedeli | Alıcı iyzico ile öder (₺52 + ₺17,90 + %6), 1 saat ödeme penceresi | **Alınmaz**; satıcı kendi öder |
| Gelir | Kargo komisyonu | **Puan satışı marjı** (yeri açık) |
| Puan satın alma | "Parayla satın alınmaz, e-para lisansı gerekmez" | Satın alınacak; lisans sorusu açık |
| Kargo gönderimi | Aggregator etiketi (planlanan), teslimat webhook'u | Satıcı firma + takip no girer |
| Satıcı süresi | (48 saat teslimat sonrası onay) | Kargoya verme **4 gün**, dolarsa iptal + iade |
| Alıcı onay süresi | 48 saat | Takip numarasından **7 gün**, dolarsa otomatik aktarım |
| Alıcı adresi | Yalnızca ödeme formunda, kimseye gösterilmez | Takasın satıcısına gösterilir (anlık görüntü) |
| `DELIVERED` durumu | Kullanılıyor | Kullanılmıyor; onay doğrudan `COMPLETED` |
| Adres defteri | "Saklanmaz" (2026-08-16) → açıldı (2026-08-18) | Açık; T.C. kimlik numarası hâlâ yok |
| Google'a giden veri | Kare, metin, avatar | **Hiçbiri** |

Değişmeyenler: puan ölçeği ve katsayılar, taban 50, tavan yok, dört
kondisyon, dört zorunlu kare, kamera zorunluluğu, kampanya puanı kuralı,
itiraz akışı ve sayaç kuralı, yaptırım merdiveninin kapalı olması, kategori
matrisi, kısaltılmış ad ve konum gizliliği, kişisel verinin pazarlama
sitesine çıkma sınırları.
