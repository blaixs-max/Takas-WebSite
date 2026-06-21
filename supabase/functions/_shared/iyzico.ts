/**
 * iyzico API istemcisi (Deno / Supabase Edge Function).
 *
 * Kimlik doğrulama: IYZWSv2 (HMAC-SHA256).
 *   signature = HMAC_SHA256_hex(secretKey, randomKey + uriPath + requestBody)
 *   Authorization: "IYZWSv2 " + base64("apiKey:<>&randomKey:<>&signature:<>")
 *   x-iyzi-rnd: randomKey
 *
 * NOT: requestBody, imzalanan string ile birebir aynı olmalı; bu yüzden
 * JSON tek kez serialize edilir ve hem imzada hem gövdede o string kullanılır.
 *
 * Bu dosya YALNIZCA backend'de çalışır — secret key asla mobil istemciye konmaz.
 */

const BASE_URL = Deno.env.get('IYZICO_BASE_URL') ?? 'https://sandbox-api.iyzipay.com';
const API_KEY = Deno.env.get('IYZICO_API_KEY') ?? '';
const SECRET_KEY = Deno.env.get('IYZICO_SECRET_KEY') ?? '';

/** HMAC-SHA256, hex string döner (Web Crypto). */
async function hmacSha256Hex(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomKey(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 12);
}

/** IYZWSv2 Authorization header'ı ve x-iyzi-rnd üretir. */
async function buildAuthHeaders(uriPath: string, body: string) {
  const rnd = randomKey();
  const signature = await hmacSha256Hex(SECRET_KEY, rnd + uriPath + body);
  const authString = `apiKey:${API_KEY}&randomKey:${rnd}&signature:${signature}`;
  const authorization = `IYZWSv2 ${btoa(authString)}`;
  return {
    Authorization: authorization,
    'x-iyzi-rnd': rnd,
    'Content-Type': 'application/json',
  };
}

async function post<T>(uriPath: string, payload: Record<string, unknown>): Promise<T> {
  if (!API_KEY || !SECRET_KEY) {
    throw new Error('IYZICO_API_KEY / IYZICO_SECRET_KEY tanımlı değil');
  }
  const body = JSON.stringify(payload);
  const headers = await buildAuthHeaders(uriPath, body);
  const res = await fetch(BASE_URL + uriPath, { method: 'POST', headers, body });
  const json = await res.json();
  return json as T;
}

/* ----------------------------- Tipler ----------------------------- */

export interface Address {
  contactName: string;
  city: string;
  country: string;
  address: string;
  zipCode?: string;
}

export interface Buyer {
  id: string;
  name: string;
  surname: string;
  gsmNumber?: string;
  email: string;
  identityNumber: string; // TCKN (sandbox'ta test değeri yeterli)
  registrationAddress: string;
  city: string;
  country: string;
  ip: string;
  zipCode?: string;
}

export interface InitCheckoutFormParams {
  conversationId: string; // trade_id
  /** Alıcıdan tahsil edilecek toplam kargo bedeli (komisyon dahil). */
  price: string;
  callbackUrl: string;
  buyer: Buyer;
  shippingAddress: Address;
  billingAddress: Address;
  /** Sepet kalemi adı, ör. "Kargo hizmeti — MNG". */
  itemName: string;
}

export interface InitCheckoutFormResult {
  status: 'success' | 'failure';
  errorMessage?: string;
  token?: string;
  checkoutFormContent?: string; // WebView'e gömülecek script
  paymentPageUrl?: string; // veya bu URL'e yönlendir
  tokenExpireTime?: number;
  conversationId?: string;
}

export interface RetrieveResult {
  status: 'success' | 'failure';
  paymentStatus?: 'SUCCESS' | 'FAILURE' | 'INIT_THREEDS' | 'CALLBACK_THREEDS' | 'BKM_POS_SELECTED';
  errorMessage?: string;
  paymentId?: string;
  price?: string;
  paidPrice?: string;
  currency?: string;
  fraudStatus?: number;
  conversationId?: string;
}

/* --------------------------- Endpoint'ler -------------------------- */

const PATH_INIT = '/payment/iyzipos/checkoutform/initialize/auth/ecom';
const PATH_RETRIEVE = '/payment/iyzipos/checkoutform/auth/ecom/detail';

/**
 * Checkout Form başlatır (kargo ücreti tahsilatı).
 * paymentGroup = LISTING: pazaryeri/alt-üye yok, ürün onayı (escrow) yok —
 * platform tek üye işyeri olarak hizmet bedelini tahsil eder.
 */
export function initializeCheckoutForm(p: InitCheckoutFormParams): Promise<InitCheckoutFormResult> {
  return post<InitCheckoutFormResult>(PATH_INIT, {
    locale: 'tr',
    conversationId: p.conversationId,
    price: p.price,
    paidPrice: p.price,
    currency: 'TRY',
    basketId: p.conversationId,
    paymentGroup: 'LISTING',
    callbackUrl: p.callbackUrl,
    enabledInstallments: [1],
    buyer: p.buyer,
    shippingAddress: p.shippingAddress,
    billingAddress: p.billingAddress,
    basketItems: [
      {
        id: 'CARGO',
        name: p.itemName,
        category1: 'Kargo',
        itemType: 'PHYSICAL',
        price: p.price,
      },
    ],
  });
}

/**
 * Callback'te dönen token ile ödemenin GERÇEK sonucunu sorgular.
 * Callback gövdesine güvenmeyip her zaman bu doğrulamayı yapın.
 */
export function retrieveCheckoutForm(token: string, conversationId: string): Promise<RetrieveResult> {
  return post<RetrieveResult>(PATH_RETRIEVE, {
    locale: 'tr',
    conversationId,
    token,
  });
}
