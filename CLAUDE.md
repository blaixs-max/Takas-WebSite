# CLAUDE.md

Bu dosya, Claude Code (ve diğer AI ajanları) için proje bağlamıdır. Yeni bir
oturuma başlarken önce burayı oku.

## Proje
**ELDENELE** — puanlı çocuk ürünü takas pazaryeri. Kullanılmayan oyuncak/kitap/
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
4. **Göç uygulandıysa yetki denetimi.** Yeni bir fonksiyon canlıya çıktıysa
   `anon`'un çağırabildiği fonksiyon sayısı **0** olmalı (sorgu aşağıda).

Dördü de doğrulanmadan push yok; push edilmeden merge yok. Bu sıra kısaltılmaz.

## Alan adı ve e-posta

`eldeneletakas.com` (GoDaddy, 2026-08-14). Site, şifre sıfırlama postası ve
derin bağlantı doğrulaması buna bağlanacak — **henüz hiçbiri bağlanmadı.**

Panel panel ne yapılacağı **`KURULUM.md`** içinde; buraya tekrarlanmıyor.
Kodda alan adı beş yerde geçiyor (`index.html` dört meta + `mobile/lib/brand.ts`
`WEB_URL`) ve hepsi hâlâ `takas-site.vercel.app` — site yeni alan adında
yayına girmeden çevrilmez, yoksa paylaşım bağlantıları kırılır.

## Supabase projesi (gerçek)

| | |
|---|---|
| Proje | **kids-trade** (Supabase proje adı; marka adı değil) |
| Ref | `fauhxnbxwcpsdfcvfodz` |
| URL | `https://fauhxnbxwcpsdfcvfodz.supabase.co` |
| Bölge | eu-central-1 (Frankfurt) · PostgreSQL 17.6 |
| Organizasyon | "Bot" (Pro) |

Anon anahtarı `mobile/eas.json` içindeki üç build profilinde yazılıdır; gizli
değildir, uygulama paketine zaten gömülür. `service_role` anahtarı repoda
**hiçbir yerde bulunmaz** — yalnızca Edge Function ortamında.

**Göçler ve testler yerelde koşturulabilir: `supabase/tests/kosu.sh`.**
Temiz bir veri tabanı kurar, `00_yerel_kurulum.sql` ile Supabase'e özgü şeyleri
(auth/storage/cron şemaları, üç rol, `auth.uid()`, **varsayılan yetkiler**)
taklit eder, bütün göçleri uygular, sonra test paketini koşar. Bugün: 40 göç,
21 test, sıfır hata.

**Betik "hata yok" derken sözdizimini kastediyor, iddiaları değil.** Sayaç
psql'in hata verip vermediğine bakıyor; `BEKLENEN` satırları göz kararı
okunur. Yeni test yazınca çıktısına bir kez bakın — `engelleme_test.sql`
ilk turunda sessizce yanlış bir şey ölçüyordu ve paket yine "temiz" dedi.

**`bileşik_satır IS NOT NULL` "bütün alanlar dolu" demektir.** Postgres'te
`send_message(...) is not null` mesaj gitse bile `f` verir, çünkü dönen
satırdaki `read_at` başlangıçta null. Bir çağrının başarısını satır sayısıyla
doğrulayın, satırın kendisiyle değil — bu bir tur boyunca testi yanlış yere
baktırdı.

**Bunu çalıştırmak zorunlu, çünkü göçler canlıya panelden/MCP'den uygulanıyor
— yani dosyaların kendisi hiç çalıştırılmıyor.** 2026-08-16'da tam olarak bu
yüzden repoda sözdizimi hatalı bir göç dosyası fark edilmeden durdu: veri
tabanı doğruydu, dosya bozuktu. Aynı gün ikinci bir ayrışma daha çıktı —
`expire_stale_trades`'in yayındaki gövdesinde göç dosyasındaki yorumlar yoktu.
`00_yerel_kurulum.sql` varsayılan yetkileri **göçlerden önce** kurar; kurmazsa
`yetki_daraltma` geri alacak bir şey bulamaz ve test üretimden farklı bir
dünyada koşar, yani hiçbir şey kanıtlamaz.

**Göç dosya adları sunucudaki sürümlerle birebir aynıdır.** 2026-08-16'da
hizalandı: repo elle seçilmiş yuvarlak damgalar kullanıyordu, sunucu gerçek
uygulama anını kaydetmişti ve hiçbiri eşleşmiyordu. Yeni bir göç uygulandıktan
sonra dosya adı `schema_migrations`'taki sürümle eşitlenir; **eşleşmezse
`supabase db push` bütün göçleri baştan uygulamaya kalkar.** Bir göçü panelden
ya da MCP'den uygularken yerelde de tek dosya olarak tutun — ikiye bölünmüş
bir uygulama, ikiye bölünmüş bir dosya ister.

