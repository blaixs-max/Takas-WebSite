# KURULUM — alan adı, site ve e-posta

Bu dosya bir **çalışma talimatıdır**: hangi panelde, hangi menüde, ne yazılacak.
Adımlar sırayla yapılır ve her adımın sonunda bir **doğrulama** vardır — o
doğrulama geçmeden sonraki adıma geçme.

Alan adı: **`eldeneletakas.com`** (GoDaddy'den alındı)
Supabase projesi: `fauhxnbxwcpsdfcvfodz`
Vercel projesi: `takas-site` (takım `blaixs-4009s-projects`)

## Durum — 2026-08-14 ölçümü

| # | Adım | Durum |
|---|---|---|
| 1 | GoDaddy Forwarding kapatıldı | ☐ |
| 2 | Vercel'e alan adı eklendi | ☐ ölçüldü, **eklenmemiş** · kutu açıldı, işaret kaldırılacak |
| 3 | GoDaddy'ye Vercel kayıtları girildi | ☐ ölçüldü, **girilmemiş** |
| 4 | Resend hesabı + alan adı | ☐ |
| 5 | GoDaddy'ye Resend kayıtları girildi | ☐ ölçüldü, **TXT/MX yok** |
| 6 | Supabase SMTP | ☐ panelden bakılmalı |
| 7 | Supabase URL yapılandırması | ☐ panelden bakılmalı |
| 8 | E-posta şablonları Türkçe | ☐ panelden bakılmalı |

Ölçüm şuydu: `eldeneletakas.com` → `13.248.243.5`, `76.223.105.230` (GoDaddy
park sunucuları), MX yok, TXT yok. Vercel projesinin `domains` listesinde
yalnızca üç `vercel.app` adresi var.

---

## 1 · GoDaddy — önce temizlik

**Yol:** godaddy.com → giriş → sağ üst hesap → **Domain Portfolio** →
`eldeneletakas.com` → **DNS** sekmesi

Yapılacak:

1. **Domain Forwarding varsa kapat.** (Aynı sayfada "Forwarding" bölümü.)
   Açık kaldığı sürece sildiğin kayıtları geri yazar — en sinsi hata budur.
2. **`A` · `@`** ve **`CNAME` · `www`** kayıtları listede zaten var (ilki park
   IP'sine, ikincisi alan adının kendisine gidiyor). **Bunları silme** — adım
   3'te Vercel'in değerleriyle **yerinde düzenleyeceğiz.**

> Silmek yerine düzenlemenin sebebi: GoDaddy silinen kayıtları Forwarding veya
> "Website Builder" bağlıysa geri yazıyor, ve arada alan adı bir süre hiçbir
> yeri göstermiyor. Düzenlemede öyle bir boşluk oluşmuyor.

> **GoDaddy'nin Name alanı alan adını kendisi ekler.** `@`, `www`,
> `resend._domainkey` yazacaksın — sonuna `.eldeneletakas.com` **ekleme**,
> yoksa `www.eldeneletakas.com.eldeneletakas.com` olur.

**TTL'i her kayıtta 600 saniye yap.** Varsayılan 1 saat; yanlış yazarsan bir
saat beklersin.

---

## 2 · Vercel — alan adını projeye ekle

**Yol:** vercel.com → takım `blaixs-4009s-projects` → **takas-site** →
**Settings** → **Domains**

1. `eldeneletakas.com` yaz → **Add**
2. `www.eldeneletakas.com` yaz → **Add**
3. Vercel ikisi için de **"Invalid Configuration"** gösterecek ve altında
   girmen gereken DNS kayıtlarını yazacak. **O ekranı açık bırak.**

> **Ekleme kutusundaki "Redirect apex domains to www (recommended)" işaretini
> KALDIR.** İşaretli bırakılırsa Vercel ana adresi `www.eldeneletakas.com`
> yapar ve apex ona yönlenir — istediğimizin tersi.

Ana adres **apex** (`eldeneletakas.com`), `www` ona yönlenir. Sebep: sitede ve
uygulamada beş yerde sabit yazılı bir adres var (`index.html`'deki dört meta
etiketi, `mobile/lib/brand.ts`'teki `WEB_URL`) ve paylaşım kartı da onu taşıyor.
`www` ana adres olsaydı beşi de `www`'lu olmak zorunda kalırdı.

`www`'yu ekledikten sonra satırının sağındaki **Edit** → **Redirect to** →
`eldeneletakas.com` seçilir.

---

## 3 · GoDaddy — Vercel kayıtlarını gir

Mevcut iki kaydın **kalem simgesine** basıp değerlerini değiştir (yeni kayıt
ekleme, eskisini silme). Vercel'in gösterdiği değerleri **birebir** gir.
Tipik olarak:

| Tip | Name | Value | TTL |
|---|---|---|---|
| A | `@` | `76.76.21.21` | 600 |
| CNAME | `www` | `cname.vercel-dns.com` | 600 |

> Vercel bölgeye göre farklı bir IP verebiliyor — **panelde ne yazıyorsa o**,
> buradaki tablo yalnızca neye benzediğini göstermek için.

### Doğrulama

10–30 dakika sonra Vercel'deki Domains ekranında iki adresin de yanında
**yeşil tik** çıkmalı. Tarayıcıda `https://eldeneletakas.com` açıldığında
ELDENELE sitesi gelmeli.

Gelmiyorsa: GoDaddy'de eski `A @` kaydı hâlâ duruyordur ya da Forwarding
yeniden açılmıştır.

---

## 4 · Resend — hesap ve alan adı

**Yol:** resend.com → Sign up (GitHub ile girilebilir)

1. Sol menü **Domains** → **Add Domain**
2. `eldeneletakas.com` yaz
3. Bölge sorarsa **EU (Ireland)** seç — kullanıcılar Türkiye'de, KVKK açısından
   da veri AB'de kalsın.
4. Resend sana **3–4 DNS kaydı** verir. Ekranı açık bırak.

Kayıtlar bölgeye ve hesaba göre değişir; genelde şu dördü olur:

- `MX` · `send` → Amazon SES geri bildirim adresi
- `TXT` · `send` → SPF (`v=spf1 include:amazonses.com ~all`)
- `TXT` · `resend._domainkey` → DKIM (çok uzun bir anahtar)
- `TXT` · `_dmarc` → `v=DMARC1; p=none;`

**Değerleri elle yazma, kopyala-yapıştır yap.** DKIM anahtarı 200+ karakter;
tek harf hatası doğrulamayı düşürür.

---

## 5 · GoDaddy — Resend kayıtlarını gir

Adım 4'teki kayıtları aynı DNS ekranına ekle. Dikkat:

- MX kaydında **Priority** alanı var, Resend'in verdiği sayıyı gir (genelde 10)
- `send` ve `resend._domainkey` alt alan adlarıdır; Name alanına aynen yaz
- `_dmarc` başındaki alt çizgi **gerekli**, silme

### Doğrulama

Resend'deki Domains ekranında **Verified** yazmalı. 10 dakika–birkaç saat
sürebilir; "Verify" düğmesine basarak tekrar denetleyebilirsin.

Doğrulandıktan sonra: **API Keys** → **Create API Key** → adı `supabase-auth`,
yetki **Sending access**. Anahtar `re_` ile başlar ve **bir kez gösterilir** —
kaybedersen yenisini üretirsin, geri okunmaz.

---

## 6 · Supabase — SMTP

**Yol:** supabase.com/dashboard → proje `fauhxnbxwcpsdfcvfodz` →
**Project Settings** → **Authentication** → **SMTP Settings**

**Enable Custom SMTP** aç, sonra:

| Alan | Değer |
|---|---|
| Sender email | `destek@eldeneletakas.com` |
| Sender name | `ELDENELE` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Adım 5'teki `re_…` anahtarı |
| Minimum interval | `60` saniye |

> **Neden `noreply@` değil:** kullanıcı gelen postaya cevap yazdığında hiçbir
> yere gitmeyen bir adres kötü görünür ve destek talebini kaybettirir.
> `destek@` kullanıp GoDaddy'nin **ücretsiz e-posta yönlendirmesiyle** kendi
> kutuna düşür (Domain Portfolio → Email → Forwarding).

---

## 7 · Supabase — URL yapılandırması

**Yol:** Dashboard → **Authentication** → **URL Configuration**

| Alan | Değer |
|---|---|
| Site URL | `https://eldeneletakas.com` |
| Redirect URLs | `eldenele://auth-callback` |

İkincisi olmadan şifre sıfırlama ve Google/Apple girişi **posta gelse bile**
uygulamaya dönmez. `Add URL` ile eklenir, virgülle ayrılmaz.

---

## 8 · Supabase — e-posta şablonları

**Yol:** Dashboard → **Authentication** → **Email Templates**

Dördü de varsayılanda **İngilizce** gelir. Uygulamanın kuralı bütün kullanıcı
metninin Türkçe olması; dördü de çevrilmeli:

- **Confirm signup** — kayıt onayı
- **Reset password** — şifre sıfırlama
- **Magic Link** — kullanılmıyorsa da çevrilsin, ileride açılabilir
- **Change Email Address** — e-posta değişikliği

Şablonlardaki `{{ .ConfirmationURL }}` gibi değişkenlere dokunma; yalnızca
çevresindeki metni yaz.

---

## 9 · Uçtan uca doğrulama

Hepsi bitince:

1. Uygulamada **Giriş yap → Şifremi unuttum** → e-postanı yaz
2. Posta **gelen kutusuna** düşmeli (spam'e değil — düşüyorsa DKIM/SPF eksik)
3. Postadaki bağlantı **uygulamayı açmalı** (tarayıcıda kalıyorsa adım 7 eksik)

---

## 10 · Bundan sonra kodda yapılacaklar

Bunlar bende; adım 3 doğrulandıktan sonra yapılır:

- [ ] `index.html` — dört meta etiketinde `takas-site.vercel.app` →
      `eldeneletakas.com` (canonical, og:url, og:image, twitter:image)
- [ ] `mobile/lib/brand.ts` — `WEB_URL` aynı şekilde
- [x] **`app/auth-callback` ekranı yazıldı** (2026-08-16) — sıfırlama
      bağlantısının indiği rota artık var ve `/yeni-sifre` formuna devrediyor.
      Bu madde alan adını beklemiyordu, o yüzden öne alındı. Yani **adım 9'daki
      uçtan uca doğrulama artık gerçekten yapılabilir**; eksik olan tek şey
      postanın gitmesi.
- [ ] Dokümanlara alan adı işlenecek
