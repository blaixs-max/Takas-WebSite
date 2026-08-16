/**
 * listing-value
 *
 * Bir ilanın **sıfır (perakende) fiyatını** bulur ve değerlemeyi yazar.
 *
 * Akış: onaylanmış kareler + başlık + kategori + durum → Gemini (Google Search
 * grounding) → "bu ürün nedir, Türkiye'de sıfırı kaç lira" → `degerleme_yaz`.
 *
 * ## Puanı bu fonksiyon hesaplamıyor
 *
 * Model yalnızca **fiyatı** söylüyor. Fiyattan puana çeviren formül veri
 * tabanında (`puan_hesapla`), katsayıları `valuation_settings` tablosunda.
 * Ayrımın sebebi: ekonominin katsayıları modelin içine gömülürse bir oranı
 * değiştirmek istem yazmaya dönüşür, deterministik olmaz ve denetlenemez.
 * Model fiyatı söyler, ekonomiyi biz yönetiriz.
 *
 * ## Bulamazsa uydurmuyor
 *
 * `bulundu: false` dönebiliyor ve o zaman fiyat `null` gidiyor; `puan_hesapla`
 * null döndürüyor, yayın kapısı ilanı geçirmiyor, ilan insan kuyruğunda
 * kalıyor. Bir varsayılan fiyat koysaydık tanınamayan her ürün sessizce
 * yanlış puanla rafa çıkardı — ve kapalı devrede yanlış puan, basılmış para.
 *
 * ## Neden ayrı bir fonksiyon, photo-check'in içinde değil
 *
 * `photo-check` kare kare çalışıyor ve her karede bir karar veriyor.
 * Değerleme ise ilanın **bütününe** bakmak zorunda: dört açı birlikte
 * görülmeden ürün tanınmıyor. Ayrıca değerleme ilan başına bir kez çalışması
 * gereken, arama kotası tüketen bir iş; kare başına çalıştırmak dört katı
 * maliyet ve dört farklı fiyat demekti.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const AI_KEY = Deno.env.get('AI_VISION_API_KEY') ?? '';
const AI_BASE =
  Deno.env.get('AI_VISION_BASE_URL') ?? 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Değerleme modeli ayrı bir env'de.
 *
 * `photo-check` ile aynı model olmak zorunda değil: orada iş algı (kadrajda
 * yüz var mı), burada iş arama ve muhakeme (bu hangi ürün, sıfırı kaç lira).
 * İkisini tek değişkene bağlamak, birini iyileştirmek istediğimizde öbürünü
 * de değiştirmeye zorlardı.
 */
const AI_MODEL = Deno.env.get('AI_VALUE_MODEL') ?? Deno.env.get('AI_VISION_MODEL') ?? 'gemini-3.7-flash';
const AI_TIMEOUT_MS = Number(Deno.env.get('AI_VALUE_TIMEOUT_MS') ?? 40_000);

/** Kıyaslanan açı slotları — ürünün bütününü gösterenler. */
const ACILAR = ['front', 'back', 'left', 'right'];
/** Ham bayt bütçesi; `photo-check` ile aynı gerekçe. */
const BUTCE = 8 * 1024 * 1024;

interface Body {
  productId: string;
}