**Yayında duran bir cümle, kodda kapatılmamış bir borç bırakamaz.**
`/gizlilik/` "reddedilen kare anında silinir" diyor. Silme çağrısı düştüğünde
kod yalnızca `console.error` yazıyordu: dosya depoda kalıyor, kimse bilmiyor
ve yayındaki cümle sessizce yanlış hâle geliyordu. Artık borç satıra yazılıyor
(`product_photos.deletion_pending_at`) ve her `photo-check` çağrısı en eski
beşini yeniden deniyor. Kimsenin bakmadığı bir günlük satırı, kapatılmamış bir
borçtur — bir vaadi tutan mekanizma, vaadin kendisi kadar görünür olmalı.

**Edge Function'lar repodan otomatik yayına gitmiyor.** `supabase/functions/`
altındaki dosyayı değiştirmek canlıyı değiştirmez; ayrıca deploy edilir ve
`verify_jwt` `config.toml`'daki değeriyle aynı verilir. Yayındaki sürüm
repodakiyle aynı mı, `get_edge_function` ile okunup doğrulanır — commit'in
yeşil olması fonksiyonun güncel olduğu anlamına gelmez.

## Arka uç kuralları (canlıda öğrenildi)

- **Fonksiyon oluşturan her göç, yetki revoke'unu SON adım olarak yazar.**
  PostgreSQL, oluşturduğu her fonksiyonun EXECUTE yetkisini PUBLIC'e verir;
  Supabase ayrıca anon + authenticated'a verir. `alter default privileges`
  bunların yalnızca bir kısmını kapatır — PUBLIC'e verilen yerleşik yetki
  kapanmaz (canlıda iki kez denendi). Tek güvenilir yol açık revoke'tur:

  ```sql
  revoke execute on all functions in schema public from public, anon, authenticated;
  -- ardından yalnızca istemciye açılacaklar tek tek grant edilir
  ```

- **Bir fonksiyon istemciye ancak çağıranını KENDİ doğruluyorsa açılır**
  (`auth.uid()` ya da `is_admin()`). Doğrulamayan fonksiyon iç fonksiyondur;
  yalnızca `service_role` ve tetikleyiciler üzerinden çalışır. Kalıp:
  iç fonksiyon denetimsiz kalır, üstüne ince bir sarmalayıcı yazılır
  (`resolve_dispute` / `admin_resolve_dispute`, `quote_trade_price` /
  `my_trade_quote`).

- **anon'a hiçbir RPC açılmaz.** Giriş yapmamış kullanıcı vitrini tablo SELECT
  politikalarıyla görür; RPC'ye ihtiyacı yoktur.

- **Görünümlerde RLS yoktur.** `public` şemasına eklenen her görünüm
  `security_invoker = on` alır ve istemci rollerinden revoke edilir; yoksa
  altındaki tablonun RLS'ini sessizce aşar.

- **Yerel test Postgres'i yetki katmanını göremez.** PostgREST orada yok;
  `anon`/`authenticated` yetkileri yalnızca canlıda anlam taşır. Göç
  uygulandıktan sonra denetim sorgusu koşulur:

  ```sql
  select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute');
  -- 0 dönmeli
  ```

## Karşı repo

`blaixs-max/Takas-site` — ELDENELE pazarlama sitesi (Vite + React, Vercel).
Veri tabanına bağlanmaz.

**Kategori paritesi.** Kaynak artık bu repo değil, **"ELDENELE · Ürün Mimarisi
— Kategori ve Filtreleme Matrisi"** dokümanıdır (Nihai, 12 Ağustos 2026).
Doküman hem mobil hem web için geçerli; `mobile/data/categories.ts` ve
`src/data/categories.ts` onu aynalar, birbirini değil. Ağaç değişirse önce
doküman, sonra iki dosya birlikte güncellenir — ve arka uçtaki
`product_categories` / `product_sub_categories` tabloları da bir göçle.

## Terimler
**"Mobil"** dendiğinde kastedilen `mobile/` klasöründeki **Expo uygulamasıdır** —
kullanıcının elindeki ekranlar. `supabase/` bundan ayrıdır ve "arka uç" diye anılır.
Bu ayrım her zaman geçerlidir.

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
- Kategoriler: `data/categories.ts` — **9 ana + 62 alt kategori**, ikon
  eşlemeli. Her ürün tam olarak bir ana ve bir alt kategoriye aittir; "Tümü"
  kategori değil, süzgecin kapalı hâlidir. Ürün görselleri `data/productImages.ts`.
