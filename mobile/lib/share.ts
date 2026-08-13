import { Share } from 'react-native';
import { productShareText } from './brand';

/**
 * Ürünü sistem paylaşım menüsüyle paylaşır (WhatsApp, mesaj, e-posta vb.).
 * RN native Share sheet kullanıldığından telefonda yüklü tüm uygulamalar çıkar.
 *
 * Metin ve adres `lib/brand.ts`ten geliyor; marka adı burada yazılı değil.
 * `url` alanı bilerek geçilmiyor: iOS onu ayrı bir bağlantı olarak gösterir ve
 * ürünün kendi sayfasıymış gibi okunur — öyle bir sayfa henüz yok.
 */
export async function shareProduct(p: { id: string; title: string; points: number }): Promise<void> {
  try {
    await Share.share({ message: productShareText(p), title: p.title });
  } catch {
    // kullanıcı iptal etti veya paylaşım yok — sessizce geç
  }
}
