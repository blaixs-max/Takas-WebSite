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
 *   - **aynı ürün mü** ve **farklı bir açı mı** — bir önceki onaylı kareyle
 *     karşılaştırarak (2026-08-16, aşağıda)
 *
 * TEMEL KURAL: şüphede kalırsak ONAYLAMAYIZ. Servis erişilemezse ya da yanıt
 * çözümlenemezse kare 'pending' kalır — yayın kapısı 'pending'i geçirmez, ilan
 * insan kuyruğunda bekler. Sessiz otomatik onay yoktur.
 *
 * ## Neden kareler birbiriyle karşılaştırılıyor
 *
 * Yukarıdaki ilk beş kontrol kareye **tek başına** bakıyor ve bu, bize para
 * kaybettiren dolandırıcılığı görmüyordu: satıcı ürünün sağlam yüzünü beş
 * slotun beşine de çekerse, kareler tek tek kusursuz görünür. Hasar arka
 * taraftadır, arka taraf hiç çekilmemiştir, alıcı açar, itiraz eder ve iadeyi
 * havuzdan biz öderiz.
 *
 * Kusur ancak kareler **birbiriyle** kıyaslanınca ortaya çıkıyor. Bu yüzden
 * yeni kare, aynı ilanın en son onaylanmış açı karesiyle birlikte gönderiliyor
 * ve modele iki soru daha soruluyor: aynı ürün mü, farklı bir açı mı.
 *
 * **Zincirleme yeterli.** Her kare yalnızca bir öncekiyle kıyaslanıyor, hepsiyle
 * değil; çünkü beş karenin beşi de aynı yüzse ardışık her çift de aynı olur ve
 * ilkinde yakalanır. Tek görsel yerine iki görsel göndermek, beş görseli birden
 * göndermekten hem ucuz hem daha güvenilir — modeller ikili karşılaştırmada
 * çoklu eşleştirmeden belirgin biçimde iyi.
 *
 * **Yalnızca dört açı slotu kıyaslanıyor** (front/back/left/right). `label`,
 * `damage` ve `parts` tanımı gereği yakın çekim: etiketin makrosu ile ürünün
 * önden görünümü "aynı ürün mü" sorusuna sağlıklı cevap vermez, kıyas orada
 * yanlış ret üretir.
 *
 * ## Reddedilen kare depodan silinir
 *
 * Ret gerekçelerinden biri "kadrajda çocuk yüzü var". Eskiden kare reddedilip
 * kovada kalıyordu: ilan yayına çıkmıyordu ama görsel süresiz duruyordu.
 * KVKK'nın sorduğu şey **saklama**, ve "reddettik" ile "silmedik" farklı iki
 * cümle. Artık ret kararıyla birlikte nesne depodan siliniyor; kare
 * sunucularımızda yalnızca inceleme süresince, saniyeler boyunca bulunuyor.
 *
 * Görselin sunucuya hiç çıkmaması ancak cihazda yüz tanımayla olurdu; o da
 * native modül, yani development build, yani Expo Go'nun sonu. Kalıcı saklamayı
 * kaldırmak, o bedeli ödemeden korumanın büyük kısmını veriyor.
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

/** Kullanıcıya gösterilecek slot adı — ret cümlesinde geçiyor. */
const SLOT_AD: Record<string, string> = {
  front: 'ön',
  back: 'arka',
  left: 'sol yan',
  right: 'sağ yan',
  label: 'etiket',
  damage: 'hasar',
  parts: 'parça',
};

/**
 * Kıyaslanan slotlar: ürünün bütününü farklı açılardan gösteren dördü.
 * Yakın çekim slotları (label/damage/parts) bilerek dışarıda — gerekçesi
 * dosyanın başındaki notta.
 */
const ACILAR = ['front', 'back', 'left', 'right'];

interface Body {
  photoId: string;
}

interface Karar {
  uygun: boolean;
  gerekce: string;
  /** Kıyas yapıldıysa dolu; yapılmadıysa undefined. */
  ayniUrun?: boolean;
  farkliAci?: boolean;
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

  /* Kıyas karesi: aynı ilanın, bu slot dışındaki, en son onaylanmış açı karesi.
     Slotlar ön → arka → sol → sağ sırasıyla çekildiği için bu pratikte "bir
     önceki kare" oluyor; kullanıcı adımlar arasında atlarsa da geçerli bir
     kıyas kalıyor, yalnızca zincirin sırası değişiyor. */
  let referans: { slot: string; storage_path: string } | null = null;
  if (ACILAR.includes(kare.slot)) {
    const { data } = await supabase
      .from('product_photos')
      .select('slot, storage_path')
      .eq('product_id', kare.product_id)
      .eq('moderation_status', 'approved')
      .in('slot', ACILAR)
      .neq('slot', kare.slot)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    referans = data ?? null;
  }

