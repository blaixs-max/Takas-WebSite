import { supabase, supabaseConfigured } from './supabase';

/**
 * Adres defteri.
 *
 * Doğrudan tabloya gidiyor, RPC yok: satırın her alanı kullanıcının kendi
 * yazdığı, kendi okuduğu veri. Yazılamaması gereken bir alan olsaydı (satıcı
 * kimliği, puan, değerleme izi gibi) RPC şart olurdu — burada yok.
 *
 * **T.C. kimlik numarası burada yok ve olmayacak.** Fatura kimliği her ödemede
 * ayrıca soruluyor; saklanmayan veri sızdırılamaz.
 */
export interface Address {
  id: string;
  baslik: string;
  adSoyad: string;
  telefon: string | null;
  il: string;
  ilce: string;
  acikAdres: string;
  varsayilan: boolean;
}

/** Kaydedilecek gövde — `id` yoksa yeni adres. */
export interface AddressInput {
  baslik: string;
  adSoyad: string;
  telefon: string;
  il: string;
  ilce: string;
  acikAdres: string;
  varsayilan: boolean;
}

export const BOS_ADRES: AddressInput = {
  baslik: '',
  adSoyad: '',
  telefon: '',
  il: '',
  ilce: '',
  acikAdres: '',
  varsayilan: false,
};

export type AdresSonucu = { ok: true } | { ok: false; message: string };

interface AddressRow {
  id: string;
  baslik: string;
  ad_soyad: string;
  telefon: string | null;
  il: string;
  ilce: string;
  acik_adres: string;
  varsayilan: boolean;
}

const COLS = 'id, baslik, ad_soyad, telefon, il, ilce, acik_adres, varsayilan';

function cevir(r: AddressRow): Address {
  return {
    id: r.id,
    baslik: r.baslik,
    adSoyad: r.ad_soyad,
    telefon: r.telefon,
    il: r.il,
    ilce: r.ilce,
    acikAdres: r.acik_adres,
    varsayilan: r.varsayilan,
  };
}

/**
 * Adresleri getirir; varsayılan en üstte.
 *
 * `user_id` filtresi açık yazılıyor. RLS zaten daraltıyor ama taslak
 * listesinde bir kez öğrenildi: RLS "neyi görmeye hakkın var" sorusunun
 * cevabı, sorgu filtresi "neyi görmek istiyorsun" sorusunun. Yetkisi genişleyen
 * ilk hesapta ikisini karıştırmak kırılıyor.
 */
export async function loadAddresses(): Promise<Address[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data: oturum } = await supabase.auth.getUser();
  const uid = oturum?.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from('addresses')
    .select(COLS)
    .eq('user_id', uid)
    .order('varsayilan', { ascending: false })
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return (data as unknown as AddressRow[]).map(cevir);
}

/** Tek adresi okur — düzenleme formu için. */
export async function loadAddress(id: string): Promise<Address | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data: oturum } = await supabase.auth.getUser();
  const uid = oturum?.user?.id;
  if (!uid) return null;

  const { data, error } = await supabase
    .from('addresses')
    .select(COLS)
    .eq('id', id)
    .eq('user_id', uid)
    .single();

  if (error || !data) return null;
  return cevir(data as unknown as AddressRow);
}

/** Ödeme formunu dolduran adres. Yoksa null — form boş açılır. */
export async function varsayilanAdres(): Promise<Address | null> {
  const liste = await loadAddresses();
  return liste.find((a) => a.varsayilan) ?? liste[0] ?? null;
}

/**
 * Girdiyi denetler.
 *
 * Denetim istemcide **ve** veri tabanında: CHECK kısıtları son söz, bu ise
 * kullanıcıya Türkçe ve alan adıyla söylüyor. Yalnızca birini tutmak iki
 * yönden de kötü olurdu — sadece istemcide olsa atlanabilir, sadece veri
 * tabanında olsa kullanıcı "violates check constraint" okurdu.
 */
export function adresHatasi(a: AddressInput): string | null {
  if (!a.baslik.trim()) return 'Adrese bir başlık ver (Ev, Ofis gibi).';
  if (a.baslik.trim().length > 24) return 'Başlık en fazla 24 karakter olabilir.';
  if (a.adSoyad.trim().length < 2) return 'Teslim alacak kişinin adını yaz.';
  if (!a.il.trim() || !a.ilce.trim()) return 'İl ve ilçe seç.';
  if (a.acikAdres.trim().length < 10)
    return 'Açık adresi yaz — mahalle, cadde ve kapı numarası.';
  if (a.acikAdres.trim().length > 300) return 'Açık adres en fazla 300 karakter olabilir.';
  return null;
}

function govde(a: AddressInput, uid: string) {
  return {
    user_id: uid,
    baslik: a.baslik.trim(),
    ad_soyad: a.adSoyad.trim(),
    telefon: a.telefon.trim() || null,
    il: a.il.trim(),
    ilce: a.ilce.trim(),
    acik_adres: a.acikAdres.trim(),
    varsayilan: a.varsayilan,
  };
}

export async function saveAddress(a: AddressInput, id?: string): Promise<AdresSonucu> {
  if (!supabaseConfigured || !supabase) {
    return { ok: false, message: 'Sunucu bağlantısı yok. Anahtarlar tanımlı değil.' };
  }
  const hata = adresHatasi(a);
  if (hata) return { ok: false, message: hata };

  const { data: oturum } = await supabase.auth.getUser();
  const uid = oturum?.user?.id;
  if (!uid) return { ok: false, message: 'Adres kaydetmek için giriş yapmalısın.' };

  const { error } = id
    ? await supabase.from('addresses').update(govde(a, uid)).eq('id', id).eq('user_id', uid)
    : await supabase.from('addresses').insert(govde(a, uid));

  if (error) return { ok: false, message: adresSunucuHatasi(error.message) };
  return { ok: true };
}

export async function deleteAddress(id: string): Promise<AdresSonucu> {
  if (!supabaseConfigured || !supabase) {
    return { ok: false, message: 'Sunucu bağlantısı yok.' };
  }
  const { data: oturum } = await supabase.auth.getUser();
  const uid = oturum?.user?.id;
  if (!uid) return { ok: false, message: 'Bunun için giriş yapmalısın.' };

  const { error } = await supabase.from('addresses').delete().eq('id', id).eq('user_id', uid);
  if (error) return { ok: false, message: 'Adres silinemedi. Tekrar dene.' };
  return { ok: true };
}

/** Varsayılanı değiştirir; eskisini trigger bırakıyor. */
export async function setDefaultAddress(id: string): Promise<AdresSonucu> {
  if (!supabaseConfigured || !supabase) {
    return { ok: false, message: 'Sunucu bağlantısı yok.' };
  }
  const { data: oturum } = await supabase.auth.getUser();
  const uid = oturum?.user?.id;
  if (!uid) return { ok: false, message: 'Bunun için giriş yapmalısın.' };

  const { error } = await supabase
    .from('addresses')
    .update({ varsayilan: true })
    .eq('id', id)
    .eq('user_id', uid);
  if (error) return { ok: false, message: 'Varsayılan adres değiştirilemedi.' };
  return { ok: true };
}

function adresSunucuHatasi(mesaj: string): string {
  if (mesaj.includes('en fazla 10 adres'))
    return 'En fazla 10 adres kaydedebilirsin. Kullanmadığın birini sil.';
  if (mesaj.includes('violates check constraint'))
    return 'Alanlardan biri geçersiz. Başlık, il, ilçe ve açık adresi kontrol et.';
  return 'Adres kaydedilemedi. Bağlantını kontrol edip tekrar dene.';
}
