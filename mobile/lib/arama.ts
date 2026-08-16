/**
 * Arama metnini karşılaştırılabilir hâle getirir.
 *
 * ## Neden `toLowerCase()` yetmiyor
 *
 * Rafın süzgeci `q.toLowerCase()` ile çalışıyordu ve Türkçe'de bu iki ayrı
 * şekilde bozuluyor:
 *
 * 1. **Noktalı büyük İ.** JavaScript'in `toLowerCase()`'i yerel ayara bakmaz;
 *    `"İpekyol".toLowerCase()` sonucu `i` + birleşen nokta (U+0307) olan iki
 *    kod biriminden oluşan bir dizi verir. Ekranda `ipekyol` gibi görünür ama
 *    kullanıcının yazdığı düz `ipek` ile **eşleşmez**. Kusurun sinsiliği bu:
 *    gözle bakınca doğru duruyor.
 *
 * 2. **Şapkasız yazım.** Kimse arama kutusuna `çocuk`, `ahşap`, `puşet`
 *    yazmıyor; `cocuk`, `ahsap`, `puset` yazıyor. Türkçe klavyeye geçmek
 *    telefonda ayrı bir iş ve arama, kullanıcıyı doğru yazmaya zorlayacak yer
 *    değil.
 *
 * Çözüm iki adımlı: önce Türkçe'ye özgü harfleri **elle** karşılıklarına
 * indiriyoruz (`İ→i`, `I→i`, `ı→i`, `ş→s`, `ğ→g`, `ü→u`, `ö→o`, `ç→c`), sonra
 * `toLowerCase()` çağırıyoruz. Sıra önemli: `toLowerCase()` önce çalışsaydı
 * `İ` yine birleşen noktalı hâline dönerdi ve eşlemeye artık `İ` diye bir şey
 * kalmazdı.
 *
 * Unicode ayrıştırması (`normalize('NFD')` + aksan silme) tek satırda benzer
 * bir iş görürdü ama `ı` ile `i` ayrımını çözmez — `ı` aksanlı bir `i` değil,
 * ayrı bir harf. Bu yüzden eşleme tablosu elle yazılı.
 */
const HARFLER: Record<string, string> = {
  İ: 'i',
  I: 'i',
  ı: 'i',
  Ş: 's',
  ş: 's',
  Ğ: 'g',
  ğ: 'g',
  Ü: 'u',
  ü: 'u',
  Ö: 'o',
  ö: 'o',
  Ç: 'c',
  ç: 'c',
  Â: 'a',
  â: 'a',
  Î: 'i',
  î: 'i',
  Û: 'u',
  û: 'u',
};

export function aramaNormalize(metin: string): string {
  let s = '';
  for (const h of metin) s += HARFLER[h] ?? h;
  return s.toLowerCase().trim();
}

/**
 * Sorgu metnin içinde geçiyor mu.
 *
 * Sorgu boşlukla bölünüyor ve **her parça ayrı ayrı** aranıyor: "ahşap blok"
 * yazan biri, başlığı "Blok seti — ahşap" olan ürünü bulabilmeli. Kelime
 * sırasını dayatmak, aramayı ezberlenmiş bir komut satırına çevirir.
 */
export function aramaEslesir(sorgu: string, alanlar: (string | null | undefined)[]): boolean {
  const parcalar = aramaNormalize(sorgu).split(/\s+/).filter(Boolean);
  if (parcalar.length === 0) return true;
  const havuz = alanlar.filter(Boolean).map((a) => aramaNormalize(a as string));
  return parcalar.every((p) => havuz.some((a) => a.includes(p)));
}
