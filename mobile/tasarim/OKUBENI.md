# Tasarım teslim klasörü

Yeni UI tasarımı, renkler, metinler ve görseller buraya bırakılır. Klasör
**girdi** içindir: buradaki dosyalar uygulamaya doğrudan girmez, ben okuyup
uygularım ve gerçekten kullanılan görseller `mobile/assets/` altına taşınır.

```
mobile/tasarim/
  dokuman/    → tasarım dokümanı, renk paleti, ekran metinleri
  ekranlar/   → UI tasarımları, ekran başına bir dosya
  gorseller/  → yeni fotoğraflar ve grafikler
```

## Nasıl gönderilir

```powershell
cd C:\Users\Dell\takas-website
# dosyaları mobile\tasarim\ altındaki uygun klasörlere kopyala
git add mobile/tasarim
git commit -m "Yeni UI tasarım paketi"
git push origin main
```

Push ettikten sonra haber ver; hepsini okuyup ne anladığımı yazarım. Kod
yazmaya, sen "başla" demeden başlamam.

## Biçim — üç tuzak

**1. WhatsApp'tan geçirme.** WhatsApp görselleri yeniden sıkıştırıyor ve
çözünürlüğü düşürüyor. Marka paketi öyle geldi: elimize 1448×1086 tek sayfa
olarak ulaştı, içindeki amblem 452 piksele düştü ve App Store'un istediği
1024 piksellik simge için yetmedi. Dosyaları e-posta eki, Drive bağlantısı ya
da doğrudan kopyalama ile getir.

**2. Ekran görüntüsü değil, dışa aktarım.** Tasarım aracından "export" ile
çıkan dosya ile ekranın fotoğrafı aynı şey değil. Ölçüleri, renk değerlerini
ve metinleri dışa aktarımdan okuyabiliyorum; ekran görüntüsünden tahmin
etmem gerekiyor.

**3. Figma varsa bağlantı gönder.** Figma dosyasına bağlanıp katman
ölçülerini, renk değişkenlerini ve metinleri doğrudan okuyabiliyorum — PNG'den
okuyamadığım her şeyi. PNG'ye göre çok daha kesin sonuç verir.

## Dosya adları

Ekran tasarımlarını uygulamadaki rotayla eşleşecek şekilde adlandır; hangi
tasarımın hangi ekran olduğunu tahmin etmem gerekmesin:

| Dosya adı | Ekran |
|---|---|
| `anasayfa.png` | Raf / arama |
| `urun-detay.png` | Ürün detayı |
| `sepet.png` | Sepetim |
| `favoriler.png` | Favoriler |
| `hesabim.png` | Profil |
| `urun-ekle.png` | İlan verme |
| `kareler.png` | Fotoğraf çekim akışı |
| `cuzdan.png` · `takaslar.png` · `mesajlar.png` · `sohbet.png` | … |
| `giris.png` · `onboarding.png` | Giriş akışı |

Aynı ekranın birden çok hâli varsa sonuna ek koy: `sepet-bos.png`,
`urun-detay-hasarli.png`. **Boş durumlar önemli** — uygulamadaki ekranların
çoğu veri yokken de görünüyor ve tasarımda karşılığı olmayan boş durumu
kendim uydurmak zorunda kalıyorum.

## Metinler

Ekran metinlerini dokümana yaz, tasarımın içinden okumamı bekleme: PNG'den
okunan Türkçe metinde noktalama ve büyük/küçük harf hatası kaçınılmaz, ve o
metinler uygulamaya birebir giriyor.

## Kapsam — fonksiyona dokunulmuyor

Bu tur **yalnızca görünüm**: renk, tipografi, yerleşim, metin, görsel. Veri
akışı, gezinme, kurallar ve arka uç aynı kalıyor.

İki yerde bu sınır bulanıklaşır ve ikisinde de **sorarım, kendim karar
vermem**:

- Tasarımda bugün var olan bir kontrol **yoksa** — kaldırmak fonksiyon
  değişikliğidir.
- Tasarımda bugün olmayan bir kontrol **varsa** — arkasında bir şey yoksa
  çalışmayan bir düğme olur. Bu turda üç tanesini tam da bu yüzden kaldırdık
  (arama çubuğundaki mikrofon, "Harita", "Tümü" bağlantıları).

## Renk paleti — karar gerektiren nokta

Bugünkü palet marka dokümanının sekiz rengi ve **iki üründe ortak**: sitedeki
`CLAUDE.md` ile mobildeki `theme/tokens.ts` aynı sekizliyi taşıyor, mobil
tonlar OKLCH ile o sekizden hesaplanıyor.

Yeni palet gelince cevabı gereken soru şu: **site de mi değişiyor, yoksa
uygulama siteden ayrılıyor mu?** İkisi de yapılabilir ama ayrılma bilinçli
bir karar olmalı — bugün aynı marka iki yerde aynı görünüyor.

Bir ölçü de önden söyleyeyim: beyaz metin `#008BAA` üzerinde **3.98** kontrast
veriyor, WCAG AA eşiği 4.5. Bu yüzden beyaz metin taşıyan dolu yüzeyler
`#00718A` kullanıyor. Yeni paletteki her renk için aynı ölçümü yapar, eşiğin
altında kalan varsa söylerim.
