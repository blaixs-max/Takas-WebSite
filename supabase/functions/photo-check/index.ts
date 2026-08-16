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
 *   - **aynı ürün mü** ve **farklı bir açı mı** — o ilanın onaylanmış diğer
 *     açı kareleriyle karşılaştırarak (2026-08-16, aşağıda)
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
 * yeni kare, aynı ilanın onaylanmış açı kareleriyle birlikte gönderiliyor ve
 * modele iki soru daha soruluyor: aynı ürün mü, farklı bir açı mı.
 *
 * **Bir öncekiyle değil, hepsiyle.** İlk sürüm yalnızca en son onaylanmış
 * kareyle kıyaslıyordu ve bunun bir açığı vardı: satıcı A yüzü → B yüzü →
 * A yüzü sırasıyla çekerse **ardışık her çift farklı görünür** ve zincir
 * hiçbir yerde takılmaz. Artık yeni kare, o ilanın onaylanmış bütün açı
 * kareleriyle birlikte gönderiliyor ve soru "öncekinden farklı mı" değil,
 * "**hiçbiriyle** aynı değil mi" biçiminde soruluyor.
 *
 * **Yalnızca dört açı slotu kıyaslanıyor** (front/back/left/right). `label`,
 * `damage` ve `parts` tanımı gereği yakın çekim: etiketin makrosu ile ürünün
 * önden görünümü "aynı ürün mü" sorusuna sağlıklı cevap vermez, kıyas orada
 * yanlış ret üretir. Yani en fazla üç kıyas karesi oluyor.
 *
 * ## Görseller küçültülerek gönderiliyor
 *
 * Dört tam boy fotoğraf modele sığmaz: kova sınırı kare başına 8 MB, base64
 * bunu üçte bir daha şişiriyor. Kareler Supabase'in **depolama dönüşümüyle**
 * küçültülüyor — denetlenen kare 1280 piksel (bulanıklık ve etiket okunurluğu
 * için ayrıntı gerekiyor), kıyas kareleri 640 (orada tek soru "aynı şey mi").
 *
 * Dönüşüm Pro planın özelliği ve kapanabilir; kapalıysa ya da başarısız olursa
 * kare **tam boy** indiriliyor. O yüzden bir de **bayt bütçesi** var: toplam
 * ham veri 8 MB'ı geçerse kalan kıyas kareleri eklenmiyor ve durum log'a
 * yazılıyor. Yani kötü durumda kıyas zayıflar, istek patlamaz.
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

/** İndirilmiş kare. `bayt` ham boyut — bütçe onun üzerinden tutuluyor. */
interface Gorsel {
  mime: string;
  b64: string;
  bayt: number;
}

/** Modele kıyas için gönderilen, daha önce onaylanmış kare. */
interface Kiyas {
  slot: string;
  mime: string;
  b64: string;
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

  /* Kıyas kareleri: aynı ilanın, bu slot dışındaki, onaylanmış bütün açı
     kareleri. En yeniden eskiye — bütçe dolarsa düşecek olan, en eski kare. */
  let referanslar: { slot: string; storage_path: string }[] = [];
  if (ACILAR.includes(kare.slot)) {
    const { data } = await supabase
      .from('product_photos')
      .select('slot, storage_path')
      .eq('product_id', kare.product_id)
      .eq('moderation_status', 'approved')
      .in('slot', ACILAR)
      .neq('slot', kare.slot)
      .order('created_at', { ascending: false });
    referanslar = data ?? [];
  }

  const ana = await kareyiGetir(supabase, kare.storage_path, 1280);
  if (!ana) {
    console.error('[photo-check] kare okunamadı', kare.storage_path);
    return json({ photoId: kare.id, status: 'pending', neden: 'gorsel_okunamadi' });
  }

  /* Ham bayt bütçesi. Dönüşüm çalışıyorsa üç kıyas karesi rahat sığar;
     çalışmıyorsa bir ya da ikisi sığar ve gerisi düşer. Kıyasın zayıflaması,
     isteğin patlamasından iyidir. */
  const BUTCE = 8 * 1024 * 1024;
  let toplam = ana.bayt;
  const kiyasKareler: Kiyas[] = [];

