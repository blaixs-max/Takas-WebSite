/**
 * Marka sabitlerinin tek kaynağı.
 *
 * Ad üç ekranda ayrı ayrı yazılıydı ("KIDS TRADE") ve marka revizyonu siteye
 * uygulandığında burası atlandı; uygulama aylarca eski adı taşıdı. Tek yerden
 * okunursa bir daha ayrışmaz.
 */

/**
 * Kullanıcıya görünen marka adı.
 *
 * Logo tamamen küçük harf, cümle içinde ise site **"Eldenele"** yazıyor
 * ("Eldenele'de bebek ve çocuk ürünleri…", "Eldenele uygulaması"). Uygulama
 * da aynı yazımı kullanıyor; tümü büyük harf yalnızca logonun yerine geçen
 * bir etiket gerektiğinde anlamlı olurdu ve öyle bir yer kalmadı.
 */
export const BRAND = 'Eldenele';

/**
 * Derin bağlantı şeması. `app.json` içindeki `scheme` ile **aynı** olmak
 * zorunda; ayrışırsa OAuth dönüşü ve ödeme dönüşü sessizce uygulamaya
 * ulaşmaz — tarayıcı açık kalır, kullanıcı bekler.
 *
 * Şema eskiden dört ayrı dosyada `'kidstrade'` diye yazılıydı. Marka
 * değiştiğinde dördünü birden bulmak gerekti; bir daha gerekmesin.
 */
export const APP_SCHEME = 'eldenele';

/** Supabase OAuth dönüş adresi. Supabase panelindeki izin listesinde de olmalı. */
export const AUTH_REDIRECT_PATH = 'auth-callback';

/** iyzico ödeme dönüşünün yakalandığı adres. Edge Function da bunu döndürür. */
export const PAYMENT_RETURN_URL = `${APP_SCHEME}://payment-result`;

/**
 * Paylaşım ve davet bağlantılarının gideceği adres.
 *
 * Bilerek ürün derin bağlantısı değil: pazarlama sitesinde `/urun/:id` ya da
 * `/davet/:kod` diye bir yol **yok**, olsaydı bile vitrin örnek veriyle
 * çalışıyor. Eski metin `https://kidstrade.app/urun/...` gönderiyordu — o alan
 * adı bize ait değil ve bağlantı hiçbir zaman açılmadı.
 *
 * Bu yüzden paylaşım metni bağlantıyı "ürünün sayfası" diye değil,
 * "uygulamanın adresi" diye sunuyor; giden bağlantı gerçekten açılıyor.
 *
 * Sitenin altbilgisi `destek@eldenele.com` diyor, yani hedef alan adı
 * eldenele.com. Alan adı siteye bağlandığında ve derin bağlantılar
 * açıldığında burası ve `productUrl` birlikte güncellenir.
 */
export const WEB_URL = 'https://takas-site.vercel.app';

/** Ürün paylaşımının gövdesi. */
export function productShareText(p: { title: string; points: number }): string {
  return `${p.title} — ${p.points} Takas Puanı 🧸\n${BRAND}'de takasta. Uygulamayı indir: ${WEB_URL}`;
}

/** Davet paylaşımının gövdesi. */
export function inviteShareText(code: string): string {
  return `${BRAND}'ye katıl, çocuk ürünlerini puanla takas et! Davet kodum: ${code}\n${WEB_URL}`;
}
