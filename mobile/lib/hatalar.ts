import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase, supabaseConfigured } from './supabase';

/**
 * Hata izleme.
 *
 * Canlıdaki bir JS çökmesinden bugüne kadar **hiç haberimiz olmuyordu**: ne
 * hata sınırı ne küresel yakalayıcı vardı. Ekran beyaza düşüyor, kullanıcı
 * uygulamayı kapatıyor, biz bir şey görmüyoruz — o da anlatamıyor, "açılmadı"
 * diyor.
 *
 * ## Neden Sentry değil
 *
 * Sentry doğru araç ama bugün kurulamıyor: `@sentry/react-native` bir native
 * modül ve uygulama Expo Go'dan çalışıyor. Bu dosya o boşluğu dolduruyor ve
 * Sentry'nin yerini almıyor — EAS build yapıldığında hedefi değiştirmek
 * yalnızca burayı değiştirmek olacak. Çağıran yerlerin hiçbiri nereye
 * yazıldığını bilmiyor.
 *
 * ## Ne gönderiliyor, ne gönderilmiyor
 *
 * Yığın izi, ekran adı, platform ve sürüm gidiyor. **Kullanıcının girdiği
 * metin gitmiyor** ve `ek` alanına ne konacağına çağıran yer karar veriyor —
 * oraya serbestçe veri dökülmüyor. Sunucu ayrıca mesajı 2 KB'a kırpıyor.
 */

/** Aynı hatayı yüz kez almak yüz satır olmamalı. */
function parmakIzi(mesaj: string, yigin: string | undefined, ekran: string): string {
  /* Yığının ilk iki karesi genelde hatayı ayırt etmeye yetiyor; tamamı ise
     kaydırılmış satır numaraları yüzünden her sürümde değişir ve aynı hata
     yeni bir kayıt olarak açılırdı. */
  const kareler = (yigin ?? '')
    .split('\n')
    .slice(1, 3)
    .map((s) => s.trim().replace(/:\d+:\d+\)?$/, ''))
    .join('|');

  /* Sayılar mesajdan çıkarılıyor: "Ürün 4821 bulunamadı" ile "Ürün 913
     bulunamadı" aynı hata. Kimlikler de aynı sebeple düşüyor. */
  const govde = mesaj.replace(/\d+/g, '#').slice(0, 200);
  return `${ekran}::${govde}::${kareler}`.slice(0, 128);
}

function platform(): string {
  if (Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web') {
    return Platform.OS;
  }
  return 'bilinmiyor';
}

/** Kullanıcının o an bulunduğu ekran; yönlendirici bunu güncelliyor. */
let aktifEkran = 'bilinmiyor';
export function ekranBildir(ad: string): void {
  aktifEkran = ad || 'bilinmiyor';
}

/**
 * Bir hatayı sunucuya bildirir.
 *
 * **Hiçbir zaman fırlatmaz.** Bildirimin kendisi hata verirse kullanıcının
 * gördüğü şey ikinci bir çökme olurdu; bu fonksiyonun görevi haber vermek,
 * akışa karışmak değil.
 */
export async function hataBildir(
  hata: unknown,
  ek?: Record<string, unknown>,
): Promise<void> {
  try {
    if (!supabaseConfigured || !supabase) return;

    const e = hata instanceof Error ? hata : new Error(String(hata));
    const mesaj = `${e.name}: ${e.message}`.slice(0, 2048);
    const yigin = e.stack?.slice(0, 8192);

    await supabase.rpc('hata_bildir', {
      p_platform: platform(),
      p_mesaj: mesaj,
      p_parmak_izi: parmakIzi(mesaj, yigin, aktifEkran),
      p_ekran: aktifEkran,
      p_yigin: yigin ?? null,
      p_surum: Constants.expoConfig?.version ?? null,
      p_ek: ek ?? null,
    });
  } catch {
    // Yut. Bildirim başarısız oldu diye akış bozulmamalı.
  }
}

/**
 * Yakalanmamış hataları da bildirir.
 *
 * `ErrorUtils` React Native'in küresel yakalayıcısı ve **hata sınırının
 * göremediği yeri** kapatıyor: `ErrorBoundary` yalnızca çizim sırasındaki
 * hataları yakalıyor, `setTimeout` içindeki ya da bir `Promise` içindeki
 * hatayı görmüyor.
 *
 * Önceki yakalayıcı **korunuyor ve çağrılıyor**: RN'in kendi yakalayıcısı
 * geliştirmede kırmızı ekranı çiziyor. Onu değiştirmek, hata ayıklamayı
 * kapatmak olurdu.
 */
export function kureselYakalayiciyiKur(): void {
  const g = globalThis as { ErrorUtils?: {
    getGlobalHandler?: () => (e: unknown, olumcul?: boolean) => void;
    setGlobalHandler?: (h: (e: unknown, olumcul?: boolean) => void) => void;
  } };

  const eu = g.ErrorUtils;
  if (!eu?.setGlobalHandler) return;

  const onceki = eu.getGlobalHandler?.();
  eu.setGlobalHandler((e, olumcul) => {
    void hataBildir(e, { olumcul: Boolean(olumcul), kaynak: 'kuresel' });
    onceki?.(e, olumcul);
  });
}