  // Kareleri imzalı bağlantıyla oku: kova özel.
  const yollar = referans ? [kare.storage_path, referans.storage_path] : [kare.storage_path];
  const { data: imzali, error: imzaErr } = await supabase.storage
    .from('listing-photos')
    .createSignedUrls(yollar, 120);

  const baglanti: Record<string, string> = {};
  for (const i of imzali ?? []) if (i.path && i.signedUrl) baglanti[i.path] = i.signedUrl;

  if (imzaErr || !baglanti[kare.storage_path]) {
    console.error('[photo-check] imzalı bağlantı alınamadı', imzaErr?.message);
    return json({ photoId: kare.id, status: 'pending', neden: 'gorsel_okunamadi' });
  }

  /* Referansın bağlantısı üretilemediyse kıyas yapılmaz ama inceleme durmaz:
     tek kare denetimi hâlâ değerli ve kullanıcıyı çözemediğimiz bir sebeple
     bekletmek yanlış olur. */
  const referansUrl = referans ? (baglanti[referans.storage_path] ?? null) : null;

  let karar: Karar | null = null;
  try {
    karar = await incele(
      baglanti[kare.storage_path],
      kare.slot,
      referansUrl,
      referansUrl ? referans!.slot : null,
    );
  } catch (e) {
    console.error('[photo-check] model çağrısı başarısız', String(e));
  }

  // Model yanıt vermediyse ya da yanıtı çözümlenemediyse: 'pending' kalır.
  if (!karar) {
    return json({ photoId: kare.id, status: 'pending', neden: 'model_yanit_vermedi' });
  }

  /* Ret gerekçesini kıyas hatalarında biz yazıyoruz, model değil: bu iki cümle
     satıcıya ne yapacağını söylemeli ve her seferinde aynı olmalı. Modelin
     serbest cümlesi "görseller birbirinden farklı" gibi bir şey olabiliyor —
     doğru ama işe yaramaz. */
  const kiyasHatasi =
    karar.ayniUrun === false
      ? 'Bu kare, ilanın diğer kareleriyle aynı ürünü göstermiyor. Aynı ürünü çektiğinden emin ol.'
      : karar.farkliAci === false
        ? `Bu kareyi bir öncekiyle aynı açıdan çekmişsin. Ürünün ${SLOT_AD[kare.slot]} tarafını çekmen gerekiyor.`
        : null;

  const uygun = karar.uygun && !kiyasHatasi;
  const yeni = uygun ? 'approved' : 'rejected';
  const gerekce = uygun ? null : (kiyasHatasi ?? karar.gerekce);

  /* `.eq('moderation_status','pending')` idempotency koşulu: bu istek karara
     gerçekten kendisi vardıysa satır döner. Silme kararı buna bağlı — başka
     bir çağrı önce davrandıysa nesneyi ikinci kez silmeye çalışmayız. */
  const { data: guncel } = await supabase
    .from('product_photos')
    .update({ moderation_status: yeni, moderation_reason: gerekce })
    .eq('id', kare.id)
    .eq('moderation_status', 'pending')
    .select('id');

  const kararVerildi = Boolean(guncel && guncel.length > 0);

  if (yeni === 'rejected' && kararVerildi) {
    /* Reddedilen görsel depoda tutulmaz — dosyanın başındaki KVKK notu.
       Satır kalıyor: satıcı hangi karenin neden geçmediğini görmeli. */
    const { error: silmeHatasi } = await supabase.storage
      .from('listing-photos')
      .remove([kare.storage_path]);
    if (silmeHatasi) {
      console.error('[photo-check] reddedilen kare silinemedi', kare.storage_path, silmeHatasi.message);
    }
  }

  return json({ photoId: kare.id, status: yeni, gerekce: gerekce ?? '' });
});

/**
 * Görseli (varsa kıyas karesiyle birlikte) modele gönderir ve kararı çözümler.
 *
 * `referansUrl` doluysa istem iki görselli sürüme geçer ve JSON iki alan daha
 * taşır. Şema `responseSchema` ile zorlanıyor: alan eksik gelirse karar
 * çözümlenemez sayılır ve kare 'pending' kalır — yani eksik alan sessizce
 * "sorun yok" diye okunmaz.
 */
