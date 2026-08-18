/**
 * avatar-check
 *
 * Profil fotoğrafını yapay zekâya inceletir ve sonucu `profiles`e yazar.
 *
 * ## Neden `photo-check`ten ayrı bir fonksiyon
 *
 * İki denetim aynı şeye bakmıyor. İlan karesinde asıl soru "bu kare ürünü
 * doğru gösteriyor mu" — açı, kadraj, bulanıklık, diğer karelerle aynı ürün
 * mü. Avatarda bunların hiçbiri yok: fotoğraf kedi de olabilir, çizim de,
 * manzara da. Tek soru **yayınlanabilir mi**.
 *
 * Aynı fonksiyona sığdırmak, orada zaten yedi slotluk beklenti tablosu,
 * kıyaslama mantığı ve bayt bütçesi taşıyan bir gövdeye ikinci bir mod
 * eklemek olurdu — ve her ikisinin kuralları birbirini kirletirdi.
 *
 * ## Üç durumlu karar yok, iki durumlu var
 *
 * `photo-check` üç sonuç veriyor: geçti · notlu geçti · engellendi. Uyarı
 * katmanının gerekçesi orada "yalnızca satıcıyı ilgilendiren kusur" — kötü
 * bir kadraj kendi zararı. Avatarda öyle bir kategori yok: fotoğraf ya
 * yayınlanabilir ya değil. "Bulanık avatar" diye bir engel de koymuyoruz;
 * bulanık profil fotoğrafı kimseye zarar vermez.
 *
 * ## Fotoğrafın kendi olması ŞART DEĞİL
 *
 * Kullanıcı kararı (2026-08-18): "kendi resmini veya farklı bir resim
 * koyabilsin". Çizim, hayvan, nesne, manzara — hepsi geçer. Denetim kimliği
 * değil içeriği sorguluyor.
 *
 * ## Şüphede kalırsak ONAYLAMAYIZ
 *
 * Anahtar yoksa, model yanıt vermezse ya da yanıt çözümlenemezse durum
 * `pending` kalıyor. `pending` avatar hiçbir yerde gösterilmiyor — depolama
 * politikası `approved` şartına bağlı, yani arayüz hata yapsa bile
 * denetlenmemiş bir görselin bağlantısı üretilemiyor.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const AI_KEY = Deno.env.get('AI_VISION_API_KEY') ?? '';
const AI_BASE =
  Deno.env.get('AI_VISION_BASE_URL') ?? 'https://generativelanguage.googleapis.com/v1beta';
const AI_MODEL = Deno.env.get('AI_VISION_MODEL') ?? 'gemini-3.7-flash';
const AI_TIMEOUT_MS = Number(Deno.env.get('AI_VISION_TIMEOUT_MS') ?? 25_000);

/**
 * Oran sınırı `photo-check` ile **ortak** (aynı tablo, aynı pencere).
 *
 * Ayrı sayaç, kullanıcıya iki ayrı kotayı yakma imkânı verirdi; sınırın
 * koruduğu şey ise tek bir fatura.
 */
const SAATLIK_LIMIT = Number(Deno.env.get('AI_VISION_SAATLIK_LIMIT') ?? 60);

/** Modelin seçebileceği red sebepleri. Serbest metin sayılamaz, bu sayılır. */
const SEBEPLER = ['mustehcen', 'siddet', 'nefret', 'cocuk_yuzu', 'iletisim', 'yok'];

/** Kullanıcıya gösterilen gerekçe — modelin serbest cümlesi değil. */
const SEBEP_METNI: Record<string, string> = {
  mustehcen:
    'Profil fotoğrafın müstehcen ya da cinsel içerikli bulundu. Başka bir fotoğraf seç.',
  siddet: 'Profil fotoğrafında şiddet ya da rahatsız edici içerik bulundu. Başka bir fotoğraf seç.',
  nefret:
    'Profil fotoğrafında nefret söylemi ya da yasaklı bir sembol bulundu. Başka bir fotoğraf seç.',
  cocuk_yuzu:
    'Profil fotoğrafında bir çocuğun yüzü görünüyor. Burası herkese açık bir alan; çocuk fotoğrafı kullanılamıyor.',
  iletisim:
    'Profil fotoğrafında telefon numarası, adres ya da bağlantı görünüyor. İletişim uygulama içinden yürüyor.',
  diger: 'Profil fotoğrafı kurallara uygun bulunmadı. Başka bir fotoğraf seç.',
};