- İlan açma iki adımdır: `add-listing` (beyanlar + desi) → `listing-photos`
  (kareler + kontrole gönderme). **Kareler yalnızca kamerayla çekilir** —
  galeriden seçmek 2026-08-14'te kaldırıldı. Bu bir sadeleştirme değil,
  sahteciliğe karşı bir kapı: galeri açıkken satıcı üreticinin stok
  fotoğrafını ya da başka bir ilanın karesini yükleyebiliyordu ve ikinci elde
  alıcının tek dayanağı fotoğraf. Galeri izinleri `app.json`'da duruyor ama
  yalnızca **itiraz kanıtı** için (`app/trades.tsx`) — orada alıcı hasarı
  kutuyu açarken çekmiş olabilir. **Beş kare her ilanda zorunlu**, altıncısı
  hasar beyan edilmişse ve yedincisi ürün setse isteniyor — sayaç bu yüzden
  çoğu ilanda 0/5 diyor. Arayüzde "yedi" yazmak yanlış; tek doğruluk kaynağı
  veri tabanındaki `required_slots()`, `data/photoSlots.ts` onun aynası.

## Kritik iş kuralları (mimariyi belirler)
- **Güvenli havuz = PUAN tutar, gerçek para DEĞİL.** Escrow kendi çift girişli
  defterimizdedir (`wallets` + `wallet_entries`), PSP escrow'u kullanılmaz.
- **Gerçek para yalnızca KARGO için akar.** iyzico **tek üye işyeri** (Pazaryeri/
  alt-üye YOK). Komisyon = alıcı kargo fiyatı − anlaşmalı kargo maliyeti.
- Puanlar **parayla satın alınmaz** → e-para lisansı gerekmez. Kargo fiziksel
  hizmet → App Store/Play **IAP zorunlu değil** (iyzico serbest).
- **İlan `DRAFT` doğar.** Vitrine çıkmanın tek yolu `publish_listing()`; kapı
  zorunlu kareler eksikse ya da bir kare `approved` değilse reddeder. Zorunluluk
  kuralının tek kaynağı `required_slots()`, `data/photoSlots.ts` onun aynasıdır.
- **Puanı havuzdan yalnızca iki şey çıkarır:** alıcının onayı (`confirm_delivery`)
  ya da süresi dolan sayaç (`expire_stale_trades`). Satıcı kendi takasını
  onaylayamaz — onaylayabilseydi ürünü göndermeden puanı alırdı.
- **Kart bilgisi uygulamadan geçmez.** Ödeme `openAuthSessionAsync` ile sistem
  tarayıcısında açılır, uygulama içi WebView'de değil. Tarayıcıdan dönen sonuç
  bilgilendirmedir, kanıt değildir — gerçeği RETRIEVE ile doğrulayan
  `iyzico-callback` belirler.
- **Fatura bilgisi ve T.C. kimlik numarası saklanmaz.** Her ödemede sorulur ve
  yalnızca o istekte iletilir. Saklamaya geçmek bir KVKK kararıdır, kod kararı
  değil — adres tablosu bu karar verilmeden açılmaz.
- **Her açık takasın bir sayacı vardır.** `deadline_at` doluysa takas bir şey
  bekliyordur; kapanınca null olur. Damgaları trigger basar, çağıran yer değil.
- **İtiraz sayacı durdurur, SIFIRLAMAZ.** Kalan süre `deadline_remaining`'e
  yazılır ve talep reddedilirse aynen sürer. Sıfırlansaydı arka arkaya açılan
  asılsız talepler satıcının puanını süresiz rehin alırdı (Ana Doküman 5.4).
- **Tablo yetkisi RLS'in yedeği değil, ikinci kilidi.** Supabase kurulumu
  `grant all on all tables ... to anon, authenticated` yazıyor; bu depoda o
  yüzden `anon` **cüzdan tablosuna bile** yazabiliyordu (yalnızca RLS
  engelliyordu). 2026-08-16'da geri alındı: yazma yetkisi, o rol için yazma
  politikası **bulunmayan** her tablodan kaldırıldı. Aynı mekanik fonksiyon
  tarafını iki kez vurdu (`rpc_grants`, `rpc_grants_final`). Yeni tablo
  eklerken RLS'i açmak yetmez — **yetki matrisi yeniden ölçülür.**
- **`with check` yokluğu bir açık değildir.** PostgreSQL, UPDATE
  politikasında `with check` verilmemişse `using` ifadesini yeni satıra da
  uygular. Aranacak şey eksik `with check` değil, `using`'den **daha gevşek**
  olanı. (Bu doküman bir tur boyunca tersini yazdı.)
- **Oturum jetonu Keychain/Keystore'da, `AsyncStorage`'da değil.**
  `lib/guvenliDepo.ts` supabase-js'in depolama arayüzünü `expo-secure-store`
  üzerinden veriyor. `AsyncStorage` şifresizdi; root'lu ya da jailbreak'li
  cihazda oturum okunabiliyordu. **Düz bir sarmalayıcı yetmez:** SecureStore
  girdi başına 2048 baytla sınırlı ve Supabase oturumu bunu aşıyor, o yüzden
  değer parçalanıyor ve parça sayısı EN SON yazılıyor (yarıda kesilen bir
  yazma yarım oturum bırakmasın). Web'de SecureStore yok, orada
  `AsyncStorage`'a düşülüyor. Eski şifresiz kayıt taşınmıyor, **siliniyor** —
  taşımak, şifresiz kopyayı yerinde bırakmak olurdu.
