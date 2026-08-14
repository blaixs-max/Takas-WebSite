import { ImageSourcePropType } from 'react-native';

/**
 * Görsel kayıt defteri: Supabase'deki image_key değerini paketli (bundled)
 * görsele eşler. require() statik yol gerektirdiği için görseller uygulamada
 * gömülüdür; tablo yalnızca anahtarı tutar.
 */
export const PRODUCT_IMAGES: Record<string, ImageSourcePropType> = {
  'wooden-blocks': require('../assets/products/product-wooden-blocks.jpg'),
  'wooden-close': require('../assets/products/product-wooden-close.jpg'),
  'color-sorter': require('../assets/products/product-color-sorter.jpg'),
  'montessori-rings': require('../assets/products/product-montessori-rings.jpg'),
  'rings-close': require('../assets/products/product-rings-close.jpg'),
  'hero': require('../assets/products/hero-main-game.jpg'),

  /* Tasarım paketinin dört fotoğrafı (`tasarim/photos_4k/`). 3840×2160
     kaynaklardan kullanıldıkları yerin oranına göre kırpıldı; `cover` zaten
     kırpardı ama kadrajı gözetmeden, ortadan. */
  'montessori-set': require('../assets/products/urun-montessori-set.jpg'),
  'puset': require('../assets/products/urun-puset.jpg'),
  'kitap-seti': require('../assets/products/urun-kitap-seti.jpg'),
};

const FALLBACK = PRODUCT_IMAGES['wooden-blocks'];

export function resolveImage(key?: string | null): ImageSourcePropType {
  return (key && PRODUCT_IMAGES[key]) || FALLBACK;
}

export function resolveGallery(keys?: string[] | null): ImageSourcePropType[] {
  if (!keys || keys.length === 0) return [FALLBACK];
  return keys.map(resolveImage);
}

/**
 * Görseli olmayan (ya da imzalı bağlantısı üretilemeyen) ilan için boş kaynak.
 *
 * Bilerek paketli bir demo görsele düşmüyoruz: gerçek bir ilanın kapağına
 * başka bir ürünün stok fotoğrafını koymak, eksik görselden daha kötüdür —
 * kullanıcı satıcının çektiği kareyi gördüğünü sanır.
 */
export const EMPTY_IMAGE: ImageSourcePropType = { uri: '' };
