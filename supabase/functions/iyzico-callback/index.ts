/**
 * iyzico-callback
 *
 * iyzico ödeme tamamlanınca callbackUrl'e `token` POST eder. Bu fonksiyon
 * token'ı alır ve sonucu iyzico'ya RETRIEVE ile doğrular — gövdeye asla
 * güvenilmez.
 *
 * ## 2026-09-08: takastan ayrıldı, puan satışı için yuva
 *
 * 2026-09-08'e kadar bu uç **kargo bedelinin** tahsilatını kapatıyordu:
 * `cargo_payments` satırını PAID yapıyor ve takası POINTS_HELD → SHIPPED
 * taşıyordu. O akış kalktı — alıcı artık TL ödemiyor, kargoyu satıcı kendi
 * cebinden gönderiyor ve `mark_shipped()` ile takip numarası giriyor.
 * `cargo-payment-init` silindi, `payment.tsx` silindi, `cargo_payments`
 * tablosu yalnızca geçmiş kayıt olarak duruyor.
 *
 * iyzico'nun kalan tek işi **kredi kartıyla puan satışı** (Ana Doküman v2.0
 * §3) ve o satışın nereden yapılacağı (web mini-site mi, uygulama içi mi)
 * henüz karara bağlanmadı. Bu fonksiyon o karar verilince dolacak yuva:
 * imza şeması, RETRIEVE doğrulaması, tutar kontrolü ve idempotency kalıbı
 * burada hazır; eksik olan tek şey sonucu yazacağı tablo.
 *
 * Bugün yaptığı: token'ı doğrular, sonucu **günlüğe** yazar ve 200 döner.
 * Hiçbir tabloya yazmaz, hiçbir takasa dokunmaz. Kimse checkout başlatmadığı
 * için çağrılması da beklenmiyor; çağrılırsa bu bir uyarıdır.
 *
 * ## Yuva dolarken korunacak üç kural
 *
 *  1. **İdempotency.** iyzico callback'i yeniden gönderir; işlenmiş ödeme
 *     erken döner, iki kez puan basılmaz.
 *  2. **"Başarılı mı" yetmez, "ne kadar" da sorulur.** `paidPrice` bizim
 *     satırımızdaki tutarla karşılaştırılır; tutmuyorsa FAILED YAZILMAZ —
 *     para hareket etmiştir, kayıt PENDING kalır, kararı insan verir.
 *  3. **Durum makinesi yalnızca ileri gider.** `update … where status =
 *     'PENDING'` — iki callback yarışırsa biri boşa düşer.
 *
 * NOT: Bu fonksiyon JWT doğrulaması OLMADAN dağıtılmalıdır — iyzico bir
 * Supabase oturumu taşıyamaz. Güvenlik token'ın gizliliğine ve RETRIEVE
 * doğrulamasına dayanır. Bkz. supabase/config.toml.
 */
import { retrieveCheckoutForm } from '../_shared/iyzico.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let token = '';
  let conversationId = '';
  try {
    const form = await req.formData();
    token = String(form.get('token') ?? '');
    conversationId = String(form.get('conversationId') ?? '');
  } catch {
    try {
      const body = await req.json();
      token = body.token ?? '';
      conversationId = body.conversationId ?? '';
    } catch {
      /* yoksay */
    }
  }
  if (!token) return new Response('token yok', { status: 400 });

  /* Puan satışı açık değil; bu çağrı beklenmiyor. Yine de doğruluyoruz:
     gelen şey gerçek bir iyzico sonucuysa günlükte paymentId ve tutar durur
     ve bir insan onu bulabilir. Doğrulanamayan token'a da 200 dönüyoruz —
     bu uç iyzico'ya bakıyor, ona 4xx dönmenin bir faydası yok ve token'ın
     geçerliliği hakkında dışarıya bilgi vermek istemiyoruz. */
  try {
    const result = await retrieveCheckoutForm(token, conversationId);
    console.warn(
      '[iyzico-callback] puan satışı henüz açık değil; doğrulanan sonuç yalnızca günlüğe yazıldı',
      JSON.stringify({
        conversationId,
        status: result.status,
        paymentStatus: result.paymentStatus,
        paymentId: result.paymentId ?? null,
        paidPrice: result.paidPrice ?? result.price ?? null,
      }),
    );
  } catch (e) {
    console.error('[iyzico-callback] RETRIEVE başarısız', conversationId, String(e));
  }

  return new Response(JSON.stringify({ ok: true, kayit: 'yok' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
