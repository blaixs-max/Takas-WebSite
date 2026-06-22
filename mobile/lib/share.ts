import { Share } from 'react-native';

/**
 * Ürünü sistem paylaşım menüsüyle paylaşır (WhatsApp, mesaj, e-posta vb.).
 * RN native Share sheet kullanıldığından telefonda yüklü tüm uygulamalar çıkar.
 */
export async function shareProduct(p: { id: string; title: string; points: number }): Promise<void> {
  const url = `https://kidstrade.app/urun/${p.id}`;
  const message = `${p.title} — ${p.points} Takas Puanı 🧸\nKIDS TRADE'de takasta:\n${url}`;
  try {
    await Share.share({ message, url, title: p.title });
  } catch {
    // kullanıcı iptal etti veya paylaşım yok — sessizce geç
  }
}