- **Fatura bilgisi ve T.C. kimlik numarası saklanmayacak — karar verildi**
  (2026-08-16). Her ödemede sorulur, yalnızca o istekte iletilir. `addresses`
  tablosu açılmayacak. Bu artık açık bir soru değil: saklamadığın veri sızmaz
  ve KVKK yükümlülüğü, VERBİS eşiği, ihlal riski birden düşük kalıyor.
- **Yaptırım merdiveni kapalı kalacak — karar verildi** (2026-08-16).
  `sanction_settings.active = false` eksik bir iş değil, bilinçli bir durum:
  kullanıcı ve güven skoru yokken merdiven boşa çalışır ve ilk dürüst
  satıcıyı vurabilir. Eşikler (70/40) yazılı ama onaylanmadı.
- **Yapılandırma eksikse hizmet kapanır, açılmaz.** `send-sms`'in imza
  doğrulaması "sır yoksa geç" diyordu ve o uç `verify_jwt = false` ile
  yayındaydı — NetGSM anahtarları girildiği gün açık bir SMS rölesi olurdu.
  Kural: bir güvenlik kontrolünün yapılandırması eksikse **reddet**. Aynı
  kural moderasyonda zaten uygulanıyor (anahtar yoksa kare `pending` kalır,
  onaylanmaz); ikisi aynı kuralın iki yüzü.
- **Ödemede "başarılı mı" yetmez, "ne kadar" da sorulur.** `iyzico-callback`
  yalnızca `paymentStatus`'e bakıyordu; `paidPrice` artık
  `cargo_payments.amount` ile karşılaştırılıyor. Ayrıca takas **`trade_id`**
  ile anahtarlanır — `conversation_id` iyzico'ya bakan referanstır ve bugün
  aynı değeri taşıması bir tesadüftür, sözleşme değil.
- **Hesap silme geri alınamaz ve üç durumda reddedilir.** `delete_own_account`
  açık takas, rezerve ilan ya da ödenmemiş borç varsa hata veriyor — hesap
  silerek yükümlülükten kurtulmak ya da karşı tarafı ortada bırakmak mümkün
  olmamalı. Bakiye düşüyor ve deftere `CLOSE` hareketi olarak yazılıyor;
  sessizce sıfırlamak çift girişli defteri bozardı. **Kurallar tek yerde,
  sunucuda:** arayüz onları tekrarlamıyor, yalnızca ret gerekçesini çeviriyor.
  Geride kalanlar kasıtlı — `wallet_entries`, `audit_logs`, `trades` ve
  `messages` duruyor (karşı tarafın da kaydı), yalnızca `uuid` kalıyor, ad ve
  e-posta gidiyor.
- **Engelleme ile bildirme farklı şeylerdir, ikisi de gerekli.** Mağaza
  (App Store 1.2) kullanıcı içeriği taşıyan uygulamadan ikisini birden
  istiyor. `report_message` bir moderasyon isteği; `block_user` kullanıcının
  kendi elindeki anında çözüm. Engel **iki yönlü** denetleniyor — tek yönlü
  olsaydı engelleyen kişi engellediğinden mesaj almaya devam ederdi.
  Engelleme sohbeti **gizlemiyor** (geçmiş bir kanıt, itirazda gerekir) ve
  **takası durdurmuyor** (durdursaydı süreç ortada kilitlenirdi).
  Hangi tarafın engellediği kullanıcıya söylenmiyor.
- **Engel kaldırılabilir olmalı — `my_blocks()` bunun için var.** Engelleme
  bir tur boyunca tek yönlü bir kapıydı: sohbetten engelleyebiliyordun ama
  kimi engellediğini görebileceğin bir yer yoktu, dolayısıyla geri
  alamıyordun. Öfkeyle ya da yanlışlıkla basılan düğme kalıcı bir sonuç
  doğuruyordu. `app/engellenenler.tsx` listeyi çiziyor, giriş güvenlik
  ekranında (mesajların altında değil — kullanıcı bunu bir güvenlik ayarı
  olarak arıyor ve sohbetin içinde saklı kalsaydı engeli kaldırmak için önce
  o kişinin sohbetini bulman gerekirdi).

  **Liste ad değil bağlam gösteriyor:** "Suluk ilanının satıcısı". Uygulama
  karşı tarafın adını zaten vermiyor — `my_conversations` alıcıya satıcının
  adını veriyor ama satıcıya alıcı için düz "Alıcı" yazıyor — ve `profiles`
  üzerindeki SELECT ilkesi "yalnızca kendi profilin". İsim basmak, başka
  hiçbir ekranda verilmeyen bir veriyi tek bir yerde vermek olurdu.
  `blocked_id` dönüyor çünkü `unblock_user` onu istiyor; kullanıcı o kişiyi
  zaten kendisi engelledi.
