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

/** Kullanıcıyı uygulamaya geri gönderir. */
function redirect(status: 'success' | 'failure', tradeId: string) {
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

  const { data: payment } = await supabase
    .from('cargo_payments')
    .select('id, conversation_id, status')
    .eq('token', token)
    .single();

  if (!payment) return new Response('ödeme bulunamadı', { status: 404 });

  // ---- İdempotency: bu ödeme zaten sonuçlandıysa tekrar işleme ------------
  // iyzico callback'i yeniden gönderir. İkinci teslimde yapılacak bir şey yok;
  // kullanıcı yine doğru ekrana döner.
  if (payment.status === 'PAID') return redirect('success', payment.conversation_id);
  if (payment.status === 'FAILED') return redirect('failure', payment.conversation_id);

  // ---- Gerçek sonucu iyzico'dan doğrula ----------------------------------
  const result = await retrieveCheckoutForm(token, payment.conversation_id);
  const paid = result.status === 'success' && result.paymentStatus === 'SUCCESS';

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
      .eq('id', payment.conversation_id)
      .eq('status', 'POINTS_HELD')
      .select('id');

    if (!Array.isArray(moved) || moved.length === 0) {
      // Ödeme alındı ama takas beklenen durumda değildi. Para ile takas
      // arasında bir tutarsızlık var; sessizce geçilmez.
      console.error(
        `[iyzico-callback] ödeme PAID ama takas POINTS_HELD değildi: trade=${payment.conversation_id}`,
      );
    }
    // TODO: kargo aggregator API'sinden etiket üret (carrier_cost ile)
    // TODO: bildirim gönder (alıcı + satıcı)
  }

  return redirect(paid ? 'success' : 'failure', payment.conversation_id);
});
