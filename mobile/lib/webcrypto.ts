import * as ExpoCrypto from 'expo-crypto';

/**
 * Hermes'te WebCrypto yok — PKCE'yi ayağa kaldıran yama.
 *
 * supabase-js, PKCE meydan okumasını üretmek için `crypto.subtle.digest`
 * arar. Hermes'te bulamayınca sessizce `plain` yöntemine düşer ve konsola
 * bir uyarı basar. `plain`de code_verifier ile code_challenge AYNI değerdir;
 * yani PKCE'nin koruduğu şey korunmaz. `kidstrade://` şemasını kendi adına
 * kaydeden başka bir uygulama yetkilendirme kodunu yakalarsa, doğrulayıcıyı
 * da elde etmiş olur ve oturumu kendi üzerine alır.
 *
 * expo-crypto yerel SHA-256 sağlıyor; eksik olan tek şey WebCrypto arayüzü.
 * Bu dosya o arayüzü kuruyor. Supabase istemcisi oluşturulmadan ÖNCE
 * çalışmalıdır — `lib/supabase.ts` ilk satırlarında içe aktarılır.
 *
 * Yalnızca eksik olan doldurulur: gerçek bir WebCrypto varsa dokunulmaz.
 * Tip zorlamaları burada kaçınılmaz — global nesneye çalışma anında bir
 * yetenek ekliyoruz ve TypeScript'in DOM tipleri bunu ifade edemiyor.
 */

const g = globalThis as unknown as {
  crypto?: {
    subtle?: { digest?: unknown };
    getRandomValues?: unknown;
  };
};

if (!g.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: {}, writable: true, configurable: true });
}

const c = g.crypto!;

if (!c.getRandomValues) {
  c.getRandomValues = ExpoCrypto.getRandomValues;
}

if (!c.subtle?.digest) {
  const digest = async (algorithm: unknown, data: BufferSource): Promise<ArrayBuffer> => {
    const ad = (
      typeof algorithm === 'string' ? algorithm : (algorithm as { name?: string })?.name
    )?.toUpperCase();

    // supabase-js yalnızca SHA-256 istiyor. Başka bir algoritma gelirse
    // yanlış özet üretmektense hata veriyoruz: sessiz yanlış, gürültülü
    // hatadan çok daha pahalıya patlar.
    if (ad !== 'SHA-256') {
      throw new Error(`webcrypto yaması yalnızca SHA-256 destekler (istenen: ${String(ad)})`);
    }

    const bytes =
      data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

    return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, bytes);
  };

  if (c.subtle) {
    c.subtle.digest = digest;
  } else {
    c.subtle = { digest };
  }
}