- **Yönetici yetkisi `admins` tablosundadır, JWT'de değil.** Rol iddiası oturum
  yenilenene kadar geçerli olmaz; yetkisi alınan biri elindeki token'la karar
  vermeye devam edemez. Kontrol her zaman sunucudaki `is_admin()` ile yapılır —
  ekranı gizlemek önlem değildir.
- **Yaptırım merdiveni kapalı kuruldu.** `sanction_settings.active = false`.
  Eşikler ürün kararıdır; kurucu onaylamadan açılmaz. Açıldığında uyarı ve
  kısıt otomatik işler, kalıcı kapatmayı her zaman insan verir (Ana Doküman 5.5).
- **Ekranda uydurma sayı olmaz.** Bir değeri gerçekten hesaplayamıyorsak
  göstermeyiz: güven skoru yoksa "—", bildirim yoksa rozet yok. Yer tutucu bir
  sayı, kullanıcının o ekrandaki her sayıya olan güvenini götürür.
- **Bildirim metnini sunucu yazar.** Kayıtları trigger üretir; uygulama yalnızca
  okur ve okundu işaretler. Metin uygulamada kurulsaydı aynı olay iki yerde iki
  farklı cümleyle anlatılırdı. Yeni bir durum eklerken bildirimi de aynı
  migration'da ekleyin.
- **Alt kategorisiz ilan yayına giremez.** `publish_listing()` alt kategoriyi
  karelerden önce denetler. Yalnızca ana kategorisi olan bir ilan vitrine
  çıksaydı ana kategori süzgecinde görünür, her alt kategori süzgecinde
  kaybolurdu: satıcı ilanını yayında sanar, alıcı hiçbir zaman bulamazdı.
  Taslak alt kategorisiz açılabilir — form akışının ortasında zorlamak için
  değil, akışı bölmemek için.
- **Kategori istemciden doğrudan değişmez.** `products_guard_client_update`
  puan/durum/sahip gibi kategoriyi de kilitler; taslakta değişim
  `set_listing_category()` üzerinden, yayındaki ilanda hiç olmaz. Aksi hâlde
  alıcının süzgeçte gördüğü yer ile ürünün yeri ayrışırdı.
- **Kampanya puanı ilan yayına girince doğar, satışta değil.** Soğuk başlangıcı
  kıran şey bu sıra; tersine çevrilirse kilit geri gelir (Ana Doküman 2.4).
  Hak verme sessizdir: koşul sağlanmazsa hata vermez, yalnızca hak vermez —
  kampanya kuralı bir ilanın yayına girmesini engellememelidir.
- **Gerekçesiz karar yoktur.** Kare reddi ve itiraz kararı gerekçe ister;
  gerekçe `audit_logs`'a yazılır ve o kayıt değiştirilemez, silinemez.
- **İtiraza makine karar vermez.** `resolve_dispute` yalnızca `service_role`'da.
  Otomatik olan tek şey kanıtsız talebin reddi — değerlendirilecek bir şey
  olmadığı için. Ürünün ayıplı olup olmadığına her zaman insan karar verir.
- **Moderasyonda şüphe onay değildir.** Yapay zekâ erişilemezse, anahtar yoksa ya
  da yanıt çözümlenemezse kare `pending` kalır — bu "geçti" demek değildir. Hiçbir
  kod yolu kareyi kendiliğinden `approved` yapmaz.
- **Model bir env değeridir, bir karar değil** (2026-08-16). Sağlayıcı Gemini
  API (ücretli katman — ücretsiz katmanda gönderilen içerik ürün geliştirmede
  kullanılabiliyor ve bizim gönderdiğimiz şey **çocuk yüzü içerdiğinden
  şüphelenilen fotoğraflar**; onları bir eğitim havuzuna sokmak, önlemeye
  çalıştığımız zarardan büyük). Beş ayar:

  | Env | Varsayılan | Ne |
  |---|---|---|
  | `AI_VISION_API_KEY` | — | Yoksa hiçbir kare onaylanmaz, insan kuyruğu |
  | `AI_VISION_BASE_URL` | `…/v1beta` | Vertex'e ya da başkasına geçiş tek satır |
  | `AI_VISION_MODEL` | `gemini-3.7-flash` | Ana karar |
  | `AI_VISION_MODEL_STRICT` | boş | İkinci görüş; boşsa mekanizma kapalı |
  | `AI_VISION_SAATLIK_LIMIT` | 60 | Kullanıcı başına çağrı |

  **Neden Flash, Pro değil:** güvenlik açısından kritik olan kısım (kadrajda
  çocuk yüzü var mı) algı işi, muhakeme değil — Pro'nun getirdiği uzun zincirli
  akıl yürütme oraya bir şey katmıyor. Buna karşılık satıcı elinde telefonla
  kararı bekliyor ve ilan başına 7 kare var; Pro'nun gecikmesi doğrudan terk
  sebebi. Hangi modelin yettiği **tahminle değil `admin_foto_denetim_ozeti()`
  ile** kararlaştırılır: ikinci görüşün ne sıklıkta reddi bozduğu, daha güçlü
  modele geçmenin gerekip gerekmediğini sayıyla söyler. Modelde aşağı inmek
  veriyle yapılır, yukarı çıkmak da.