  for (const r of referanslar) {
    const g = await kareyiGetir(supabase, r.storage_path, 640);
    /* Bağlantısı üretilemeyen kıyas karesi inceleme durdurmaz: tek kare
       denetimi hâlâ değerli ve kullanıcıyı çözemediğimiz bir sebeple
       bekletmek yanlış olur. */
    if (!g) continue;
    if (toplam + g.bayt > BUTCE) {
      console.warn('[photo-check] bayt bütçesi doldu, kıyas karesi atlandı', r.slot);
      break;
    }
    toplam += g.bayt;
    kiyasKareler.push({ slot: r.slot, mime: g.mime, b64: g.b64 });
  }

  let karar: Karar | null = null;
  try {
    karar = await incele(ana, kare.slot, kiyasKareler);
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
        ? `Bu kareyi daha önce çektiğin bir kareyle aynı açıdan çekmişsin. Ürünün ${SLOT_AD[kare.slot]} tarafını çekmen gerekiyor.`
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
    await kareyiSil(supabase, kare.id, kare.storage_path);
  }

  /* Geçmiş turlarda silinemeyen kareler burada yeniden deneniyor. Sonucu
     beklenmiyor: kullanıcının kendi karesinin kararı, başkasının silme
     borcunun arkasında kuyruğa girmemeli. */
  void silmeBorcunuBosalt(supabase);

  return json({ photoId: kare.id, status: yeni, gerekce: gerekce ?? '' });
});

/**
 * Kareyi depodan siler; olmazsa borcu satıra kaydeder.
 *
 * Eskiden başarısızlık yalnızca `console.error`'a yazılıyordu — yani dosya
 * depoda süresiz kalıyor, kimse bilmiyor ve `/gizlilik/` sayfasında **yayında
 * duran** "reddedilen kare anında silinir" cümlesi sessizce yanlış hâle
 * geliyordu. Kimsenin bakmadığı bir günlük satırı, kapatılmamış bir borçtur.
 */
async function kareyiSil(
  supabase: ReturnType<typeof createClient>,
  photoId: string,
  path: string,
): Promise<boolean> {
  const { error } = await supabase.storage.from('listing-photos').remove([path]);
  if (error) {
    console.error('[photo-check] reddedilen kare silinemedi', path, error.message);
    await supabase.rpc('silme_borcu_ac', { p_photo_id: photoId });
    return false;
  }
  await supabase.rpc('silme_borcu_kapat', { p_photo_id: photoId });
  return true;
}

/**
 * Bekleyen silme borçlarından birkaçını kapatmayı dener.
 *
 * Her `photo-check` çağrısında koşuyor, yani silme oranı yükleme trafiğiyle
 * ölçekleniyor — borcun oluştuğu an da tam olarak o. Zamana bağlı bir
 * süpürücü (pg_cron + pg_net ile bu fonksiyona POST) bilerek kurulmadı:
 * veri tabanına yeni bir sır sokardı ve yükleme dururken yeni borç da
 * oluşmuyor. Birikme olursa `admin_silme_borcu_sayisi()` bunu görünür kılar.
 *
 * Beşer beşer: bir isteği geciktirmeyecek kadar az, birikmeyi eritecek kadar
 * çok. Hata yutuluyor — bu yol kullanıcının isteğinin sonucunu etkilemez.
 */
async function silmeBorcunuBosalt(supabase: ReturnType<typeof createClient>): Promise<void> {
  try {
    const { data, error } = await supabase.rpc('silme_borcu_al', { p_adet: 5 });
    if (error || !Array.isArray(data) || data.length === 0) return;
    for (const b of data as { photo_id: string; storage_path: string }[]) {
      await kareyiSil(supabase, b.photo_id, b.storage_path);
    }
  } catch (e) {
    console.error('[photo-check] silme borcu boşaltılamadı', e);
  }
}

/**
 * Kareyi (varsa kıyas kareleriyle birlikte) modele gönderir ve kararı çözümler.
 *
 * Kıyas karesi varsa istem çok görselli sürüme geçer ve JSON iki alan daha
 * taşır. Şema `responseSchema` ile zorlanıyor: alan eksik gelirse karar
 * çözümlenemez sayılır ve kare 'pending' kalır — yani eksik alan sessizce
 * "sorun yok" diye okunmaz.
 */
