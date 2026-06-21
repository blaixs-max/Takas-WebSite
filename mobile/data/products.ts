import { ImageSourcePropType } from 'react-native';

export type Condition = 'İyi durumda' | 'Az kullanılmış' | 'Yeni gibi';
export type Category = 'Oyuncak' | 'Kitap' | 'Montessori' | 'Kutu oyunu';

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

const blocks = require('../assets/products/product-wooden-blocks.jpg');
const blocksClose = require('../assets/products/product-wooden-close.jpg');
const sorter = require('../assets/products/product-color-sorter.jpg');
const rings = require('../assets/products/product-montessori-rings.jpg');
const ringsClose = require('../assets/products/product-rings-close.jpg');

export const products: Product[] = [
  {
    id: 'blocks',
    title: 'Montessori ahşap blok seti',
    points: 420,
    condition: 'Az kullanılmış',
    category: 'Montessori',
    location: 'Kadıköy',
    distanceKm: 2.4,
    rating: 4.9,
    marketValue: '~520–610 ₺',
    badge: 'Popüler',
    seller: { name: 'Zeynep D.', initials: 'ZD', trust: 96, trades: 38 },
    description:
      'Doğal kayın ağacından, 48 parçalık geometrik blok seti. 2 yıl kullanıldı, boyası dökülmemiş. Orijinal ahşap kutusuyla birlikte gönderilir.',
    image: blocks,
    gallery: [blocks, blocksClose, ringsClose, sorter],
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
    image: sorter,
    gallery: [sorter, blocksClose, blocks],
  },
  {
    id: 'rings',
    title: 'Montessori halka kulesi',
    points: 340,
    condition: 'Yeni gibi',
    category: 'Montessori',
    location: 'Üsküdar',
    distanceKm: 3.8,
    rating: 5.0,
    marketValue: '~400–470 ₺',
    badge: 'Editör seçimi',
    seller: { name: 'Elif T.', initials: 'ET', trust: 98, trades: 51 },
    description:
      'Doğal boyalı ahşap halka kulesi. Neredeyse hiç kullanılmadı, kutusunda. Bebek ve yürüme dönemi için ideal.',
    image: rings,
    gallery: [rings, ringsClose, blocks],
    favorite: true,
  },
  {
    id: 'rings-natural',
    title: 'Doğal ahşap denge halkaları',
    points: 300,
    condition: 'Az kullanılmış',
    category: 'Montessori',
    location: 'Şişli',
    distanceKm: 6.7,
    rating: 4.8,
    marketValue: '~350–410 ₺',
    seller: { name: 'Can A.', initials: 'CA', trust: 89, trades: 17 },
    description:
      'Doğal yağ ile cilalanmış denge ve istifleme halkaları. Hafif kullanım izi var, tüm parçalar mevcut.',
    image: ringsClose,
    gallery: [ringsClose, rings, blocksClose],
  },
];

export const featured = products.filter((p) => p.badge);

export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}