interface Karar {
  uygun: boolean;
  sebep: string;
  token?: { giris: number; cikis: number } | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  /* Kim olduğu doğrulanıyor ve **gövdeden kullanıcı alınmıyor.**
     `photo-check` bir `photoId` alıp sahipliğini ayrıca doğruluyor; burada
     böyle bir kimlik hiç yok — denetlenecek avatar, çağıranın kendi avatarı.
     Gövdeden `userId` alsaydık, doğrulaması gereken bir alan daha olurdu ve
     onu unutmak başkasının avatarını reddettirmek anlamına gelirdi. */
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const { data: oturum } = await supabase.auth.getUser(jwt);
  const kullanici = oturum?.user;
  if (!kullanici) return json({ error: 'Oturum bulunamadı' }, 401);

  const { data: profil, error: profilErr } = await supabase
    .from('profiles')
    .select('avatar_path, avatar_status')
    .eq('user_id', kullanici.id)
    .maybeSingle();

  if (profilErr) return json({ error: 'Profil okunamadı' }, 500);
  if (!profil?.avatar_path) return json({ error: 'Yüklenmiş bir profil fotoğrafı yok' }, 404);

  if (profil.avatar_status !== 'pending') {
    // İdempotency: aynı avatar iki kez incelenmez.
    return json({ status: profil.avatar_status, tekrar: true });
  }

  if (!AI_KEY) {
    console.warn('[avatar-check] AI_VISION_API_KEY yok — avatar insan kuyruğunda bekliyor');
    return json({ status: 'pending', neden: 'ai_yapilandirilmadi' });
  }

  const { data: hak } = await supabase.rpc('foto_denetim_hakki', {
    p_user_id: kullanici.id,
    p_saatlik: SAATLIK_LIMIT,
  });
  if (hak === false) {
    return json(
      {
        status: 'pending',
        neden: 'oran_siniri',
        gerekce: 'Kısa sürede çok fazla görsel gönderildi. Biraz sonra tekrar dene.',
      },
      429,
    );
  }

  const gorsel = await gorseliGetir(supabase, profil.avatar_path);
  if (!gorsel) {
    console.error('[avatar-check] görsel okunamadı', profil.avatar_path);
    return json({ status: 'pending', neden: 'gorsel_okunamadi' });
  }

  const basladi = Date.now();
  let karar: Karar | null = null;
  try {
    karar = await incele(gorsel);
  } catch (e) {
    console.error('[avatar-check] model çağrısı başarısız', String(e));
  }

  if (!karar) {
    await olcumYaz(supabase, kullanici.id, AI_MODEL, 'pending', null, null, basladi);
    return json({ status: 'pending', neden: 'model_yanit_vermedi' });
  }

  const yeni = karar.uygun ? 'approved' : 'rejected';
  const gerekce = karar.uygun ? null : (SEBEP_METNI[karar.sebep] ?? SEBEP_METNI.diger);

  /* Reddedilen görsel depodan siliniyor — `photo-check`teki ret karesiyle
     aynı gerekçe: "reddettik" ile "silmedik" farklı iki cümle ve KVKK'nın
     sorduğu şey saklama. Silme, karar yazılmadan ÖNCE deneniyor: `avatar_karar`
     yolu boşaltıyor ve boşaldıktan sonra neyi sileceğimizi bilemeyiz. */
  if (yeni === 'rejected') {
    const { error: silHatasi } = await supabase.storage
      .from('avatars')
      .remove([profil.avatar_path]);
    if (silHatasi) {
      console.error('[avatar-check] reddedilen avatar silinemedi', silHatasi.message);
    }
  }

