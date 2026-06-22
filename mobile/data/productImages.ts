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
};

const FALLBACK = PRODUCT_IMAGES['wooden-blocks'];

export function resolveImage(key?: string | null): ImageSourcePropType {
  return (key && PRODUCT_IMAGES[key]) || FALLBACK;
}

export function resolveGallery(keys?: string[] | null): ImageSourcePropType[] {
  if (!keys || keys.length === 0) return [FALLBACK];
  return keys.map(resolveImage);
}
