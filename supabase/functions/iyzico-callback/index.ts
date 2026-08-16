/**
 * iyzico-callback
 *
 * iyzico ödeme tamamlanınca callbackUrl'e `token` POST eder. Bu fonksiyon
 * token'ı alır, sonucu iyzico'ya RETRIEVE ile doğrular (gövdeye asla
 * güvenilmez) ve kaydı günceller.
 *
 * Önceki sürümde iki sorun vardı:
 *
 *  1. Tekrar teslimde ödeme yeniden işleniyordu. iyzico callback'i yeniden
 *     gönderir; kayıt zaten PAID olsa bile fonksiyon baştan çalışıyordu.
 *  2. Takas durumu koşulsuz SHIPPED yazılıyordu. Takas DELIVERED ya da
 *     COMPLETED olmuşsa geriye sarılıyordu — teslim edilmiş bir gönderi
 *     yeniden "yolda" oluyordu.
 *
 * Artık işlenmiş ödeme erken döner ve durum yalnızca ileri yönde,
 * POINTS_HELD'den SHIPPED'e taşınır.
 *
 * NOT: Bu fonksiyon JWT doğrulaması OLMADAN dağıtılmalıdır — iyzico bir
 * Supabase oturumu taşıyamaz. Güvenlik token'ın gizliliğine ve RETRIEVE
 * doğrulamasına dayanır. Bkz. supabase/config.toml.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { retrieveCheckoutForm } from '../_shared/iyzico.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_RETURN_URL = Deno.env.get('APP_RETURN_URL') ?? 'eldenele://payment-result';

/**
 * Kullanıcıyı uygulamaya geri gönderir.
 *
 * `pending`: sonucu **öğrenemedik**. iyzico'ya sorduk, cevap alamadık. Burada
 * 'failure' demek yanlış olurdu — para çekilmiş olabilir; 'success' demek daha
 * da yanlış. Ödeme kaydı `PENDING` kalıyor ve uygulama "durumu doğrulanıyor"
 * diyor; gerçeği ya sonraki callback ya da süre dolumu belirliyor.
 */