  const { error: kararHatasi } = await supabase.rpc('avatar_karar', {
    p_user_id: kullanici.id,
    p_durum: yeni,
    p_gerekce: gerekce,
  });
  if (kararHatasi) {
    console.error('[avatar-check] karar yazılamadı', kararHatasi.message);
    return json({ status: 'pending', neden: 'karar_yazilamadi' });
  }

  await olcumYaz(
    supabase,
    kullanici.id,
    AI_MODEL,
    yeni,
    karar.uygun ? null : karar.sebep,
    karar.token,
    basladi,
  );

  return json({ status: yeni, gerekce: gerekce ?? '' });
});

async function olcumYaz(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  model: string,
  karar: string,
  sebep: string | null,
  token: { giris: number; cikis: number } | null | undefined,
  basladi: number,
): Promise<void> {
  try {
    await supabase.rpc('foto_denetim_kaydet', {
      p_user_id: userId,
      /* Avatarın `product_photos` karşılığı yok; kolon zaten nullable.
         `tur` alanı satırın hangi denetimden geldiğini söylüyor — maliyeti
         türe göre ayırmadan hangisini ucuzlatacağımıza karar veremeyiz. */
      p_photo_id: null,
      p_model: model,
      p_karar: karar,
      p_sebep: sebep,
      p_sure_ms: Date.now() - basladi,
      p_giris_token: token?.giris ?? null,
      p_cikis_token: token?.cikis ?? null,
      p_tur: 'avatar',
    });
  } catch (e) {
    console.error('[avatar-check] ölçüm yazılamadı', String(e));
  }
}

const GECICI_KODLAR = [408, 429, 500, 502, 503, 504];

/** Zaman aşımlı ve geçici hatalarda yeniden denemeli istek. */
async function istekAt(url: string, govde: unknown, deneme = 0): Promise<Response | null> {
  const kesici = new AbortController();
  const sayac = setTimeout(() => kesici.abort(), AI_TIMEOUT_MS);
  try {
    const yanit = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': AI_KEY },
      body: JSON.stringify(govde),
      signal: kesici.signal,
    });
    if (yanit.ok) return yanit;

    if (GECICI_KODLAR.includes(yanit.status) && deneme < 2) {
      const bildirilen = Number(yanit.headers.get('Retry-After') ?? 0) * 1000;
      const bekle = bildirilen > 0 ? Math.min(bildirilen, 8000) : 500 * 2 ** deneme;
      await new Promise((r) => setTimeout(r, bekle));
      return istekAt(url, govde, deneme + 1);
    }

    console.error('[avatar-check] model reddetti', yanit.status);
    return null;
  } catch (e) {
    if (deneme < 2) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** deneme));
      return istekAt(url, govde, deneme + 1);
    }
    console.error('[avatar-check] istek başarısız', String(e));
    return null;
  } finally {
    clearTimeout(sayac);
  }
}

