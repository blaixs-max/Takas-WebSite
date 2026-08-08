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
    yonerge: 'Ürünü karşıdan çek, kadrajı doldursun.',
    neden: 'Alıcının ilk gördüğü kare bu olacak.',
    ikon: 'photo-camera',
    kosul: 'always',
  },
  back: {
    baslik: 'Arka görünüm',
    yonerge: 'Ürünü çevir, arka yüzünü çek.',
    neden: 'Görünmeyen yüzdeki solma ve çizikler burada belli olur.',
    ikon: 'flip-camera-android',
    kosul: 'always',
  },
  left: {
    baslik: 'Sol yan',
    yonerge: 'Sol taraftan profil çek.',
    neden: 'Eğrilik ve kırıklar profilden anlaşılır.',
    ikon: 'chevron-left',
    kosul: 'always',
  },
  right: {
    baslik: 'Sağ yan',
    yonerge: 'Sağ taraftan profil çek.',
    neden: 'İki yan birlikte ürünün bütünlüğünü gösterir.',
    ikon: 'chevron-right',
    kosul: 'always',
  },
  label: {
    baslik: 'Etiket / CE işareti',
    yonerge: 'Etiketi ya da CE işaretini yazılar okunacak kadar yakından çek.',
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