- **İkinci görüş yalnızca reddi bozabilir, onayı değil — ve güvenlik reddini
  hiç bozamaz.** İki hata simetrik değil: kaçırmayı (çocuk yüzünü görmemek)
  çıkarım anında yakalayamazsın, kaçırdığını bilmiyorsun. Ama yanlış reddi
  yakalayabilirsin ve yanlış red dürüst satıcıyı bloke edip arzı öldüren hata.
  Redler azınlıkta olduğu için maliyet küçük kalıyor.
  `GUVENLIK_SEBEPLERI` (`cocuk_yuzu`, `arka_plan`) dışarıda: o kararı ikinci
  bir modele bozdurmak, iki modelden **gevşek olanını** yetkili kılmak olurdu.
  Bu yüzden `sebep` şemada **enum** — serbest cümle olsaydı model "çocuk yüzü"
  ile "bebek yüzü" arasında gider gelir ve güvenlik kontrolü sessizce kaçardı.
- **`verify_jwt` sahiplik doğrulamaz.** `photo-check` bir tur boyunca gelen
  `photoId`'yi sorgusuz işliyordu; `config.toml`'daki not "kareyi yükleyen
  kullanıcı çağırır" diyordu ama JWT yalnızca *birinin* giriş yaptığını
  kanıtlıyor ve fonksiyon `service_role` ile çalıştığı için RLS de devrede
  değil. Yani giriş yapmış herkes başkasının karesini inceletip red gerekçesini
  okuyabiliyordu. Artık çağıran `auth.getUser(jwt)` ile çözülüyor ve karenin
  `products.seller_id`'siyle karşılaştırılıyor. **Yanıt 403 değil 404:**
  "bu kare var ama senin değil" demek, geçerli bir kare kimliğini doğrulamak
  olurdu.
- **Geçici hata ile ret ayrı şeylerdir.** Eskiden `if (!yanit.ok) return null`
  tek satırdı: 429 (hız sınırı) ile gerçek bir ret aynı muamele görüyor, ikisi
  de kareyi insan kuyruğuna atıyordu. Bir saniye sonra çalışacak bir istek
  yüzünden ilan yayına girmemeliydi. Artık 408/429/5xx iki kez, üstel bekleme
  ve `Retry-After`'a uyarak yeniden deneniyor; zaman aşımı da geçici sayılıyor
  (modelin yavaş olduğu an, yanlış olduğu an değil).
- **Kareler birbiriyle kıyaslanır, tek tek değil** (2026-08-16). `photo-check`
  yeni kareyi aynı ilanın **onaylanmış bütün açı kareleriyle** birlikte modele
  gönderir ve iki soru daha sorar: aynı ürün mü, **hiçbiriyle** aynı açı değil
  mi. Sebebi: satıcı ürünün sağlam yüzünü beş slotun beşine de çekerse kareler
  **tek tek kusursuz** görünür, hasar hiç fotoğraflanmaz, iadeyi havuzdan biz
  öderiz. Kıyas yalnızca `front/back/left/right` için yapılır — `label`,
  `damage` ve `parts` tanımı gereği yakın çekim ve "aynı ürün mü" sorusuna
  sağlıklı cevap vermez.
  **"Bir öncekiyle" yetmez, denendi:** ilk sürüm yalnızca son kareyle
  kıyaslıyordu ve A → B → A sırası ardışık her çiftte farklı göründüğü için
  hiçbir yerde takılmıyordu.
- **Kıyas kareleri küçültülerek gönderilir.** Dört tam boy fotoğraf tek isteğe
  sığmaz (kova sınırı kare başına 8 MB, base64 üçte bir daha şişirir).
  Denetlenen kare 1280 piksel, kıyas kareleri 640 — Supabase depolama
  dönüşümüyle. Dönüşüm kapatılabilir bir Pro özelliği olduğu için tam boya
  düşen bir yedek yol ve **8 MB'lık bayt bütçesi** var: bütçe dolarsa kalan
  kıyas kareleri eklenmez. Kıyasın zayıflaması, isteğin patlamasından iyidir.
- **Reddedilen kare depoda tutulmaz.** Ret gerekçelerinden biri "kadrajda çocuk
  yüzü var" ve kare eskiden reddedilip kovada kalıyordu: ilan yayına çıkmıyordu
  ama görsel süresiz duruyordu. KVKK'nın sorduğu şey **saklama** — "reddettik"
  ile "silmedik" farklı iki cümle. Karar anında nesne siliniyor, satır kalıyor
  (satıcı hangi karenin neden geçmediğini görmeli). Görselin sunucuya **hiç**
  çıkmaması ancak cihazda yüz tanımayla olurdu; o da native modül → development
  build → Expo Go'nun sonu.
