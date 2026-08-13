import * as WebBrowser from 'expo-web-browser';
import { supabase, supabaseConfigured } from './supabase';
import { PAYMENT_RETURN_URL } from './brand';

/**
 * Kargo bedeli ödemesi.
 *
 * Zincirin bu halkası yoktu: takas açılıp puan havuza alınıyordu ama alıcının
 * kargo bedelini ödeyeceği bir yer yoktu. Ödeme penceresi dolunca takas
 * kendiliğinden iade oluyordu — kullanıcı hiçbir yanlış yapmadan.
 *
 * Tutar burada HESAPLANMAZ. `cargo-payment-init` desi kademesinden ve ücret
 * ayarlarından türetir; buradan yalnızca takas kimliği ve fatura bilgisi gider.
 */

export interface BuyerInfo {
  name: string;
  surname: string;
  email: string;
  gsmNumber?: string;
  /** iyzico fatura için istiyor. Saklanmıyor — yalnızca bu istekte iletiliyor. */
  identityNumber: string;
  address: string;
  city: string;
}

export interface Breakdown {
  sizeClass: string;
  shipping: number;
  serviceFee: number;
  transactionFee: number;
  total: number;
}

export type InitResult =
  | { ok: true; paymentPageUrl: string; breakdown: Breakdown }
  | { ok: false; message: string };

/** Ödemeyi başlatır ve iyzico ödeme sayfasının adresini döner. */
export async function initCargoPayment(tradeId: string, buyer: BuyerInfo): Promise<InitResult> {
  if (!supabaseConfigured || !supabase) return { ok: false, message: 'Sunucu bağlantısı yok.' };

  const { data, error } = await supabase.functions.invoke('cargo-payment-init', {
    body: { tradeId, buyer },
  });

  if (error) {
    // Edge Function hata gövdesini okumaya çalış: sunucunun yazdığı Türkçe
    // mesaj, genel "bir şeyler ters gitti"den her zaman daha yararlı.
    let sunucu = '';
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        sunucu = String((await ctx.json())?.error ?? '');
      } catch {
        /* gövde okunamadı, genel mesaja düşülür */
      }
    }
    return { ok: false, message: sunucu || 'Ödeme başlatılamadı. Tekrar deneyin.' };
  }

  if (!data?.paymentPageUrl) {
    return { ok: false, message: 'Ödeme sayfası alınamadı.' };
  }
  return { ok: true, paymentPageUrl: data.paymentPageUrl, breakdown: data.breakdown as Breakdown };
}

export type CheckoutOutcome = 'success' | 'failure' | 'cancelled' | 'unknown';

/**
 * Ödeme sayfasını sistem tarayıcısında açar ve dönüşü bekler.
 *
 * Uygulama içi WebView yerine `openAuthSessionAsync`: 3D Secure akışı banka
 * sayfalarına atlıyor ve kart bilgisi uygulamanın kendi WebView'ünden geçmiyor.
 * Dönüş `PAYMENT_RETURN_URL` derin bağlantısıyla yakalanıyor (bkz. lib/brand.ts).
 *
 * DİKKAT: buradan dönen sonuç bilgilendirmedir, kanıt değildir. Ödemenin
 * gerçekten alındığını iyzico'ya RETRIEVE ile doğrulayan `iyzico-callback`
 * belirler. Ekran her durumda sunucudan tazelemelidir.
 */
export async function openCheckout(paymentPageUrl: string): Promise<CheckoutOutcome> {
  const sonuc = await WebBrowser.openAuthSessionAsync(paymentPageUrl, PAYMENT_RETURN_URL);

  if (sonuc.type === 'cancel' || sonuc.type === 'dismiss') return 'cancelled';
  if (sonuc.type !== 'success') return 'unknown';

  const durum = new URL(sonuc.url).searchParams.get('status');
  if (durum === 'success') return 'success';
  if (durum === 'failure') return 'failure';
  return 'unknown';
}
