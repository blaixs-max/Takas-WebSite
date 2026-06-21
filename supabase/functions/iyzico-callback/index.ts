/**
 * iyzico-callback
 *
 * iyzico, ödeme tamamlanınca callbackUrl'e `token` POST eder
 * (application/x-www-form-urlencoded). Bu fonksiyon:
 *  1. token'ı alır
 *  2. iyzico'ya RETRIEVE çağrısı yapıp ödemenin GERÇEK sonucunu doğrular
 *     (callback gövdesine asla güvenilmez)
 *  3. cargo_payments kaydını PAID/FAILED olarak günceller
 *  4. Başarılıysa: kargo etiketi üretimi + puan akışı (HOLD→RELEASE) tetiklenir
 *
 * Komisyon, init aşamasında zaten sabitlendi; burada yalnızca tahsilat doğrulanır.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { retrieveCheckoutForm } from '../_shared/iyzico.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_RETURN_URL = Deno.env.get('APP_RETURN_URL') ?? 'kidstrade://payment-result';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // iyzico token'ı form-encoded gönderir
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

  // token → ilgili ödeme kaydı
  const { data: payment } = await supabase
    .from('cargo_payments')
    .select('id, conversation_id, status')
    .eq('token', token)
    .single();

  if (!payment) return new Response('ödeme bulunamadı', { status: 404 });

  // GERÇEK sonucu iyzico'dan doğrula
  const result = await retrieveCheckoutForm(token, payment.conversation_id);
  const paid = result.status === 'success' && result.paymentStatus === 'SUCCESS';

  await supabase
    .from('cargo_payments')
    .update({
      status: paid ? 'PAID' : 'FAILED',
      iyzico_payment_id: result.paymentId ?? null,
      paid_at: paid ? new Date().toISOString() : null,
    })
    .eq('id', payment.id);

  if (paid) {
    // Takası ilerlet: puan havuzdan akışa girer, kargo etiketi üretilir.
    await supabase
      .from('trades')
      .update({ status: 'SHIPPED' })
      .eq('id', payment.conversation_id);
    // TODO: kargo aggregator API'sinden etiket üret (carrier_cost ile)
    // TODO: bildirim gönder (alıcı + satıcı)
  }

  // Kullanıcıyı uygulamaya geri yönlendir (deep link)
  const redirect = `${APP_RETURN_URL}?status=${paid ? 'success' : 'failure'}&trade=${payment.conversation_id}`;
  return new Response(null, { status: 302, headers: { Location: redirect } });
});