interface Deger {
  bulundu: boolean;
  urun: string;
  sifirFiyatTry: number | null;
  kaynak: string;
  guven: number;
  hasarSiddeti: number | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let b: Body;
  try {
    b = await req.json();
  } catch {
    return json({ error: 'Geçersiz JSON' }, 400);
  }
  if (!b.productId) return json({ error: 'productId gerekli' }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  /* Sahiplik doğrulaması — `photo-check`teki ile aynı gerekçe: `verify_jwt`
     yalnızca birinin giriş yaptığını kanıtlıyor, bu ilanın sahibi olduğunu
     değil, ve fonksiyon service_role ile çalıştığı için RLS devrede değil. */
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const { data: oturum } = await supabase.auth.getUser(jwt);
  const kullanici = oturum?.user;
  if (!kullanici) return json({ error: 'Oturum bulunamadı' }, 401);

  const { data: urun, error: urunHata } = await supabase
    .from('products')
    .select('id, title, category, sub_category, condition, has_damage, description, seller_id, degerleme_at')
    .eq('id', b.productId)
    .single();

  if (urunHata || !urun) return json({ error: 'İlan bulunamadı' }, 404);
  if (urun.seller_id !== kullanici.id) return json({ error: 'İlan bulunamadı' }, 404);

  /* İdempotency: bir ilan bir kez değerlenir. Arama kotası tüketen bir iş,
     ekran her açıldığında yeniden koşmamalı — ve iki koşu iki farklı fiyat
     verebilir, yani puan ekran tazelendikçe değişirdi. */
  if (urun.degerleme_at) {
    return json({ productId: urun.id, tekrar: true });
  }

  if (!AI_KEY) {
    console.warn('[listing-value] AI_VISION_API_KEY yok — değerleme yapılamıyor');
    return json({ productId: urun.id, bulundu: false, neden: 'ai_yapilandirilmadi' });
  }

  const { data: kareler } = await supabase
    .from('product_photos')
    .select('slot, storage_path')
    .eq('product_id', urun.id)
    .eq('moderation_status', 'approved')
    .in('slot', ACILAR);

  if (!kareler || kareler.length === 0) {
    return json({ productId: urun.id, bulundu: false, neden: 'onayli_kare_yok' });
  }

  const gorseller: { mime: string; b64: string }[] = [];
  let toplam = 0;
  for (const k of kareler) {
    const g = await kareyiGetir(supabase, k.storage_path, 768);
    if (!g) continue;
    if (toplam + g.bayt > BUTCE) break;
    toplam += g.bayt;
    gorseller.push({ mime: g.mime, b64: g.b64 });
  }
  if (gorseller.length === 0) {
    return json({ productId: urun.id, bulundu: false, neden: 'gorsel_okunamadi' });
  }

  let deger: Deger | null = null;
  try {
    deger = await degerle(urun, gorseller);
  } catch (e) {
    console.error('[listing-value] model çağrısı başarısız', String(e));
  }

  if (!deger) {
    return json({ productId: urun.id, bulundu: false, neden: 'model_yanit_vermedi' });
  }

  /* Bulunamadıysa fiyat null gidiyor. `degerleme_yaz` yine çağrılıyor ki
     `degerleme_at` damgalansın — yoksa ekran sonsuza kadar "değerleniyor"
     der ve kullanıcı neyi beklediğini bilmez. Puan null kalıyor, yayın
     kapısı geçirmiyor, ilan insana düşüyor. */
  const fiyat = deger.bulundu ? deger.sifirFiyatTry : null;

  const { data: guncel, error: yazHata } = await supabase.rpc('degerleme_yaz', {
    p_product_id: urun.id,
    p_sifir_fiyat: fiyat,
    p_kaynak: deger.bulundu ? `${deger.urun} · ${deger.kaynak}` : 'bulunamadı',
    p_guven: deger.guven,
    p_model: AI_MODEL,
    p_hasar_siddeti: deger.hasarSiddeti ?? 1.0,
  });

  if (yazHata) {
    console.error('[listing-value] değerleme yazılamadı', yazHata.message);
    return json({ error: 'Değerleme kaydedilemedi' }, 500);
  }

  const satir = Array.isArray(guncel) ? guncel[0] : guncel;
  return json({
    productId: urun.id,
    bulundu: deger.bulundu,
    urun: deger.urun,
    sifirFiyat: fiyat,
    puan: satir?.points ?? null,
    guven: deger.guven,
  });
});

/**
 * Modele kareleri ve beyanı verip sıfır fiyatını sorar.
 *
 * `googleSearch` aracı açık: model kendi hafızasından fiyat uyduramasın,
 * arayıp bulsun. Fiyatlar hızla değişiyor ve modelin eğitim anındaki fiyatı
 * bugünün fiyatı değil — grounding olmadan bu fonksiyon "eski fiyat üreteci"
 * olurdu.
 *
 * `responseSchema` **kullanılmıyor**: Gemini'de arama aracı ile yapısal çıktı
 * aynı istekte birleşmiyor. Onun yerine JSON şeması isteme metnine yazılıyor
 * ve yanıt elle ayrıştırılıyor; ayrıştırılamayan yanıt `null` dönüyor, yani
 * kare 'değerlenmedi' kalıyor. Sessiz varsayılan yok.
 */
