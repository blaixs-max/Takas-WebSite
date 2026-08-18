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

/* Uç nokta env'de: Vertex AI'a ya da başka bir sağlayıcıya geçmek fonksiyonu
   yeniden yazmak olmasın. Bugün Gemini API kullanılıyor (basit anahtar);
   KVKK gerekçesiyle Vertex'e (AB bölgesi + DPA) geçilirse buraya bölgesel
   uç yazılır ve üstüne bir OAuth katmanı gelir. */
const AI_BASE =
  Deno.env.get('AI_VISION_BASE_URL') ?? 'https://generativelanguage.googleapis.com/v1beta';
/**
 * Ana karar modeli.
 *
 * Varsayılan bilerek **karar verdiğimiz modelin kendisi**, bir alt basamak
 * değil: sır girilmezse ya da adı yanlış yazılırsa güvenlik kararını veren
 * model sessizce zayıflamamalı. Varsayılan `gemini-2.5-flash` kalsaydı, eksik
 * bir sır hiçbir hata üretmeden çocuk yüzü kontrolünü eski modele düşürürdü.
 *
 * Neden 3.7 Flash (2026-08-16): tanımı "multimodal reasoning" diyor ve
 * bizim zorlandığımız yer tam orası — beş kareyi birlikte görüp aynı fiziksel
 * ürünü tanımak. Flash-Lite sınıfı "simple data processing" için, bizim iş
 * onun tersi. Pro sınıfı yapardı ama satıcı elinde telefonla bekliyor.
 * `gemini-2.5-flash` yarı fiyatına yakın ama ayakta kalan en eski Flash;
 * yeni bir entegrasyonu en erken emekli olacak modele bağlamak yanlış olurdu.
 *
 * **Fiyat 1 Ocak 2027'de ikiye katlanıyor** ($0.75/$3.75 → $1.50/$7.50).
 * Aralık'ta yeniden bakılacak.
 */
const AI_MODEL = Deno.env.get('AI_VISION_MODEL') ?? 'gemini-3.7-flash';

/**
 * İkinci görüş modeli. Boşsa mekanizma kapalı.
 *
 * **Yalnızca RED kararında ve yalnızca güvenlik dışı sebeplerde çalışır.**
 * Gerekçesi iki hatanın simetrik olmaması: kaçırmayı (çocuk yüzünü görmemek)
 * çıkarım anında yakalayamazsın — kaçırdığını bilmiyorsun. Ama yanlış reddi
 * yakalayabilirsin, ve yanlış red dürüst satıcıyı bloke edip arzı öldüren
 * hata. Redler azınlıkta olduğu için maliyet küçük kalıyor.
 *
 * Güvenlik reddini bozamamasının sebebi: "çocuk yüzü var" kararını ikinci bir
 * modele bozdurmak, iki modelden **daha gevşek olanını** yetkili kılmak
 * demektir. Orada istediğimiz tam tersi.
 */
const AI_MODEL_STRICT = Deno.env.get('AI_VISION_MODEL_STRICT') ?? '';

/** Model yanıt vermezse istek bu süre sonunda kesilir. */
const AI_TIMEOUT_MS = Number(Deno.env.get('AI_VISION_TIMEOUT_MS') ?? 25_000);

/** Kullanıcı başına saatlik denetim çağrısı. */
const SAATLIK_LIMIT = Number(Deno.env.get('AI_VISION_SAATLIK_LIMIT') ?? 60);

/**
 * İkinci görüşün **bozamayacağı** red sebepleri.
 *
 * Bu ikisi kişisel veri ve içerik güvenliği; kalanlar (yanlış açı, aynı açı,
 * stok görsel, kalite) ürün kuralı. Ürün kuralında yanılmanın bedeli bir
 * satıcının canının sıkılması, güvenlikte yanılmanın bedeli bir çocuğun
 * yüzünün indekslenen bir pazaryerinde yayınlanması.
 */
