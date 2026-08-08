/**
 * photo-check
 *
 * Bir ilan karesini yapay zekâya inceletir ve sonucu product_photos'a yazar.
 *
 * Kontroller (Ana Doküman 4.4):
 *   - kadrajda çocuk yüzü var mı
 *   - arka plan uygun mu (müstehcen, tanınabilir üçüncü kişi, uygunsuz ortam)
 *   - görsel internetten alınmış gibi mi duruyor (stok/ürün fotoğrafı)
 *   - kare istenen açıyı gösteriyor mu (ön kare için ön, etiket için etiket)
 *   - okunabilir mi (bulanık, çok karanlık, ürün kadrajı doldurmuyor)
 *
 * TEMEL KURAL: şüphede kalırsak ONAYLAMAYIZ. Servis erişilemezse ya da yanıt
 * çözümlenemezse kare 'pending' kalır — yayın kapısı 'pending'i geçirmez, ilan
 * insan kuyruğunda bekler. Sessiz otomatik onay yoktur.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const AI_KEY = Deno.env.get('AI_VISION_API_KEY') ?? '';
const AI_MODEL = Deno.env.get('AI_VISION_MODEL') ?? 'gemini-2.5-flash';

/** Her slotun modele anlatılması gereken beklentisi. */
const SLOT_BEKLENTI: Record<string, string> = {
  front: 'ürünün önden görünümü, ürün kadrajı dolduruyor',
  back: 'ürünün arkadan görünümü',
  left: 'ürünün sol yandan profili',
  right: 'ürünün sağ yandan profili',
  label: 'ürün etiketi, CE işareti veya marka/model yazısı okunabilir hâlde',
  damage: 'beyan edilen kusurun yakın çekimi',
  parts: 'setin tüm parçaları bir arada görünüyor',
};

interface Body {
  photoId: string;
}

interface Karar {
  uygun: boolean;
  gerekce: string;
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
  if (!b.photoId) return json({ error: 'photoId gerekli' }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: kare, error: kareErr } = await supabase
    .from('product_photos')
    .select('id, product_id, slot, storage_path, moderation_status')
    .eq('id', b.photoId)
    .single();

  if (kareErr || !kare) return json({ error: 'Kare bulunamadı' }, 404);
  if (kare.moderation_status !== 'pending') {
    // İdempotency: aynı kare iki kez incelenmez.
    return json({ photoId: kare.id, status: kare.moderation_status, tekrar: true });
  }

  // Anahtar yoksa kareyi ONAYLAMAYIZ. 'pending' kalır ve ilan insana kuyruklanır.
  if (!AI_KEY) {
    console.warn('[photo-check] AI_VISION_API_KEY yok — kare insan kuyruğunda bekliyor');
    return json({ photoId: kare.id, status: 'pending', neden: 'ai_yapilandirilmadi' });
  }

  // Kareyi imzalı bağlantıyla oku: kova özel.
  const { data: imzali, error: imzaErr } = await supabase.storage
    .from('listing-photos')
    .createSignedUrl(kare.storage_path, 120);

  if (imzaErr || !imzali?.signedUrl) {
    console.error('[photo-check] imzalı bağlantı alınamadı', imzaErr?.message);
    return json({ photoId: kare.id, status: 'pending', neden: 'gorsel_okunamadi' });
  }

  let karar: Karar | null = null;
  try {
    karar = await incele(imzali.signedUrl, kare.slot);
  } catch (e) {
    console.error('[photo-check] model çağrısı başarısız', String(e));
  }

  // Model yanıt vermediyse ya da yanıtı çözümlenemediyse: 'pending' kalır.
  if (!karar) {
    return json({ photoId: kare.id, status: 'pending', neden: 'model_yanit_vermedi' });
  }

  const yeni = karar.uygun ? 'approved' : 'rejected';
  await supabase
    .from('product_photos')
    .update({ moderation_status: yeni, moderation_reason: karar.uygun ? null : karar.gerekce })
    .eq('id', kare.id)
    .eq('moderation_status', 'pending');

  return json({ photoId: kare.id, status: yeni, gerekce: karar.gerekce });
});

/** Görseli modele gönderir ve kararı çözümler. */
async function incele(gorselUrl: string, slot: string): Promise<Karar | null> {
  const gorsel = await fetch(gorselUrl);
  if (!gorsel.ok) return null;
  const bytes = new Uint8Array(await gorsel.arrayBuffer());
  const b64 = btoa(String.fromCharCode(...bytes));
  const mime = gorsel.headers.get('content-type') ?? 'image/jpeg';

  const beklenti = SLOT_BEKLENTI[slot] ?? 'ürünün fotoğrafı';

  /* Kullanıcıdan gelen hiçbir metin bu isteme girmiyor; yalnızca görsel ve
     bizim yazdığımız slot beklentisi gidiyor. Prompt injection yüzeyi yok. */
  const istem = `Bir ikinci el çocuk ürünü ilanının fotoğrafını denetliyorsun.
Bu karenin göstermesi gereken: ${beklenti}.

Şu durumlarda UYGUN DEĞİL de:
- Kadrajda bir çocuğun yüzü görünüyorsa
- Arka planda müstehcen içerik, tanınabilir üçüncü bir kişi veya uygunsuz bir ortam varsa
- Görsel stok/katalog fotoğrafı gibi duruyorsa (gerçek ev çekimi değilse)
- Ürün bulanık, çok karanlık ya da kadrajda çok küçükse
- Kare beklenen açıyı göstermiyorsa

Yalnızca şu JSON'u döndür, başka hiçbir şey yazma:
{"uygun": true|false, "gerekce": "tek cümle Türkçe"}`;

  const yanit = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': AI_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: mime, data: b64 } }, { text: istem }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    },
  );

  if (!yanit.ok) return null;
  const govde = await yanit.json();
  const metin: string | undefined = govde?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!metin) return null;

  try {
    const c = JSON.parse(metin.replace(/```json|```/g, '').trim());
    if (typeof c?.uygun !== 'boolean') return null;
    return { uygun: c.uygun, gerekce: String(c.gerekce ?? '') };
  } catch {
    return null;
  }
}