async function degerle(
  urun: Record<string, unknown>,
  gorseller: { mime: string; b64: string }[],
): Promise<Deger | null> {
  const parts: unknown[] = [];
  for (const g of gorseller) {
    parts.push({ inline_data: { mime_type: g.mime, data: g.b64 } });
  }

  const beyan = [
    `Başlık: ${urun.title}`,
    `Kategori: ${urun.category}${urun.sub_category ? ' / ' + urun.sub_category : ''}`,
    `Satıcının beyan ettiği durum: ${urun.condition}`,
    urun.has_damage ? 'Satıcı ÜRÜNDE HASAR OLDUĞUNU beyan etti.' : 'Satıcı hasar beyan etmedi.',
    urun.description ? `Açıklama: ${urun.description}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  parts.push({
    text: `Yukarıdaki fotoğraflar ikinci el bir çocuk ürününe ait. Satıcının beyanı:

${beyan}

Görevin: bu ürünün **Türkiye'de bugünkü SIFIR (perakende) satış fiyatını** bulmak.
Google araması yap. İkinci el fiyatı değil, sıfır fiyatı arıyorsun.

Kurallar:
- Ürünü fotoğraflardan tanı. Marka ve model görünüyorsa aramada kullan.
- Birden çok fiyat bulursan **tipik olanı** ver, en ucuzu ya da en pahalıyı değil.
- Türkiye'de satılmıyorsa ve yalnızca yurt dışı fiyatı bulduysan, güncel kurla
  ₺'ye çevirip ver ve bunu kaynakta belirt.
- **Ürünü tanıyamazsan ya da güvenilir bir fiyat bulamazsan \`bulundu: false\` ver
  ve tahmin etme.** Yanlış bir fiyat, fiyat olmamasından çok daha kötü.
- Fotoğraflarda satıcının beyan etmediği bir hasar görüyorsan \`hasarSiddeti\`ni
  ona göre ver.

Yalnızca şu JSON'u döndür, başka hiçbir şey yazma:
{
  "bulundu": true|false,
  "urun": "tanıdığın ürünün adı (marka + model)",
  "sifirFiyatTry": sayı (₺, sıfır fiyatı) veya null,
  "kaynak": "fiyatı aldığın site ya da kısa açıklama",
  "guven": 0 ile 1 arası sayı,
  "hasarSiddeti": 0 ile 1 arası sayı veya null (0 = hasarsız, 1 = ağır hasar)
}`,
  });

  const kesici = new AbortController();
  const sayac = setTimeout(() => kesici.abort(), AI_TIMEOUT_MS);
  let yanit: Response;
  try {
    yanit = await fetch(`${AI_BASE}/models/${AI_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': AI_KEY },
      body: JSON.stringify({
        contents: [{ parts }],
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature: 0 },
      }),
      signal: kesici.signal,
    });
  } finally {
    clearTimeout(sayac);
  }

  if (!yanit.ok) {
    console.error('[listing-value] model reddetti', yanit.status, await yanit.text().catch(() => ''));
    return null;
  }

  const govde = await yanit.json();
  const metin: string | undefined = govde?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? '')
    .join('');
  if (!metin) return null;

  /* Arama aracı açıkken model JSON'u düz metnin içine gömebiliyor; ilk süslü
     paranteze kadar olan kısım atılıyor. */
  const bas = metin.indexOf('{');
  const son = metin.lastIndexOf('}');
  if (bas === -1 || son <= bas) return null;

  try {
    const c = JSON.parse(metin.slice(bas, son + 1));
    if (typeof c?.bulundu !== 'boolean') return null;
    const fiyat = Number(c.sifirFiyatTry);
    return {
      bulundu: c.bulundu === true && Number.isFinite(fiyat) && fiyat > 0,
      urun: String(c.urun ?? '').slice(0, 200),
      sifirFiyatTry: Number.isFinite(fiyat) && fiyat > 0 ? fiyat : null,
      kaynak: String(c.kaynak ?? '').slice(0, 500),
      guven: Math.max(0, Math.min(1, Number(c.guven) || 0)),
      hasarSiddeti:
        c.hasarSiddeti === null || c.hasarSiddeti === undefined
          ? null
          : Math.max(0, Math.min(1, Number(c.hasarSiddeti) || 0)),
    };
  } catch {
    return null;
  }
}

/** Kareyi küçültülmüş indirir; `photo-check`teki ile aynı yol ve gerekçe. */
async function kareyiGetir(
  supabase: ReturnType<typeof createClient>,
  path: string,
  genislik: number,
): Promise<{ mime: string; b64: string; bayt: number } | null> {
  const { data: kucuk } = await supabase.storage
    .from('listing-photos')
    .createSignedUrl(path, 120, {
      transform: { width: genislik, height: genislik, resize: 'contain' },
    });

  if (kucuk?.signedUrl) {
    const g = await gorseliAl(kucuk.signedUrl);
    if (g) return g;
  }
  const { data: tam } = await supabase.storage.from('listing-photos').createSignedUrl(path, 120);
  return tam?.signedUrl ? await gorseliAl(tam.signedUrl) : null;
}

async function gorseliAl(url: string): Promise<{ mime: string; b64: string; bayt: number } | null> {
  const r = await fetch(url);
  if (!r.ok) return null;
  const bytes = new Uint8Array(await r.arrayBuffer());

  /* 32 KB'lik parçalar: `String.fromCharCode(...bytes)` tek seferde
     çağrıldığında büyük karelerde çağrı yığını taşıyor. */
  let ham = '';
  const parca = 0x8000;
  for (let i = 0; i < bytes.length; i += parca) {
    ham += String.fromCharCode(...bytes.subarray(i, i + parca));
  }

  return { mime: r.headers.get('content-type') ?? 'image/jpeg', b64: btoa(ham), bayt: bytes.length };
}
