import { ImageSourcePropType } from 'react-native';

export type Condition = 'İyi durumda' | 'Az kullanılmış' | 'Yeni gibi';

export interface Product {
  id: string;
  title: string;
  points: number;
  condition: Condition;
  category: 'Oyuncak' | 'Kitap' | 'Montessori' | 'Kutu oyunu';
  location: string;
  rating: number;
  seller: { name: string; initials: string; trust: number; trades: number };
  description: string;
  image: ImageSourcePropType;
  favorite?: boolean;
}

export const products: Product[] = [
  {
    id: 'blocks',
    title: 'Montessori ahşap blok seti',
    points: 420,
    condition: 'Az kullanılmış',
    category: 'Montessori',
    location: 'Kadıköy',
    rating: 4.9,
    seller: { name: 'Zeynep D.', initials: 'ZD', trust: 96, trades: 38 },
    description:
      'Doğal kayın ağacından, 48 parçalık geometrik blok seti. 2 yıl kullanıldı, boyası dökülmemiş. Orijinal ahşap kutusuyla birlikte gönderilir.',
    image: require('../assets/products/product-wooden-blocks.jpg'),
  },
  {
    id: 'sorter',
    title: 'Ahşap renk ayırma oyunu',
    points: 260,
    condition: 'İyi durumda',
    category: 'Oyuncak',
    location: 'Beşiktaş',
    rating: 4.7,
    seller: { name: 'Murat K.', initials: 'MK', trust: 91, trades: 22 },
    description:
      'El becerisi ve renk eşleştirme için ahşap sıralama oyunu. Tüm parçalar tam, küçük kullanım izleri mevcut.',
    image: require('../assets/products/product-color-sorter.jpg'),
  },
  {
    id: 'rings',
    title: 'Montessori halka kulesi',
    points: 340,
    condition: 'Yeni gibi',
    category: 'Montessori',
    location: 'Üsküdar',
    rating: 5.0,
    seller: { name: 'Elif T.', initials: 'ET', trust: 98, trades: 51 },
    description:
      'Doğal boyalı ahşap halka kulesi. Neredeyse hiç kullanılmadı, kutusunda. Bebek ve yürüme dönemi için ideal.',
    image: require('../assets/products/product-montessori-rings.jpg'),
    favorite: true,
  },
  {
    id: 'rings-natural',
    title: 'Doğal ahşap denge halkaları',
    points: 300,
    condition: 'Az kullanılmış',
    category: 'Montessori',
    location: 'Şişli',
    rating: 4.8,
    seller: { name: 'Can A.', initials: 'CA', trust: 89, trades: 17 },
    description:
      'Doğal yağ ile cilalanmış denge ve istifleme halkaları. Hafif kullanım izi var, tüm parçalar mevcut.',
    image: require('../assets/products/product-rings-close.jpg'),
  },
];

export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}
