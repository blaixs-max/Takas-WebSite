import { MaterialIcons } from '@expo/vector-icons';

/**
 * Yedi kare — Ana Doküman 4.2.
 *
 * **Dördü zorunlu** (ön, arka, sol, sağ). Etiket karesi opsiyoneldir; hasar
 * karesi hasar beyan edilmişse, parça karesi ürün setse istenir.
 *
 * ## Etiket neden zorunlu olmaktan çıktı (2026-08-16)
 *
 * Zorunluydu ve ilan girişindeki en büyük sürtünme noktasıydı: "marka/model/CE
 * yazısı okunmuyor" ilk gerçek ilanda düşen tek retti. Sebebi de basit —
 * ikinci el bir üründe etiket çoğu zaman **yok**: sökülmüş, solmuş ya da hiç
 * olmamış. Olmayan bir şeyi zorunlu tutmak dürüst satıcıyı kapıda durdurur.
 *
 * Etiketin varlık sebebi değerlemeydi ("marka, model ve yaş grubu değerlemeyi
 * doğrudan etkiler"). O iş yapay zekâya geçti: değerleme dört açı karesinden
 * ürünü tanıyıp piyasa fiyatını buluyor. Etiket varsa tanımayı kolaylaştırır,
 * yoksa süreç durmaz.
 *
 * Zorunluluk kuralının tek doğruluk kaynağı veri tabanındaki `required_slots()`
 * fonksiyonudur; buradaki `kosul` onun aynasıdır ve **ikisi birlikte değişir**.
 * Biri gevşetilip öbürü unutulursa arayüz "atlayabilirsin" der, yayın kapısı
 * reddeder ve kullanıcı sebebini hiç anlamaz.
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
  /** 'always' her ilanda; 'optional' hiç zorunlu değil; diğerleri beyana bağlı. */
  kosul: 'always' | 'optional' | 'hasDamage' | 'isSet';
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
    yonerge: 'Etiket varsa marka, model ve ölçü yazısını göster. Yoksa atla.',
    neden: 'Etiket, ürünü tanımayı kolaylaştırır ve değerlemeyi netleştirir. Zorunlu değil.',
    ikon: 'label',
    kosul: 'optional',
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

/**
 * Çekim akışında **gösterilecek** kareler — opsiyonel olan dahil.
 *
 * Gösterilmek ile zorunlu olmak ayrı şeyler ve bu ayrım etiket karesiyle
 * birlikte geldi: etiket akışta durmalı (varsa çekilsin, değerlemeyi
 * kolaylaştırıyor) ama çekilmemesi ilanı durdurmamalı.
 */
export function gosterilecekSlotlar(hasDamage: boolean, isSet: boolean): PhotoSlot[] {
  return PHOTO_SLOTS.filter((s) => {
    const k = SLOT_INFO[s].kosul;
    return (
      k === 'always' ||
      k === 'optional' ||
      (k === 'hasDamage' && hasDamage) ||
      (k === 'isSet' && isSet)
    );
  });
}

/**
 * Yayın için **zorunlu** kareler. Veri tabanındaki `required_slots()` ile
 * birebir aynı kuralı üretir; ikisi ayrışırsa arayüz "atlayabilirsin" der ve
 * yayın kapısı reddeder.
 */
export function zorunluSlotlar(hasDamage: boolean, isSet: boolean): PhotoSlot[] {
  return PHOTO_SLOTS.filter((s) => {
    const k = SLOT_INFO[s].kosul;
    return k === 'always' || (k === 'hasDamage' && hasDamage) || (k === 'isSet' && isSet);
  });
}

/** Bu slot atlanabilir mi? Çekim ekranındaki "Atla" düğmesi buna bakıyor. */
export function atlanabilir(slot: PhotoSlot): boolean {
  return SLOT_INFO[slot].kosul === 'optional';
}