function redirect(status: 'success' | 'failure' | 'pending', tradeId: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: `${APP_RETURN_URL}?status=${status}&trade=${tradeId}` },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let token = '';
  try {
    const form = await req.formData();
    token = String(form.get('token') ?? '');
  } catch {
    try {
      const body = await req.json();
      token = body.token ?? '';
    } catch { /* yoksay */ }
  }
  if (!token) return new Response('token yok', { status: 400 });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  /* `trade_id` seçiliyor ve aşağıda takas onunla anahtarlanıyor.
     Eskiden `conversation_id` kullanılıyordu: o alan **iyzico'ya bakan**
     referans ve bugün `trade_id` ile aynı değeri taşıyor, yani hata
     üretmiyordu. Ama ikisi bir gün ayrışırsa — ör. ödeme yeniden başlatılınca
     conversationId'ye bir sonek eklenirse, ki çok doğal bir hamle — callback
     takası sessizce ilerletemez hâle gelirdi. Kendi tablomuzu kendi
     anahtarımızla anahtarlıyoruz. */
  const KOLONLAR = 'id, trade_id, conversation_id, status, amount';

  let { data: payment } = await supabase
    .from('cargo_payments')
    .select(KOLONLAR)
    .eq('token', token)
    .maybeSingle();

  /* Güncel token tutmadıysa geçmişe bak.
     `cargo-payment-init` yarım kalmış bir denemeyi yeniden başlatınca token'ı
     değiştiriyor, ama eskisi iyzico tarafında hâlâ geçerli olabiliyor. Alıcı
     açık duran eski sayfayı tamamlarsa callback o token'la geliyor; burada
     durup 404 dönseydik **para çekilmiş, hiçbir yere yazılmamış** olurdu. */
  if (!payment) {
    const { data: eski } = await supabase
      .from('cargo_payments')
      .select(KOLONLAR)
      .contains('previous_tokens', [token])
      .maybeSingle();
    if (eski) {
      console.warn('[iyzico-callback] ödeme eski token ile bulundu', eski.trade_id);
      payment = eski;
    }
  }

  if (!payment) return new Response('ödeme bulunamadı', { status: 404 });

  // ---- İdempotency: bu ödeme zaten sonuçlandıysa tekrar işleme ------------
  // iyzico callback'i yeniden gönderir. İkinci teslimde yapılacak bir şey yok;
  // kullanıcı yine doğru ekrana döner.
  if (payment.status === 'PAID') return redirect('success', payment.trade_id);
  if (payment.status === 'FAILED') return redirect('failure', payment.trade_id);

  // ---- Gerçek sonucu iyzico'dan doğrula ----------------------------------
  /* RETRIEVE patlarsa hiçbir şey yazmıyoruz. Eskiden istisna dışarı sızıyordu:
     ödemesini yeni yapmış kullanıcı uygulamaya dönmek yerine 500 görüyordu ve
     kayıt yine PENDING kalıyordu. Kayıt PENDING kalmaya devam ediyor — doğrusu
     bu — ama kullanıcı artık dönüyor. */
  let result: Awaited<ReturnType<typeof retrieveCheckoutForm>>;
  try {
    result = await retrieveCheckoutForm(token, payment.conversation_id);
  } catch (e) {
    console.error('[iyzico-callback] RETRIEVE başarısız', payment.trade_id, String(e));
    return redirect('pending', payment.trade_id);
  }

  /* Tutar doğrulaması. `paidPrice` hiç okunmuyordu: yalnızca "başarılı mı"
     sorusu soruluyordu, "ne kadar ödendi" sorulmuyordu.

     Bugün sömürülebilir değil — tutarı `cargo-payment-init` belirliyor ve
     token bizim satırımıza bağlı. Ama ödeme doğrulamasında tutarı kontrol
     etmemek, kontrolün yarısını yapmaktır: init ile callback arasında fiyatı
     değiştiren herhangi bir kusur (yeniden başlatma, yarış, ileride eklenecek
     indirim) sessizce eksik tahsilatı PAID yazardı.

     Kuruş farkına tolerans var: iyzico "84.9" ya da "84.90" döndürebiliyor. */
  const beklenen = Number(payment.amount);
  const odenen = Number(result.paidPrice ?? result.price ?? NaN);
  const tutarTutuyor = Number.isFinite(odenen) && Math.abs(odenen - beklenen) < 0.01;

  const iyzicoOnayladi = result.status === 'success' && result.paymentStatus === 'SUCCESS';

  /* Tutar tutmuyorsa FAILED YAZMIYORUZ.
     İlk yazdığımda `paid = onay && tutarTutuyor` deyip gerisini FAILED'e
     bırakmıştım; yanlıştı. FAILED "para hareket etmedi" iddiasıdır ve burada
     tam tersi biliniyor: iyzico ödemeyi onayladı, yalnızca miktar beklediğimiz
     değil. Bu, ödeme yeniden başlatılıp fiyat tazelendiğinde gerçekten
     olabilecek bir durum — alıcı açık duran eski sayfayı eski fiyattan
     tamamlar. Kayıt PENDING kalıyor, log bağırıyor, kararı insan veriyor. */
  if (iyzicoOnayladi && !tutarTutuyor) {
    console.error(
      `[iyzico-callback] TUTAR UYUŞMUYOR — insan incelemesi gerekiyor. ` +
        `trade=${payment.trade_id} beklenen=${beklenen} odenen=${odenen} paymentId=${result.paymentId}`,
    );
    return redirect('pending', payment.trade_id);
  }

  const paid = iyzicoOnayladi;

  // Yalnızca hâlâ PENDING ise yaz: iki callback yarışırsa biri boşa düşer.
  const { data: updated } = await supabase
    .from('cargo_payments')
    .update({
      status: paid ? 'PAID' : 'FAILED',
      iyzico_payment_id: result.paymentId ?? null,
      paid_at: paid ? new Date().toISOString() : null,
    })
    .eq('id', payment.id)
    .eq('status', 'PENDING')
    .select('id');

  const bizYazdik = Array.isArray(updated) && updated.length > 0;

  if (paid && bizYazdik) {
    // Durum makinesi yalnızca ileri gider. Takas bu arada DELIVERED ya da
    // COMPLETED olduysa dokunmayız — eq('status', ...) bunu garantiler.
    const { data: moved } = await supabase
      .from('trades')
      .update({ status: 'SHIPPED', updated_at: new Date().toISOString() })
      .eq('id', payment.trade_id)
      .eq('status', 'POINTS_HELD')
      .select('id');

    if (!Array.isArray(moved) || moved.length === 0) {
      // Ödeme alındı ama takas beklenen durumda değildi. Para ile takas
      // arasında bir tutarsızlık var; sessizce geçilmez.
      console.error(
        `[iyzico-callback] ödeme PAID ama takas POINTS_HELD değildi: trade=${payment.trade_id}`,
      );
    }
    // TODO: kargo aggregator API'sinden etiket üret (carrier_cost ile)
    // TODO: bildirim gönder (alıcı + satıcı)
  }

  return redirect(paid ? 'success' : 'failure', payment.trade_id);
});