- **Çekim ekranı kararı bekler.** `uploadPhoto` incelemeyi tetikleyip hemen
  dönmez; sonucu bekler ve reddedilen karede **sonraki slota geçmez**. Eskiden
  "ateşle ve unut"tu ve ret ancak en sonda "Kontrole gönder"de ortaya çıkıyordu:
  beş kareyi bitirdiğini sanan kişi başa dönüyordu. "Bu kareyi öncekiyle aynı
  açıdan çekmişsin" uyarısının işe yaradığı tek an, kullanıcının hâlâ ürünün
  başında olduğu andır.
- **Kıyas ret cümlelerini biz yazarız, model değil.** Modelin serbest cümlesi
  "görseller birbirinden farklı" gibi doğru ama işe yaramaz bir şey olabiliyor.
  Karar modelin, cümle bizim; her seferinde aynı ve ne yapılacağını söylüyor.
- **Arama Türkçe'ye göre normalize edilir** (`lib/arama.ts`). Düz
  `toLowerCase()` **kullanılmaz**: `"İpekyol".toLowerCase()` sonucu `i` +
  birleşen nokta olan iki kod birimi verir, ekranda doğru görünür ama düz
  `ipek` ile eşleşmez. Ayrıca kimse `çocuk`/`ahşap`/`puşet` yazmıyor —
  şapkasız yazan kullanıcı hiçbir şey bulamıyordu. Türkçe harfler **elle**
  indirgeniyor, sonra küçültülüyor; sıra tersine çevrilirse `İ` kurtarılamaz.
  Unicode `normalize('NFD')` tek başına yetmez: `ı` aksanlı bir `i` değil,
  ayrı bir harf.
- **`auth-callback` kimlik bağlantılarının indiği rotadır ve dosyası olmak
  zorundadır.** `AUTH_ROUTES` içinde sayılıyordu ama dosyası yoktu; OAuth
  dönüşü `openAuthSessionAsync` ile uygulama içinde yakalandığı için fark
  edilmemişti. **Şifre sıfırlama bağlantısı doğrudan o rotaya düşüyor.**
  Sıfırlama oradan `/yeni-sifre`'ye devrediyor — kendi rotası olmasının sebebi
  teknik: oturum açıldığı anda kapı `AUTH_ROUTES` içindeki her rotayı
  `/(tabs)`'a atıyor, form orada olsaydı görünür görünmez kaybolurdu.

## Profil ve satıcı adı

**`seller_name` bir kopyadır.** İlan yazıldığı anda `products` satırına
donduruluyor; kart her açılışta profil tablosuna gitmiyor ve eski takasların
kaydı o günkü adı taşıyor. İkisi de doğru.

Ama kullanıcının **kendi** ilanlarındaki kopya, adını değiştirdiğinde
tazelenmezse sonsuza kadar kayar. `update_profile()` bu yüzden profili
yazarken kendi ilanlarının `seller_name`/`seller_initials` alanlarını da
güncelliyor.

**Ad kaydı iki adımdır ve sırası önemli:**

1. `supabase.auth.updateUser({ data: { full_name } })` — GoTrue metadata'sı.
   `create_listing` yeni ilanın adını buradan türetiyor; **tek gerçek kaynak
   burasıdır**. `auth.users` `supabase_auth_admin`'e ait, SQL'den yazılmaz.
2. `update_profile()` RPC — `profiles` satırı (konum, hakkında) + kendi
   ilanlarındaki kopya.

Metadata önce yazılıyor: ikinci adım düşerse yeni ilanlar doğru adı alır,
eskiler eski adı taşır — kısmi ama ilerleyen bir durum. Ters sırada kullanıcı
"kaydettim" görür ve sonraki ilan hâlâ e-postadan türeyen adı taşır.

**Ad boşsa `create_listing` `split_part(email, '@', 1)` kullanıyor.** İlk canlı
ilan pazarlama sitesine "emrahatabek" adıyla düştü — kişinin e-postasının
yarısı, indekslenen bir sayfada. Site tarafı artık böyle bir adı yayınlamıyor
("Üye" yazıyor), ama asıl çözüm profilin dolu olması.

## Güvenlik kuralları (ASLA ihlal etme)
- `service_role` / iyzico `secret key` **asla mobilde** olmaz; yalnızca backend.
- Mobilde yalnızca `EXPO_PUBLIC_SUPABASE_ANON_KEY`. RLS, `auth.uid()` ile korur.
- Puan yazan fonksiyonlar `SECURITY DEFINER` + yalnızca `service_role`'a `grant`.
- iyzico callback'inde gövdeye güvenme; her zaman **RETRIEVE ile doğrula**.

## Görünüm — tasarım paketi ve rehber

Görsel tek doğruluk kaynağı `tasarim/` klasörüdür:

