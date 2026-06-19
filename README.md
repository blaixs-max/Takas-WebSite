# KIDS TRADE

Puanlı çocuk ürünü takas pazaryeri — pilot lansman landing page + tıklanabilir prototip.

Sıcak/yeşil marka sisteminde tek dosyalık, çalışan bir prototip:

- **Takas rafı** — filtrelenebilir ürün ızgarası
- **Ürün detayı** — puan, kondisyon, satıcı güveni
- **Güvenli havuz takası** — 4 adımlı escrow akışı
- **Ürününü puana çevir** — AI fotoğraf kontrolü + otomatik puan hesabı
- **Cüzdan** — bakiye + işlem geçmişi

## Çalıştırma

`KIDS TRADE.dc.html` tarayıcıda doğrudan açılır. Statik sunucu için:

```bash
npx serve .
```

`index.html` otomatik olarak prototipe yönlendirir.

## Dosyalar

- `KIDS TRADE.dc.html` — ana tasarım (template + logic)
- `support.js` — çalışma zamanı (gerekli)
- `assets/` — ürün görselleri
- `index.html` — yönlendirme girişi

## GitHub'a yükleme

```bash
git init
git add .
git commit -m "KIDS TRADE prototip"
git branch -M main
git remote add origin <REPO_URL>
git push -u origin main
```