const GUVENLIK_SEBEPLERI = ['cocuk_yuzu', 'mustehcen', 'arka_plan'];

/**
 * Yayını **engelleyen** sebepler. Kalanlar uyarıya iner.
 *
 * Ayıran çizgi: **başkasına zarar veren şey engeller, yalnızca satıcıyı
 * ilgilendiren şey uyarır.** Buradakiler alıcıyı ya da fotoğraftaki kişiyi
 * koruyor; dışarıda kalanlar (yanlış açı, bulanıklık, aynı açı) yalnızca
 * ilanın kalitesiyle ilgili ve ona karar vermek satıcının hakkı — kötü
 * fotoğraf kendi zararı, ilanı daha az ilgi görür.
 *
 * Ayrım canlıdaki ilk gerçek kullanımdan sonra kondu: sekiz reddin sekizi de
 * kadraj yüzündendi, hiçbiri güvenlikle ilgili değildi. Bir Superman
 * figüründe sol kareye "bu sağ profil", sağ kareye "bu sol profil" dendi —
 * ikisini takas etse yine reddedilebilirdi, çıkışı olmayan bir döngü. Model
 * sağı soldan güvenilir ayıramıyor ve ayıramadığı bir şey yüzünden insan
 * engellenmemeli.
 *
 * `baska_urun` burada: "bu aynı ürün bile değil" bir kadraj tercihi değil,
 * aldatmadır. `ayni_aci` burada **değil** — aynı zayıf görüşe dayanıyor, ve
 * dört karenin dördü de aynı açıysa alıcı ilanı açtığında zaten görüyor.
 */
const ENGEL_SEBEPLERI = [
  'cocuk_yuzu',
  'mustehcen',
  'arka_plan',
  'stok_gorsel',
  'ekran_cekimi',
  'baska_urun',
];