async function incele(gorsel: { mime: string; b64: string }): Promise<Karar | null> {
  /* Kullanıcıdan gelen hiçbir metin bu isteme girmiyor; yalnızca görsel ve
     bizim yazdığımız kurallar gidiyor. Prompt injection yüzeyi yok. */
  const istem = `Bir ikinci el çocuk ürünü pazaryerinde kullanıcının PROFİL FOTOĞRAFINI denetliyorsun.
Bu fotoğraf uygulamadaki bütün kullanıcılara görünecek.

Fotoğrafın kullanıcının kendisi olması GEREKMİYOR. Çizim, hayvan, nesne, manzara,
karakter — hepsi kabul edilir. Bulanıklık, kadraj ve kalite denetlenmez.

Şu durumlarda UYGUN DEĞİL de:
- Müstehcen, cinsel içerikli, pornografik ya da yetişkinlere yönelik bir şey varsa;
  iç çamaşırlı/mayolu bedene odaklanan çekimler de buna dâhil
- Şiddet, kan, yaralanma ya da rahatsız edici bir sahne varsa
- Nefret söylemi, ırkçı içerik veya yasaklı bir sembol varsa
- Bir çocuğun yüzü görünüyorsa — yetişkinin yüzü serbest, çocuğun yüzü değil
- Fotoğrafın üzerinde telefon numarası, e-posta, adres, sosyal medya hesabı
  veya bir bağlantı yazıyorsa

Ayrıca \`sebep\` alanını doldur:
- mustehcen ..... müstehcen/cinsel içerik
- siddet ........ şiddet, kan, rahatsız edici sahne
- nefret ........ nefret söylemi ya da yasaklı sembol
- cocuk_yuzu .... çocuk yüzü görünüyor
- iletisim ...... görselin üzerinde iletişim bilgisi ya da bağlantı var
- yok ........... fotoğraf uygun

Birden fazlası geçerliyse listedeki ilk sırada olanı ver.
Emin olamadığın yerde uygun deme.`;

  const yanit = await istekAt(`${AI_BASE}/models/${AI_MODEL}:generateContent`, {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: gorsel.mime, data: gorsel.b64 } },
          { text: istem },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          uygun: { type: 'BOOLEAN' },
          sebep: { type: 'STRING', enum: SEBEPLER },
        },
        required: ['uygun', 'sebep'],
      },
    },
  });

  if (!yanit) return null;
  const govde = await yanit.json();
  const metin: string | undefined = govde?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!metin) return null;

  const kullanim = govde?.usageMetadata;
  const token = kullanim
    ? {
        giris: Number(kullanim.promptTokenCount ?? 0),
        cikis: Math.max(
          0,
          Number(kullanim.totalTokenCount ?? 0) - Number(kullanim.promptTokenCount ?? 0),
        ),
      }
    : null;

  try {
    const c = JSON.parse(metin.replace(/```json|```/g, '').trim());
    if (typeof c?.uygun !== 'boolean') return null;
    const sebep = typeof c?.sebep === 'string' && SEBEPLER.includes(c.sebep) ? c.sebep : 'diger';
    /* Model "uygun" derken bir red sebebi de verdiyse reddi kazandırıyoruz.
       İki alan çelişiyorsa sıkı olanı seçmek, bu denetimin tamamının
       gerekçesi. */
    const uygun = c.uygun && (sebep === 'yok' || sebep === 'diger');
    return { uygun, sebep: uygun ? 'yok' : sebep, token };
  } catch {
    return null;
  }
}

/** Avatarı küçültülmüş hâliyle indirir; dönüşüm kapalıysa tam boya düşer. */
async function gorseliGetir(
  supabase: ReturnType<typeof createClient>,
  path: string,
): Promise<{ mime: string; b64: string } | null> {
  const { data: kucuk } = await supabase.storage.from('avatars').createSignedUrl(path, 120, {
    transform: { width: 768, height: 768, resize: 'contain' },
  });
  if (kucuk?.signedUrl) {
    const g = await gorseliAl(kucuk.signedUrl);
    if (g) return g;
    console.warn('[avatar-check] dönüşümlü indirme başarısız, tam boya düşülüyor');
  }
  const { data: tam } = await supabase.storage.from('avatars').createSignedUrl(path, 120);
  return tam?.signedUrl ? await gorseliAl(tam.signedUrl) : null;
}

async function gorseliAl(url: string): Promise<{ mime: string; b64: string } | null> {
  const r = await fetch(url);
  if (!r.ok) return null;
  const bytes = new Uint8Array(await r.arrayBuffer());

  /* 32 KB'lik parçalar: `String.fromCharCode(...bytes)` tek seferde
     çağrıldığında her bayt bir argüman oluyor ve büyük dosyalarda çağrı
     yığını taşıyor. Küçük görselde çalışıp büyüğünde patlayan cinsten. */
  let ham = '';
  const parca = 0x8000;
  for (let i = 0; i < bytes.length; i += parca) {
    ham += String.fromCharCode(...bytes.subarray(i, i + parca));
  }
  return { mime: r.headers.get('content-type') ?? 'image/jpeg', b64: btoa(ham) };
}
