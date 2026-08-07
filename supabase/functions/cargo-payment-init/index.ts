/**
 * cargo-payment-init
 *
 * Bir takasın kargo ücreti tahsilatını başlatır.
 *
 * Fiyatı SUNUCU belirler. Önceki sürümde carrierCost ve commission istek
 * gövdesinden geliyordu; istemci kendi ödeyeceği tutarı yazabiliyordu.
 * Artık tek girdi tradeId'dir ve tutar quote_trade_price() ile desi
 * kademesinden ve ücret ayarlarından türetilir.
 *
 * Çağıran da doğrulanır: yalnızca takasın ALICISI ödeme başlatabilir.
 *
 * iyzico secret key SADECE burada (backend) kullanılır.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { initializeCheckoutForm } from '../_shared/iyzico.ts';

interface Body {
  tradeId: string;
  carrierName?: string;
  /** Fatura ve kargo için gereken, tutarı etkilemeyen alanlar. */
  buyer: {
    name: string;
    surname: string;
    email: string;
    gsmNumber?: string;
    identityNumber: string;
    address: string;
    city: string;
  };
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const CALLBACK_URL = Deno.env.get('IYZICO_CALLBACK_URL')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // ---- 1) Çağıranın kimliği -------------------------------------------------
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return json({ error: 'Oturum gerekli' }, 401);

  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await asUser.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: 'Oturum geçersiz' }, 401);
  const callerId = userData.user.id;

  let b: Body;
  try {
    b = await req.json();
  } catch {
    return json({ error: 'Geçersiz JSON' }, 400);
  }
  if (!b.tradeId) return json({ error: 'tradeId gerekli' }, 400);
  if (!b.buyer?.name || !b.buyer?.surname || !b.buyer?.email || !b.buyer?.address || !b.buyer?.city) {
    return json({ error: 'Fatura bilgileri eksik' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // ---- 2) Yetki: çağıran bu takasın alıcısı mı? -----------------------------
  const { data: trade, error: tradeErr } = await supabase
    .from('trades')
    .select('id, buyer_id, seller_id, status, points')
    .eq('id', b.tradeId)
    .single();

  if (tradeErr || !trade) return json({ error: 'Takas bulunamadı' }, 404);
  if (trade.buyer_id !== callerId) {
    // Satıcı ya da üçüncü bir kişi bu takasın ödemesini başlatamaz.
    return json({ error: 'Bu takasın ödemesini yalnızca alıcısı başlatabilir' }, 403);
  }
  if (trade.status !== 'POINTS_HELD') {
    return json(
      { error: `Ödeme yalnızca puan havuza alındıktan sonra başlatılır (mevcut: ${trade.status})` },
      409,
    );
  }

  // ---- 3) Aynı takas için zaten ödeme var mı? -------------------------------
  const { data: mevcut } = await supabase
    .from('cargo_payments')
    .select('id, status, token, amount')
    .eq('trade_id', b.tradeId)
    .in('status', ['PENDING', 'PAID'])
    .maybeSingle();

  if (mevcut?.status === 'PAID') {
    return json({ error: 'Bu takasın kargo ödemesi zaten yapılmış' }, 409);
  }

  // ---- 4) Tutarı SUNUCU hesaplar -------------------------------------------
  const { data: quoteRows, error: quoteErr } = await supabase
    .rpc('quote_trade_price', { p_trade_id: b.tradeId });

  const quote = Array.isArray(quoteRows) ? quoteRows[0] : quoteRows;
  if (quoteErr || !quote) {
    return json({ error: 'Fiyat hesaplanamadı', detail: quoteErr?.message }, 500);
  }

  const amount = Number(quote.total_tl);
  const carrierCost = Number(quote.carrier_cost_tl);
  const commission = Number(quote.commission_tl);
  if (!(amount > 0)) return json({ error: 'Geçersiz fiyat' }, 500);

  // ---- 5) PENDING kayıt -----------------------------------------------------
  let paymentId = mevcut?.id;
  if (paymentId) {
    // Yarım kalmış bir deneme var: tutarı güncel fiyatla tazele, yeni kayıt açma.
    await supabase
      .from('cargo_payments')
      .update({ amount, carrier_cost: carrierCost, commission })
      .eq('id', paymentId);
  } else {
    const { data: created, error: insErr } = await supabase
      .from('cargo_payments')
      .insert({
        trade_id: b.tradeId,
        buyer_id: trade.buyer_id,
        seller_id: trade.seller_id,
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
    paymentId = created.id;
  }

  // ---- 6) iyzico Checkout Form ---------------------------------------------
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '85.34.78.112';
  const address = {
    contactName: `${b.buyer.name} ${b.buyer.surname}`,
    city: b.buyer.city,
    country: 'Turkey',
    address: b.buyer.address,
  };

  const result = await initializeCheckoutForm({
    conversationId: b.tradeId,
    price: amount.toFixed(2),
    callbackUrl: CALLBACK_URL,
    itemName: `Kargo hizmeti — ${b.carrierName ?? 'anlaşmalı kargo'}`,
    buyer: {
      id: trade.buyer_id,
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
    await supabase.from('cargo_payments').update({ status: 'FAILED' }).eq('id', paymentId);
    return json({ error: 'iyzico başlatma başarısız', detail: result.errorMessage }, 502);
  }

  await supabase.from('cargo_payments').update({ token: result.token }).eq('id', paymentId);

  return json({
    paymentId,
    token: result.token,
    paymentPageUrl: result.paymentPageUrl,
    checkoutFormContent: result.checkoutFormContent,
    // Kırılım istemciye bilgi olarak döner; hesap sunucuda yapıldı.
    breakdown: {
      sizeClass: quote.size_class,
      shipping: Number(quote.shipping_tl),
      serviceFee: Number(quote.service_fee_tl),
      transactionFee: Number(quote.transaction_fee_tl),
      total: amount,
    },
  });
});
