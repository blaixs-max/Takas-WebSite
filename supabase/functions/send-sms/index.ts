/**
 * send-sms — Supabase Auth "Send SMS Hook"
 *
 * Telefon ile giriş/doğrulamada Supabase OTP üretir ve bu fonksiyonu çağırır;
 * fonksiyon SMS'i NetGSM OTP API'siyle gönderir. OTP doğrulamasını Supabase yapar.
 *
 * Güvenlik:
 *  - Hook isteği "standard webhooks" imzasıyla doğrulanır (SEND_SMS_HOOK_SECRET).
 *  - NetGSM kullanıcı/şifre/başlık YALNIZCA burada (backend) bulunur.
 *
 * Kurulum: Supabase Dashboard → Authentication → Hooks → "Send SMS" → bu fonksiyonun URL'i.
 */

const NETGSM_BASE = Deno.env.get('NETGSM_BASE_URL') ?? 'https://api.netgsm.com.tr';
const NETGSM_USERCODE = Deno.env.get('NETGSM_USERCODE') ?? '';
const NETGSM_PASSWORD = Deno.env.get('NETGSM_PASSWORD') ?? '';
const NETGSM_HEADER = Deno.env.get('NETGSM_HEADER') ?? ''; // onaylı başlık (sender ID)
const HOOK_SECRET = Deno.env.get('SEND_SMS_HOOK_SECRET') ?? ''; // "v1,whsec_..."

/* ----- standard webhooks imza doğrulama ----- */
async function verifySignature(headers: Headers, body: string): Promise<boolean> {
  if (!HOOK_SECRET) return true; // dev: secret yoksa atla
  const id = headers.get('webhook-id');
  const ts = headers.get('webhook-timestamp');
  const sigHeader = headers.get('webhook-signature');
  if (!id || !ts || !sigHeader) return false;

  const secretB64 = HOOK_SECRET.replace(/^v1,whsec_/, '').replace(/^whsec_/, '');
  const keyBytes = Uint8Array.from(atob(secretB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = `${id}.${ts}.${body}`;
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  // header: "v1,<sig> v1,<sig2> ..."
  return sigHeader.split(' ').some((p) => p.split(',')[1] === expected);
}

/* ----- NetGSM OTP gönderimi ----- */
async function sendOtp(phone: string, message: string): Promise<{ ok: boolean; raw: string }> {
  const no = phone.replace(/^\+/, ''); // E.164 "+9055..." -> "9055..."
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<mainbody><header>` +
    `<usercode>${NETGSM_USERCODE}</usercode>` +
    `<password>${NETGSM_PASSWORD}</password>` +
    `<msgheader>${NETGSM_HEADER}</msgheader>` +
    `</header><body><msg><![CDATA[${message}]]></msg><no>${no}</no></body></mainbody>`;

  const res = await fetch(`${NETGSM_BASE}/sms/send/otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: xml,
  });
  const raw = (await res.text()).trim();
  const code = raw.split(/\s+/)[0]; // başarı: "0 <jobid>"
  return { ok: code === '0' || code === '00', raw };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const body = await req.text();
  if (!(await verifySignature(req.headers, body))) {
    return new Response(JSON.stringify({ error: 'Geçersiz imza' }), { status: 401 });
  }

  let payload: { user?: { phone?: string }; sms?: { otp?: string } };
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response(JSON.stringify({ error: 'Geçersiz gövde' }), { status: 400 });
  }

  const phone = payload.user?.phone;
  const otp = payload.sms?.otp;
  if (!phone || !otp) {
    return new Response(JSON.stringify({ error: 'phone/otp eksik' }), { status: 400 });
  }

  if (!NETGSM_USERCODE || !NETGSM_PASSWORD || !NETGSM_HEADER) {
    return new Response(JSON.stringify({ error: 'NetGSM yapılandırılmadı' }), { status: 500 });
  }

  const message = `KIDS TRADE doğrulama kodunuz: ${otp}`;
  const result = await sendOtp(phone, message);

  if (!result.ok) {
    return new Response(JSON.stringify({ error: 'SMS gönderilemedi', detail: result.raw }), { status: 502 });
  }
  return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