| Ne | Nerede | Neyin kaynağı |
|---|---|---|
| 24 ekran karesi | `tasarim/yeni ekran UI'ları/` | **Ölçü ve yerleşim** |
| Metin ve UX rehberi | `tasarim/Eldenele_App_Metin_ve_UX_Rehberi_Nihai.docx` | **Ekran metinleri** |
| Dört fotoğraf (3840×2160) | `tasarim/photos_4k/` | Karşılama ve vitrin kareleri |

**Ölçü göz kararı alınmaz.** Kareler 739×1600, yani 390×844 ekranın 1.895
katı; bir sayı gerektiğinde kareden okunur. Bu yolla sabitlenenler: sayfa
kenarı 18, kart 172, kartlar arası 10, kart görseli 1.5, ürün detayı hero
1.54, puan hapı 22, CTA 46, arama alanı `#F3EBDD`.

**Punto tasarımın birebir ölçüsü değildir** (kullanıcı kararı, 2026-08-14).
Tasarımın tipografisi 390 pt'lik ekranda küçük kalıyordu; ölçek tasarım ile
bir önceki iri hâlin ortasına çekildi: selamlama 24, bölüm başlığı 18, kart
başlığı 13.5, gövde 13, ikincil 11.5. Yeni ekran bunlara uyar.

**Yazı tipi Nunito DEĞİL.** Bir tur bağlandı ve geri alındı: tasarım kareleri
de pazarlama sitesi de grotesk kullanıyor. Nunito markanın **kelime
logosunun** yüzü — `splash.png` içinde ve sitenin logo SVG'sinde kontur
olarak var, gövde metninde hiçbir yerde yok. Telefonda platformun kendi
grotesk'i (SF Pro / Roboto) zaten tasarımdaki yüz. `@expo-google-fonts/*`
kurulmaz.

**Metin rehberden alınır, biçim tasarımdan.** Rehber alan etiketini
"Ana kategori" diye verir, tasarım onu versal çizer: dize rehberin,
`textTransform` tasarımın. Rehberin "uygulama notu" satırları **kuraldır**,
öneri değil — bugüne kadar uygulananlar: ad yokken "Üye" yazılmaz, ürün
detayında TL değer aralığı gösterilmez, "AI incelemesi" iddia edilmez, sabit
süre sözü yalnızca yürürlükteki operasyon kuralı varsa yazılır, yetkisiz alan
ekranı erişilemeyen şeyin ne olduğunu söylemez.

**Boş durum tek bileşendir** (`components/BosDurum.tsx`). Sekiz ekran onu
çiziyor. Yeni bir boş ekran yazarken kendi kopyanı açma — altı ayrı kopya bir
kez birbirinden ayrıştı ve biri senli biri sizliydi.

**Bağlantı hatası boş durum değildir.** Sunucuya ulaşılamıyorken "hiç mesajın
yok" demek yanlış bilgi; ayrı bir kart ("… yüklenemedi" + "Yeniden dene")
gösterilir.

## Konvansiyonlar
- Tüm kullanıcıya görünen metin **Türkçe**. Kod yorumları Türkçe.
- Renk/ölçü için `mobile/theme/tokens.ts` (M3 tonal palet). Sabit renk yazma.
  Tokenlar tasarım karelerinden **ölçülerek** türetildi. `accent` /
  `accentContainer` paletin moru (`#8B5CF6`) ve düşük opaklıktaki zemini;
  büyük yüzeye sürülmez, tek kullanımı adres ekranındaki gizlilik kartı.
- İkonlar: `@expo/vector-icons/MaterialIcons`.
- Para olmayan model: cüzdan anahtarsızken **DEMO** veriye düşer (kırılmaz).

## Komutlar
```bash
# Mobil
cd mobile && npm install
npx tsc --noEmit                      # tip kontrolü (commit öncesi)
npm start                             # geliştirme (Expo Go) — TÜNEL varsayılan
# npm run start:temiz  → tünel + Metro önbelleği temiz (varlık/env değiştiyse)
# npm run start:yerel  → aynı Wi-Fi (LAN); yalnızca kendi telefonunla hızlı
EXPO_NO_TELEMETRY=1 CI=1 npx expo export --platform web   # derleme doğrulama

# Arka uç testleri (yerel geçici Postgres): migration'ları sırayla uygula,
# sonra supabase/tests/ altındaki takımları koş. Testler sabit kimlikli satır
# ekler — her koşu sıfırdan bir veri tabanıyla başlamalıdır.
psql "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/<takım>_test.sql
```

## Git akışı
- Geliştirme branch'i her turda kullanıcının verdiği daldır (şu an
  `claude/kategori-paritesi`). Burada geliştir, commit, push.
- `main`'e merge yalnızca kullanıcı isteyince (fast-forward tercih).
- Commit mesajları Türkçe + açıklayıcı.

## Çalışma alışkanlığı
- Değişiklik sonrası **`npx tsc --noEmit`** çalıştır; mümkünse web export ile render et.
- Yeni RN ekranı eklerken Hermes'te `Intl`'e güvenme (manuel biçimlendir).
- Mevcut durum ve sıradaki işler için `TODO.md`'ye bak/güncelle.
