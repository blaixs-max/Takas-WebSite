import { MaterialIcons } from '@expo/vector-icons';

/** KIDS TRADE ürün kategorileri (tek kaynak). */
export const CATEGORIES = [
  'Annelere Özel',
  'Oda & Dekorasyon',
  'Giyim & Aksesuar',
  'Tekstil',
  'Banyo & Bakım',
  'Beslenme',
  'Bebek & Çocuk Araç Gereç',
  'Oto Koltuğu',
  'Oyuncak',
  'Kitap & Kırtasiye',
  'Parti & Kostüm',
  'Güvenlik',
  'Sağlık',
  'Elektronik',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Her kategori için Material ikon. */
export const CATEGORY_ICONS: Record<Category, keyof typeof MaterialIcons.glyphMap> = {
  'Annelere Özel': 'pregnant-woman',
  'Oda & Dekorasyon': 'bed',
  'Giyim & Aksesuar': 'checkroom',
  Tekstil: 'local-laundry-service',
  'Banyo & Bakım': 'bathtub',
  Beslenme: 'restaurant',
  'Bebek & Çocuk Araç Gereç': 'child-friendly',
  'Oto Koltuğu': 'airline-seat-recline-normal',
  Oyuncak: 'toys',
  'Kitap & Kırtasiye': 'menu-book',
  'Parti & Kostüm': 'celebration',
  Güvenlik: 'security',
  Sağlık: 'health-and-safety',
  Elektronik: 'devices',
};
