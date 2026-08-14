import { MaterialIcons } from '@expo/vector-icons';

/**
 * Yedi kare — Ana Doküman 4.2.
 *
 * Beşi her ilanda zorunludur. Altıncısı hasar beyan edilmişse, yedincisi ürün
 * setse istenir. Sıra, kullanıcıyı ürünün etrafında dolaştıran sıradır:
 * ön → arka → sol → sağ → etiket, sonra varsa hasar ve parça bütünlüğü.
 *
 * Zorunluluk kuralının tek doğruluk kaynağı veri tabanındaki `required_slots()`
 * fonksiyonudur; buradaki `kosul` onun aynasıdır ve yalnızca arayüzü sürer.
 */
export const PHOTO_SLOTS = ['front', 'back', 'left', 'right', 'label', 'damage', 'parts'] as const;

export type PhotoSlot = (typeof PHOTO_SLOTS)[number];

interface SlotInfo {
  baslik: string;
  /** Kullanıcıya ne yapacağını söyleyen tek cümle. */
  yonerge: string;
  /** Kareyi neden istediğimiz — kullanıcı gerekçeyi bilirse özenli çeker. */
  neden: string;
  ikon: keyof typeof MaterialIcons.glyphMap;
  /** 'always' her ilanda; diğerleri beyana bağlı. */
  kosul: 'always' | 'hasDamage' | 'isSet';
}

export const SLOT_INFO: Record<PhotoSlot, SlotInfo> = {
  front: {
    baslik: 'Ön görünüm',
    yonerge: 'Ürünü önden, tamamı görünecek ve kadrajı dolduracak şekilde çek.',
    neden: 'Bu fotoğraf ilanının kapak görseli olacak.',
    ikon: 'photo-camera',
    kosul: 'always',
  },
  back: {
    baslik: 'Arka görünüm',
    yonerge: 'Ürünün arka yüzünü, tamamı görünecek şekilde çek.',
    neden: 'Görünmeyen yüzdeki solma ve çizikler burada belli olur.',
    ikon: 'flip-camera-android',
    kosul: 'always',
  },
  left: {
    baslik: 'Sol yan',
    yonerge: 'Ürünün sol yanını net ve gölgesiz çek.',
    neden: 'Eğrilik ve kırıklar profilden anlaşılır.',
    ikon: 'chevron-left',
    kosul: 'always',
  },
  right: {
    baslik: 'Sağ yan',
    yonerge: 'Ürünün sağ yanını net ve gölgesiz çek.',
    neden: 'İki yan birlikte ürünün bütünlüğünü gösterir.',
    ikon: 'chevron-right',
    kosul: 'always',
  },
  label: {
    baslik: 'Etiket ve detaylar',
    yonerge: 'Marka, model, ölçü etiketi ve varsa kusurları açıkça göster.',
    neden: 'Marka, model ve yaş grubu değerlemeyi doğrudan etkiler.',
    ikon: 'label',
    kosul: 'always',
  },
  damage: {
    baslik: 'Hasar yakın çekimi',
    yonerge: 'Beyan ettiğin kusuru yakından çek.',
    neden: 'Kusuru gösteren satıcı, anlaşmazlıkta korunur.',
    ikon: 'report-problem',
    kosul: 'hasDamage',
  },
  parts: {
    baslik: 'Parça bütünlüğü',
    yonerge: 'Setin tüm parçalarını yan yana diz ve tek karede çek.',
    neden: 'Eksik parça tartışmasının önüne geçer.',
    ikon: 'widgets',
    kosul: 'isSet',
  },
};

/** Veri tabanındaki required_slots() ile aynı kuralı arayüz için üretir. */
export function gerekliSlotlar(hasDamage: boolean, isSet: boolean): PhotoSlot[] {
  return PHOTO_SLOTS.filter((s) => {
    const k = SLOT_INFO[s].kosul;
    return k === 'always' || (k === 'hasDamage' && hasDamage) || (k === 'isSet' && isSet);
  });
}