async function incele(
  gorselUrl: string,
  slot: string,
  referansUrl: string | null,
  referansSlot: string | null,
): Promise<Karar | null> {
  const gorsel = await gorseliAl(gorselUrl);
  if (!gorsel) return null;

  const referans = referansUrl ? await gorseliAl(referansUrl) : null;
  const kiyas = Boolean(referans && referansSlot);

  const beklenti = SLOT_BEKLENTI[slot] ?? 'ürünün fotoğrafı';

  /* Kullanıcıdan gelen hiçbir metin bu isteme girmiyor; yalnızca görseller ve
     bizim yazdığımız slot beklentisi gidiyor. Prompt injection yüzeyi yok. */
  const denetim = `Şu durumlarda UYGUN DEĞİL de:
- Kadrajda bir çocuğun yüzü görünüyorsa
- Arka planda müstehcen içerik, tanınabilir üçüncü bir kişi veya uygunsuz bir ortam varsa
- Görsel stok/katalog fotoğrafı gibi duruyorsa (gerçek ev çekimi değilse)
- Kare bir ekranın (telefon, bilgisayar, televizyon) ya da basılı bir fotoğrafın fotoğrafıysa — piksel deseni, ekran kenarı, yansıma veya parlaklık dalgalanması varsa
- Ürün bulanık, çok karanlık ya da kadrajda çok küçükse
- Kare beklenen açıyı göstermiyorsa`;

  const istem = kiyas
    ? `Bir ikinci el çocuk ürünü ilanının fotoğraflarını denetliyorsun.

Sana iki görsel verildi:
1. GÖRSEL — bu ilanın daha önce onaylanmış karesi (${SLOT_AD[referansSlot!] ?? referansSlot} açısı). Yalnızca karşılaştırma içindir, denetlenmiyor.
2. GÖRSEL — şimdi denetlediğin yeni kare. Göstermesi gereken: ${beklenti}.

Aşağıdaki denetim YALNIZCA 2. GÖRSEL için geçerlidir.

${denetim}

Ayrıca iki karşılaştırma sorusunu cevapla:
- ayniUrun: iki görselde aynı fiziksel ürün mü var? Açı, mesafe, ışık ve arka plan farklı olabilir; bunlara bakma. Başka bir ürünse false.
- farkliAci: 2. GÖRSEL, 1. GÖRSEL'den anlamlı biçimde farklı bir açıyı mı gösteriyor? Aynı yüzün biraz farklı mesafeden ya da hafif kaydırılmış hâliyse false.

Emin olamadığın yerde ayniUrun için true, farkliAci için true verme — şüphede kalırsan false ver.`
    : `Bir ikinci el çocuk ürünü ilanının fotoğrafını denetliyorsun.
Bu karenin göstermesi gereken: ${beklenti}.

${denetim}`;

  const parts: unknown[] = [];
  if (kiyas) {
    parts.push({ text: '1. GÖRSEL:' });
    parts.push({ inline_data: { mime_type: referans!.mime, data: referans!.b64 } });
    parts.push({ text: '2. GÖRSEL:' });
  }
  parts.push({ inline_data: { mime_type: gorsel.mime, data: gorsel.b64 } });
  parts.push({ text: istem });

  const sema = kiyas
    ? {
        type: 'OBJECT',
        properties: {
          uygun: { type: 'BOOLEAN' },
          gerekce: { type: 'STRING' },
          ayniUrun: { type: 'BOOLEAN' },
          farkliAci: { type: 'BOOLEAN' },
        },
        required: ['uygun', 'gerekce', 'ayniUrun', 'farkliAci'],
      }
    : {
        type: 'OBJECT',
        properties: { uygun: { type: 'BOOLEAN' }, gerekce: { type: 'STRING' } },
        required: ['uygun', 'gerekce'],
      };

  const yanit = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': AI_KEY },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: sema,
        },
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
    if (kiyas && (typeof c?.ayniUrun !== 'boolean' || typeof c?.farkliAci !== 'boolean')) {
      // Kıyas istendi ama cevap gelmedi: onaylamak yerine insana bırakılır.
      return null;
    }
    return {
      uygun: c.uygun,
      gerekce: String(c.gerekce ?? ''),
      ayniUrun: kiyas ? c.ayniUrun : undefined,
      farkliAci: kiyas ? c.farkliAci : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * İmzalı bağlantıdan görseli indirip base64'e çevirir.
 *
 * Baytlar 32 KB'lik parçalarla çevriliyor: `String.fromCharCode(...bytes)` tek
 * seferde çağrıldığında her bayt bir argüman oluyor ve kova sınırı 8 MB olduğu
 * için büyük karelerde çağrı yığını taşıyordu. Küçük fotoğraflarda çalışıp
 * büyüğünde patlayan cinsten bir hataydı.
 */
async function gorseliAl(url: string): Promise<{ mime: string; b64: string } | null> {
  const r = await fetch(url);
  if (!r.ok) return null;
  const bytes = new Uint8Array(await r.arrayBuffer());

  let ham = '';
  const parca = 0x8000;
  for (let i = 0; i < bytes.length; i += parca) {
    ham += String.fromCharCode(...bytes.subarray(i, i + parca));
  }

  return { mime: r.headers.get('content-type') ?? 'image/jpeg', b64: btoa(ham) };
}
