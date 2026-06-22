import { ImageSourcePropType } from 'react-native';
import { resolveImage, resolveGallery } from './productImages';
import { Category } from './categories';

export type Condition = 'İyi durumda' | 'Az kullanılmış' | 'Yeni gibi';
export type { Category };

export interface Product {
  id: string;
  title: string;
  points: number;
  condition: Condition;
  category: Category;
  location: string;
  distanceKm: number;
  rating: number;
  marketValue: string;
  badge?: string;
  seller: { name: string; initials: string; trust: number; trades: number };
  description: string;
  image: ImageSourcePropType;
  gallery: ImageSourcePropType[];
  favorite?: boolean;
}

/** Supabase satırını uygulama tipine çevirir (görseli image_key'den çözer). */
export interface ProductRow {
  id: string;
  title: string;
  points: number;
  condition: Condition;
  category: Category;
  location: string;
  distance_km: number;
  rating: number;
  market_value: string | null;
  badge: string | null;
  description: string | null;
  image_key: string;
  gallery_keys: string[] | null;
  seller_name: string;
  seller_initials: string;
  seller_trust: number;
  seller_trades: number;
}

export function rowToProduct(r: ProductRow): Product {
  return {
    id: r.id,
    title: r.title,
    points: r.points,
    condition: r.condition,
    category: r.category,
    location: r.location,
    distanceKm: Number(r.distance_km),
    rating: Number(r.rating),
    marketValue: r.market_value ?? '',
    badge: r.badge ?? undefined,
    description: r.description ?? '',
    image: resolveImage(r.image_key),
    gallery: resolveGallery(r.gallery_keys),
    seller: { name: r.seller_name, initials: r.seller_initials, trust: r.seller_trust, trades: r.seller_trades },
  };
}

/** Anahtar/oturum yokken kullanılan demo ilanlar (seed ile aynı). */
export const DEMO_PRODUCTS: Product[] = [
  {
    id: 'blocks',
    title: 'Montessori ahşap blok seti',
    points: 420,
    condition: 'Az kullanılmış',
    category: 'Oyuncak',
    location: 'Kadıköy',
    distanceKm: 2.4,
    rating: 4.9,
    marketValue: '~520–610 ₺',
    badge: 'Popüler',
    seller: { name: 'Zeynep D.', initials: 'ZD', trust: 96, trades: 38 },
    description:
      'Doğal kayın ağacından, 48 parçalık geometrik blok seti. 2 yıl kullanıldı, boyası dökülmemiş. Orijinal ahşap kutusuyla birlikte gönderilir.',
    image: resolveImage('wooden-blocks'),
    gallery: resolveGallery(['wooden-blocks', 'wooden-close', 'rings-close', 'color-sorter']),
  },
  {
    id: 'sorter',
    title: 'Ahşap renk ayırma oyunu',
    points: 260,
    condition: 'İyi durumda',
    category: 'Oyuncak',
    location: 'Beşiktaş',
    distanceKm: 5.1,
    rating: 4.7,
    marketValue: '~300–360 ₺',
    seller: { name: 'Murat K.', initials: 'MK', trust: 91, trades: 22 },
    description:
      'El becerisi ve renk eşleştirme için ahşap sıralama oyunu. Tüm parçalar tam, küçük kullanım izleri mevcut.',
    image: resolveImage('color-sorter'),
    gallery: resolveGallery(['color-sorter', 'wooden-close', 'wooden-blocks']),
  },
  {
    id: 'rings',
    title: 'Montessori halka kulesi',
    points: 340,
    condition: 'Yeni gibi',
    category: 'Oyuncak',
    location: 'Üsküdar',
    distanceKm: 3.8,
    rating: 5.0,
    marketValue: '~400–470 ₺',
    badge: 'Editör seçimi',
    seller: { name: 'Elif T.', initials: 'ET', trust: 98, trades: 51 },
    description:
      'Doğal boyalı ahşap halka kulesi. Neredeyse hiç kullanılmadı, kutusunda. Bebek ve yürüme dönemi için ideal.',
    image: resolveImage('montessori-rings'),
    gallery: resolveGallery(['montessori-rings', 'rings-close', 'wooden-blocks']),
    favorite: true,
  },
  {
    id: 'rings-natural',
    title: 'Doğal ahşap denge halkaları',
    points: 300,
    condition: 'Az kullanılmış',
    category: 'Oyuncak',
    location: 'Şişli',
    distanceKm: 6.7,
    rating: 4.8,
    marketValue: '~350–410 ₺',
    seller: { name: 'Can A.', initials: 'CA', trust: 89, trades: 17 },
    description:
      'Doğal yağ ile cilalanmış denge ve istifleme halkaları. Hafif kullanım izi var, tüm parçalar mevcut.',
    image: resolveImage('rings-close'),
    gallery: resolveGallery(['rings-close', 'montessori-rings', 'wooden-close']),
  },
];