async function incele(gorsel: Gorsel, slot: string, kiyasKareler: Kiyas[]): Promise<Karar | null> {
  const kiyas = kiyasKareler.length > 0;
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

Sana bu ilanın daha önce onaylanmış ${kiyasKareler.length} karesi (ÖNCEKİ KARE olarak
işaretli, açıları: ${kiyasKareler.map((k) => SLOT_AD[k.slot] ?? k.slot).join(', ')}) ve
ardından denetlenecek YENİ KARE verildi. Önceki kareler yalnızca karşılaştırma
içindir, denetlenmiyor.

YENİ KARE'nin göstermesi gereken: ${beklenti}.

Aşağıdaki denetim YALNIZCA YENİ KARE için geçerlidir.

${denetim}

Ayrıca iki karşılaştırma sorusunu cevapla:
- ayniUrun: YENİ KARE'deki ürün, önceki karelerdeki ürünle aynı fiziksel ürün mü? Açı, mesafe, ışık ve arka plan farklı olabilir; bunlara bakma. Başka bir ürünse false.
- farkliAci: YENİ KARE, önceki karelerin HİÇBİRİYLE aynı açıyı göstermiyor mu? Önceki karelerden herhangi biriyle aynı yüzü gösteriyorsa — sadece biraz farklı mesafeden ya da hafif kaydırılmış çekilmişse bile — false ver.

Emin olamadığın yerde true verme; şüphede kalırsan false ver.`
    : `Bir ikinci el çocuk ürünü ilanının fotoğrafını denetliyorsun.
Bu karenin göstermesi gereken: ${beklenti}.

${denetim}`;

  const parts: unknown[] = [];
  for (const k of kiyasKareler) {
    parts.push({ text: `ÖNCEKİ KARE (${SLOT_AD[k.slot] ?? k.slot}):` });
    parts.push({ inline_data: { mime_type: k.mime, data: k.b64 } });
  }
  if (kiyas) parts.push({ text: 'YENİ KARE:' });
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
 * Depodaki kareyi küçültülmüş hâliyle indirir.
 *
 * Önce Supabase'in **depolama dönüşümü** deneniyor (`transform`): kare en
 * uzun kenarı `genislik` piksel olacak şekilde ölçekleniyor. Bu bir hız
 * iyileştirmesi değil, sığdırma meselesi — dört tam boy fotoğraf tek isteğe
 * sığmaz.
 *
 * Dönüşüm Pro planın özelliği ve proje ayarından kapatılabiliyor. Kapalıysa
 * imzalı bağlantı üretilse bile indirme başarısız olur; o durumda kare **tam
 * boy** indiriliyor. Sessiz bir bozulma değil, ölçülü bir geri düşüş: çağıran
 * yer bayt sayısına bakıp bütçeyi aşan kıyas karesini zaten atıyor.
 */
async function kareyiGetir(
  supabase: ReturnType<typeof createClient>,
  path: string,
  genislik: number,
): Promise<Gorsel | null> {
  const { data: kucuk } = await supabase.storage
    .from('listing-photos')
    .createSignedUrl(path, 120, {
      transform: { width: genislik, height: genislik, resize: 'contain' },
    });

  if (kucuk?.signedUrl) {
    const g = await gorseliAl(kucuk.signedUrl);
    if (g) return g;
    console.warn('[photo-check] dönüşümlü indirme başarısız, tam boya düşülüyor', path);
  }

  const { data: tam } = await supabase.storage.from('listing-photos').createSignedUrl(path, 120);
  return tam?.signedUrl ? await gorseliAl(tam.signedUrl) : null;
}

/**
 * İmzalı bağlantıdan görseli indirip base64'e çevirir.
 *
 * Baytlar 32 KB'lik parçalarla çevriliyor: `String.fromCharCode(...bytes)` tek
 * seferde çağrıldığında her bayt bir argüman oluyor ve kova sınırı 8 MB olduğu
 * için büyük karelerde çağrı yığını taşıyordu. Küçük fotoğraflarda çalışıp
 * büyüğünde patlayan cinsten bir hataydı.
 */
async function gorseliAl(url: string): Promise<Gorsel | null> {
  const r = await fetch(url);
  if (!r.ok) return null;
  const bytes = new Uint8Array(await r.arrayBuffer());

  let ham = '';
  const parca = 0x8000;
  for (let i = 0; i < bytes.length; i += parca) {
    ham += String.fromCharCode(...bytes.subarray(i, i + parca));
  }

  return {
    mime: r.headers.get('content-type') ?? 'image/jpeg',
    b64: btoa(ham),
    bayt: bytes.length,
  };
}
