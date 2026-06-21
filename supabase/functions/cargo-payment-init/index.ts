/**
 * cargo-payment-init
 *
 * Bir takasın kargo ücreti tahsilatını başlatır:
 *  1. Alıcıdan alınacak fiyat = anlaşmalı kargo maliyeti + platform komisyonu
 *  2. cargo_payments tablosuna PENDING kayıt açılır (komisyon önceden hesaplanır)
 *  3. iyzico Checkout Form başlatılır
 *  4. Mobil istemciye token + paymentPageUrl / checkoutFormContent döner
 *
 * Mobil uygulama bu token ile iyzico ödeme ekranını (WebView) açar.
 * iyzico secret key SADECE burada (backend) kullanılır.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { initializeCheckoutForm } from '../_shared/iyzico.ts';

interface Body {
  tradeId: string;
  /** Anlaşmalı taşıyıcı (kargo) maliyeti, TL. */
  carrierCost: number;
  /** Platform komisyonu, TL. */
  commission: number;
  carrierName: string; // ör. "MNG Kargo"
  buyer: {
    id: string;
    name: string;
    surname: string;
    email: string;
    gsmNumber?: string;
    identityNumber: string;
    address: string;
    city: string;
  };
  sellerId: string;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CALLBACK_URL = Deno.env.get('IYZICO_CALLBACK_URL')!; // .../functions/v1/iyzico-callback

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let b: Body;
  try {
    b = await req.json();
  } catch {
    return json({ error: 'Geçersiz JSON' }, 400);
  }

  const carrierCost = Number(b.carrierCost);
  const commission = Number(b.commission);
  if (!b.tradeId || !(carrierCost > 0) || !(commission >= 0)) {
    return json({ error: 'tradeId, carrierCost (>0) ve commission gerekli' }, 400);
  }

  const amount = +(carrierCost + commission).toFixed(2); // alıcının ödeyeceği toplam
  const priceStr = amount.toFixed(2);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 1) PENDING ödeme kaydı (komisyon önceden sabitlenir)
  const { data: payment, error: insErr } = await supabase
    .from('cargo_payments')
    .insert({
      trade_id: b.tradeId,
      buyer_id: b.buyer.id,
      seller_id: b.sellerId,
      conversation_id: b.tradeId,
      amount,
      carrier_cost: carrierCost,
      commission,
      currency: 'TRY',
      status: 'PENDING',
    })
    .select('id')
    .single();

  if (insErr) return json({ error: 'DB kaydı başarısız', detail: insErr.message }, 500);

  // 2) iyzico Checkout Form başlat
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '85.34.78.112';
  const address = { contactName: `${b.buyer.name} ${b.buyer.surname}`, city: b.buyer.city, country: 'Turkey', address: b.buyer.address };

  const result = await initializeCheckoutForm({
    conversationId: b.tradeId,
    price: priceStr,
    callbackUrl: CALLBACK_URL,
    itemName: `Kargo hizmeti — ${b.carrierName}`,
    buyer: {
      id: b.buyer.id,
      name: b.buyer.name,
      surname: b.buyer.surname,
      email: b.buyer.email,
      gsmNumber: b.buyer.gsmNumber,
      identityNumber: b.buyer.identityNumber,
      registrationAddress: b.buyer.address,
      city: b.buyer.city,
      country: 'Turkey',
      ip,
    },
    shippingAddress: address,
    billingAddress: address,
  });

  if (result.status !== 'success' || !result.token) {
    await supabase.from('cargo_payments').update({ status: 'FAILED' }).eq('id', payment.id);
    return json({ error: 'iyzico başlatma başarısız', detail: result.errorMessage }, 502);
  }

  // 3) token'ı kaydet
  await supabase.from('cargo_payments').update({ token: result.token }).eq('id', payment.id);

  return json({
    paymentId: payment.id,
    token: result.token,
    paymentPageUrl: result.paymentPageUrl,
    checkoutFormContent: result.checkoutFormContent,
    amount,
    commission,
  });
});