/** Modelin seçebileceği red sebepleri. Serbest metin sayılamaz, bu sayılır. */
const SEBEPLER = [
  'cocuk_yuzu',
  'mustehcen',
  'arka_plan',
  'stok_gorsel',
  'ekran_cekimi',
  'yanlis_aci',
  'kalite',
  'baska_urun',
  'ayni_aci',
  'yok',
];

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
  /**
   * Red sebebinin **sayılabilir** hâli. `gerekce` kullanıcıya gösterilmek
   * için iyi ama sayılmak için kötü — model her seferinde başka türlü
   * yazıyor. İkinci görüş mekanizması da buna bağlı: güvenlik sebebiyle
   * verilen red bozulamıyor, ürün sebebiyle verilen bozulabiliyor. Bu ayrımı
   * serbest cümle üzerinden yapmak, cümle eşleştirmek olurdu.
   */
  sebep: string;
  /** Kıyas yapıldıysa dolu; yapılmadıysa undefined. */
  ayniUrun?: boolean;
  farkliAci?: boolean;
  /** Fatura ölçümü için; sağlayıcı vermezse boş. */
  token?: { giris: number; cikis: number } | null;
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

  /* **Çağıranın kim olduğu doğrulanıyor.**
     `verify_jwt = true` yalnızca *birinin* giriş yaptığını kanıtlıyor, o
     karenin sahibi olduğunu değil — ve fonksiyon `service_role` ile çalıştığı
     için RLS de devrede değil. Bu doğrulama olmadan giriş yapmış herhangi
     biri başkasının `photoId`'siyle çağırıp o karenin red gerekçesini okur ve
     hesabın kotasını yakardı. `config.toml`'daki not bunu zaten amaçlıyordu
     ama JWT tek başına sağlamıyor. */
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const { data: oturum } = await supabase.auth.getUser(jwt);
  const kullanici = oturum?.user;
  if (!kullanici) return json({ error: 'Oturum bulunamadı' }, 401);

  const { data: kare, error: kareErr } = await supabase
    .from('product_photos')
    .select('id, product_id, slot, storage_path, moderation_status, products!inner(seller_id)')
    .eq('id', b.photoId)
    .single();

  if (kareErr || !kare) return json({ error: 'Kare bulunamadı' }, 404);

  /* Sahiplik. 404 dönüyoruz, 403 değil: "bu kare var ama senin değil" demek,
     geçerli bir kare kimliğini doğrulamak olurdu. */
  const sahip = (kare.products as unknown as { seller_id: string } | null)?.seller_id;
  if (sahip !== kullanici.id) return json({ error: 'Kare bulunamadı' }, 404);
  if (kare.moderation_status !== 'pending') {
    // İdempotency: aynı kare iki kez incelenmez.
    return json({ photoId: kare.id, status: kare.moderation_status, tekrar: true });
  }

  /* Etiket karesi denetlenmiyor — doğrudan geçiyor.
     Zorunlu değil ve yayın kapısı zorunsuz slottaki reddi zaten siliyor, yani
     buradaki bir ret hiçbir şeyi engellemiyordu; yalnızca kullanıcıya boşuna
     "reddedildi" diyordu. Canlıdaki sekiz reddin üçü buradan geldi ve üçü de
     "CE işareti okunmuyor" tipindeydi — ikinci el bir oyuncakta okunur etiket
     beklemek gerçekçi değil.
     Güvenlik gerekçesi zayıflamıyor: dört zorunlu açı kareye bakılıyor ve
     ürün orada zaten görünüyor. Etiket karesi ürünün yakın çekimi, yeni bir
     ortam ya da yeni bir kişi göstermiyor. */
  if (kare.slot === 'label') {
    await supabase
      .from('product_photos')
      .update({ moderation_status: 'approved', moderation_reason: null, uyari: null })
      .eq('id', kare.id)
      .eq('moderation_status', 'pending');
    return json({ photoId: kare.id, status: 'approved', gerekce: '', uyari: '', denetimsiz: true });
  }

  // Anahtar yoksa kareyi ONAYLAMAYIZ. 'pending' kalır ve ilan insana kuyruklanır.
  if (!AI_KEY) {
    console.warn('[photo-check] AI_VISION_API_KEY yok — kare insan kuyruğunda bekliyor');
    return json({ photoId: kare.id, status: 'pending', neden: 'ai_yapilandirilmadi' });
  }

  /* Oran sınırı. Sınır kareye değil **çağrıya** bakıyor: reddedilen kare
     yeniden çekilip yeniden gönderiliyor ve her deneme para. Ücretsiz
     katmanda bu bir gecikmeydi, ücretlide doğrudan fatura. */
  const { data: hak } = await supabase.rpc('foto_denetim_hakki', {
    p_user_id: kullanici.id,
    p_saatlik: SAATLIK_LIMIT,
  });
  if (hak === false) {
    return json(
      {
        photoId: kare.id,
        status: 'pending',
        neden: 'oran_siniri',
        gerekce: 'Kısa sürede çok fazla kare gönderildi. Biraz sonra tekrar dene.',
      },
      429,
    );
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

  const basladi = Date.now();
  let karar: Karar | null = null;
  try {
    karar = await incele(ana, kare.slot, kiyasKareler, AI_MODEL);
  } catch (e) {
    console.error('[photo-check] model çağrısı başarısız', String(e));
  }

  // Model yanıt vermediyse ya da yanıtı çözümlenemediyse: 'pending' kalır.
  if (!karar) {
    await olcumYaz(supabase, kullanici.id, kare.id, AI_MODEL, 'pending', null, false, null, basladi);
    return json({ photoId: kare.id, status: 'pending', neden: 'model_yanit_vermedi' });
  }

  /* İKİNCİ GÖRÜŞ — yalnızca reddederken, yalnızca güvenlik dışı sebepte.
     Dürüst bir satıcıyı bloke etmeden önce daha güçlü modele soruyoruz.
     Güvenlik reddi (çocuk yüzü, arka plan) buraya girmiyor: onu bozdurmak,
     iki modelden gevşek olanını yetkili kılmak olurdu. */
  let ikinciGorus = false;
  let kullanilanModel = AI_MODEL;
  if (
    !karar.uygun &&
    AI_MODEL_STRICT &&
    AI_MODEL_STRICT !== AI_MODEL &&
    !GUVENLIK_SEBEPLERI.includes(karar.sebep)
  ) {
    try {
      const ikinci = await incele(ana, kare.slot, kiyasKareler, AI_MODEL_STRICT);
      if (ikinci) {
        ikinciGorus = true;
        kullanilanModel = AI_MODEL_STRICT;
        karar = ikinci;
      }
    } catch (e) {
      /* İkinci görüş alınamadıysa ilk karar geçerli. Reddi sessizce onaya
         çevirmek, mekanizmanın hata hâlinde kendini kapatması olurdu. */
      console.error('[photo-check] ikinci görüş alınamadı', String(e));
    }
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

  /* Sebep kodu: kıyas hatası kendi kodunu üretiyor, yoksa modelinki. */
  const sebepKodu = kiyasHatasi
    ? karar.ayniUrun === false
      ? 'baska_urun'
      : 'ayni_aci'
    : karar.sebep;

  /* Üç sonuç var, iki değil: geçti · notlu geçti · engellendi.
     Model bir kusur bulduysa (`!karar.uygun` ya da kıyas hatası) o kusurun
     **engel mi uyarı mı** olduğuna sebep koduna bakarak karar veriyoruz.
     Engel değilse kare geçiyor ve kusur `uyari` alanına yazılıyor; satıcı
     görür, isterse yeniden çeker, istemezse ilanı yayına girer. */
  const kusurVar = !karar.uygun || Boolean(kiyasHatasi);
  const engel = kusurVar && ENGEL_SEBEPLERI.includes(sebepKodu);
  const uyariMetni = kusurVar && !engel ? (kiyasHatasi ?? karar.gerekce) : null;

  const yeni = engel ? 'rejected' : 'approved';
  const gerekce = engel ? (kiyasHatasi ?? karar.gerekce) : null;

  /* `.eq('moderation_status','pending')` idempotency koşulu: bu istek karara
     gerçekten kendisi vardıysa satır döner. Silme kararı buna bağlı — başka
     bir çağrı önce davrandıysa nesneyi ikinci kez silmeye çalışmayız. */
  const { data: guncel } = await supabase
    .from('product_photos')
    .update({ moderation_status: yeni, moderation_reason: gerekce, uyari: uyariMetni })
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

  await olcumYaz(
    supabase,
    kullanici.id,
    kare.id,
    kullanilanModel,
    yeni,
    /* Kusursuz kareye `null`, kusurluya kodu — engel olmasa bile. Uyarıya
       inen sebeplerin ne sıklıkta ateşlediğini ancak böyle görebiliriz ve
       `ayni_aci`yı uyarıya indirme kararı tam olarak bu veriye bakılarak
       yeniden değerlendirilecek. */
    kusurVar ? sebepKodu : null,
    ikinciGorus,
    karar.token,
    basladi,
  );

  return json({
    photoId: kare.id,
    status: yeni,
    gerekce: gerekce ?? '',
    uyari: uyariMetni ?? '',
  });
});

/**
 * Bir denetim çağrısını kaydeder — maliyet, oran sınırı ve sebep dağılımı.
 *
 * Hata yutuluyor: ölçüm yazılamadı diye kullanıcının kararı düşmemeli.
 * Ölçüm bir yan defter, kararın kendisi değil.
 */
async function olcumYaz(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  photoId: string,
  model: string,
  karar: string,
  sebep: string | null,
  ikinciGorus: boolean,
  token: { giris: number; cikis: number } | null | undefined,
  basladi: number,
): Promise<void> {
  try {
    await supabase.rpc('foto_denetim_kaydet', {
      p_user_id: userId,
      p_photo_id: photoId,
      p_model: model,
      p_karar: karar,
      p_sebep: sebep,
      p_ikinci_gorus: ikinciGorus,
      p_giris_token: token?.giris ?? null,
      p_cikis_token: token?.cikis ?? null,
      p_sure_ms: Date.now() - basladi,
    });
  } catch (e) {
    console.error('[photo-check] ölçüm yazılamadı', String(e));
  }
}

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

/** Yeniden denenmeye değer durumlar: geçici, bizim hatamız değil. */
const GECICI_KODLAR = [408, 429, 500, 502, 503, 504];

/**
 * Modele istek atar: zaman aşımlı ve geçici hatalarda yeniden denemeli.
 *
 * ## Neden gerekli
 *
 * Eskiden tek satırdı: `if (!yanit.ok) return null`. Yani 429 (hız sınırı) ile
 * gerçek bir ret aynı muamele görüyordu ve ikisi de kareyi insan kuyruğuna
 * atıyordu. Geçici bir hız sınırı, ilanın yayına girmemesi demek olmamalı —
 * hele ücretli katmanda, hele bir saniye sonra çalışacakken.
 *
 * Zaman aşımı da yoktu: model yanıt vermezse istek Edge Function sınırına
 * kadar bekliyordu ve kullanıcı ekranda kalıyordu.
 *
 * İki deneme, üstel bekleme. Sağlayıcı `Retry-After` verirse ona uyuluyor —
 * kendi tahminimiz onun bildiğinden iyi değil. Daha fazla denemek, elinde
 * telefonla bekleyen satıcıyı daha da bekletmek olurdu; o noktada kareyi
 * insan kuyruğuna bırakmak daha dürüst.
 */
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
      console.warn(`[photo-check] ${yanit.status} — ${bekle} ms sonra yeniden`);
      await new Promise((r) => setTimeout(r, bekle));
      return istekAt(url, govde, deneme + 1);
    }

    console.error('[photo-check] model reddetti', yanit.status, await yanit.text().catch(() => ''));
    return null;
  } catch (e) {
    /* Zaman aşımı da geçici sayılıyor: modelin yavaş olduğu an, yanlış
       olduğu an değil. */
    if (deneme < 2) {
      const bekle = 500 * 2 ** deneme;
      console.warn('[photo-check] istek kesildi, yeniden deneniyor', String(e));
      await new Promise((r) => setTimeout(r, bekle));
      return istekAt(url, govde, deneme + 1);
    }
    console.error('[photo-check] istek başarısız', String(e));
    return null;
  } finally {
    clearTimeout(sayac);
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
async function incele(
  gorsel: Gorsel,
  slot: string,
  kiyasKareler: Kiyas[],
  model: string,
): Promise<Karar | null> {
  const kiyas = kiyasKareler.length > 0;
  const beklenti = SLOT_BEKLENTI[slot] ?? 'ürünün fotoğrafı';

  /* Kullanıcıdan gelen hiçbir metin bu isteme girmiyor; yalnızca görseller ve
     bizim yazdığımız slot beklentisi gidiyor. Prompt injection yüzeyi yok. */
  const denetim = `Şu durumlarda UYGUN DEĞİL de:
- Kadrajda bir çocuğun yüzü görünüyorsa
- Karede müstehcen, cinsel içerikli ya da yetişkinlere yönelik bir şey varsa — **ürünün kendisi de dahil**, yalnızca arka plan değil
- Arka planda tanınabilir üçüncü bir kişi veya uygunsuz bir ortam varsa
- Görsel stok/katalog fotoğrafı gibi duruyorsa (gerçek ev çekimi değilse)
- Kare bir ekranın (telefon, bilgisayar, televizyon) ya da basılı bir fotoğrafın fotoğrafıysa — piksel deseni, ekran kenarı, yansıma veya parlaklık dalgalanması varsa
- Ürün bulanık, çok karanlık ya da kadrajda çok küçükse
- Kare beklenen açıyı göstermiyorsa

Ayrıca \`sebep\` alanını doldur — hangi maddeden düştüğünü tek bir kodla söyle:
- cocuk_yuzu ......... kadrajda çocuk yüzü var
- mustehcen .......... karede müstehcen/cinsel içerik (ürünün kendisi ya da arka plan)
- arka_plan .......... arka planda tanınabilir üçüncü kişi veya uygunsuz ortam
- stok_gorsel ........ stok/katalog fotoğrafı
- ekran_cekimi ....... ekranın ya da basılı bir fotoğrafın fotoğrafı
- kalite ............. bulanık, karanlık ya da ürün çok küçük
- yanlis_aci ......... beklenen açıyı göstermiyor
- yok ................ kare uygun

Birden fazlası geçerliyse **listedeki ilk sırada olanı** ver: çocuk yüzü,
müstehcen içerik ve arka plan, diğerlerinin hepsinden önce gelir.`;

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

  /* `sebep` şemada zorunlu ve **enum**: modelin serbest cümlesi kullanıcıya
     gösterilecek metin, `sebep` ise sayılacak ve ikinci görüş kararını
     verecek olan alan. Enum olmasaydı model "çocuk yüzü" ile "bebek yüzü"
     arasında gidip gelirdi ve `GUVENLIK_SEBEPLERI` kontrolü sessizce
     kaçırırdı — yani güvenlik reddi bozulabilir hâle gelirdi. */
  const ortakAlanlar = {
    uygun: { type: 'BOOLEAN' },
    gerekce: { type: 'STRING' },
    sebep: { type: 'STRING', enum: SEBEPLER },
  };

  const sema = kiyas
    ? {
        type: 'OBJECT',
        properties: {
          ...ortakAlanlar,
          ayniUrun: { type: 'BOOLEAN' },
          farkliAci: { type: 'BOOLEAN' },
        },
        required: ['uygun', 'gerekce', 'sebep', 'ayniUrun', 'farkliAci'],
      }
    : {
        type: 'OBJECT',
        properties: ortakAlanlar,
        required: ['uygun', 'gerekce', 'sebep'],
      };

  const yanit = await istekAt(`${AI_BASE}/models/${model}:generateContent`, {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: sema,
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
        /* Düşünme jetonları da faturaya giriyor; `candidatesTokenCount` onları
           saymıyor. Toplamdan girişi çıkarmak, ödediğimiz çıkışı verir. */
        cikis: Math.max(
          0,
          Number(kullanim.totalTokenCount ?? 0) - Number(kullanim.promptTokenCount ?? 0),
        ),
      }
    : null;

  try {
    const c = JSON.parse(metin.replace(/```json|```/g, '').trim());
    if (typeof c?.uygun !== 'boolean') return null;
    if (kiyas && (typeof c?.ayniUrun !== 'boolean' || typeof c?.farkliAci !== 'boolean')) {
      // Kıyas istendi ama cevap gelmedi: onaylamak yerine insana bırakılır.
      return null;
    }
    /* Tanımadığımız bir sebep gelirse `diger` değil **`cocuk_yuzu` gibi
       davranmıyoruz ama güvenli tarafta kalıyoruz**: bilinmeyen sebep
       `GUVENLIK_SEBEPLERI` içinde olmadığı için ikinci görüşe açılır, yani
       karar daha güçlü modele gider. Sessizce onaya dönmez. */
    const sebep = typeof c?.sebep === 'string' && SEBEPLER.includes(c.sebep) ? c.sebep : 'diger';
    return {
      uygun: c.uygun,
      gerekce: String(c.gerekce ?? ''),
      sebep,
      ayniUrun: kiyas ? c.ayniUrun : undefined,
      farkliAci: kiyas ? c.farkliAci : undefined,
      token,
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
