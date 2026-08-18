import { File } from 'expo-file-system';
import { supabase, supabaseConfigured } from './supabase';

/**
 * Profil fotoğrafı.
 *
 * ## Yol her yüklemede yeni
 *
 * Sabit bir yol (`{uid}/avatar.jpg`) denetimde delik açıyordu: depoya aynı
 * yola ikinci kez yazmak Postgres tarafında hiçbir iz bırakmaz, yani masum
 * bir fotoğrafı onaylatıp üstüne başkasını koymak yeterliydi. Yol artık her
 * yüklemede değişiyor; tetikleyici yol değişikliğini görüp durumu `pending`e
 * çekiyor. Eski dosya, yeni yükleme başarılı olduktan sonra siliniyor.
 *
 * Başkası yolu `avatar_yolu()` ile öğreniyor ve o fonksiyon **yalnızca
 * onaylı** avatarın yolunu veriyor.
 *
 * ## Onaylanmadan görünmüyor
 *
 * Yükleme `avatar_status`u `pending` yapıyor (tetikleyici zorluyor, istemci
 * seçmiyor) ve `pending` bir avatar başkasına hiç gösterilmiyor. Sahibi
 * kendi `pending` avatarını görüyor — görmeseydi "yüklendi mi?" sorusunun
 * cevabı olmazdı — ve üstünde "inceleniyor" yazıyor.
 */

export type AvatarDurumu = 'pending' | 'approved' | 'rejected' | null;

export interface AvatarBilgisi {
  durum: AvatarDurumu;
  /** Gösterilebilir imzalı bağlantı; üretilemezse null. */
  url: string | null;
  /** Reddedildiyse kullanıcıya gösterilecek gerekçe. */
  gerekce: string | null;
}

export const BOS_AVATAR: AvatarBilgisi = { durum: null, url: null, gerekce: null };

export type AvatarSonucu =
  | { ok: true; durum: Exclude<AvatarDurumu, null>; gerekce: string | null }
  | { ok: false; message: string };

export type BasitSonuc = { ok: true } | { ok: false; message: string };

/**
 * Her yükleme için yeni bir yol.
 *
 * Zaman damgası okunabilirlik için, rastgele son ek çakışmaya karşı: aynı
 * milisaniyede iki yükleme (çift dokunuş) aynı adı üretirse ikincisi
 * birincinin üstüne yazar ve tetikleyici yol değişmedi sanır.
 */
function yeniYol(uid: string): string {
  const rastgele = Math.random().toString(36).slice(2, 10);
  return `${uid}/${Date.now()}-${rastgele}.jpg`;
}

/** İmzalı bağlantı — kova özel, doğrudan URL yok. */
async function baglanti(path: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.storage.from('avatars').createSignedUrl(path, 60 * 30);
  return data?.signedUrl ?? null;
}

/** Kullanıcının kendi avatarı — durumuyla birlikte. */
export async function loadMyAvatar(): Promise<AvatarBilgisi> {
  if (!supabaseConfigured || !supabase) return BOS_AVATAR;
  const { data: oturum } = await supabase.auth.getUser();
  const uid = oturum?.user?.id;
  if (!uid) return BOS_AVATAR;

  const { data } = await supabase
    .from('profiles')
    .select('avatar_path, avatar_status, avatar_reason')
    .eq('user_id', uid)
    .maybeSingle();

  const durum = (data?.avatar_status as AvatarDurumu) ?? null;
  if (!data?.avatar_path || !durum) {
    return { durum, url: null, gerekce: (data?.avatar_reason as string) ?? null };
  }
  return {
    durum,
    url: await baglanti(data.avatar_path as string),
    gerekce: (data.avatar_reason as string) ?? null,
  };
}

/**
 * Başkasının avatarı.
 *
 * `avatar_yolu` yalnızca **onaylı** avatarın yolunu döndürüyor; onaysızda
 * null geliyor ve zaten depolama politikası da bağlantı üretmezdi. İki katman
 * birden: fonksiyon susarsa politika, politika gevşerse fonksiyon.
 */
export async function loadUserAvatar(userId: string): Promise<string | null> {
  if (!supabaseConfigured || !supabase || !userId) return null;
  const { data } = await supabase.rpc('avatar_yolu', { p_user_id: userId });
  const path = typeof data === 'string' ? data : null;
  return path ? baglanti(path) : null;
}

/**
 * Avatarı yükler ve denetime gönderir.
 *
 * Denetim **beklenerek** çağrılıyor: kullanıcı fotoğrafını seçtikten sonra
 * birkaç saniye içinde geçip geçmediğini öğreniyor. Ateşle-ve-unut olsaydı
 * ekran "yüklendi" der, fotoğraf görünmez ve sebebi hiçbir yerde yazmazdı —
 * ilan karelerinde tam olarak bu yaşandı.
 *
 * Denetim çağrısı düşerse durum `pending` kalıyor ve bu doğru cevap: avatar
 * gösterilmiyor, insan kuyruğunda bekliyor. Sessiz otomatik onay yok.
 */
export async function uploadAvatar(localUri: string): Promise<AvatarSonucu> {
  if (!supabaseConfigured || !supabase) {
    return { ok: false, message: 'Sunucu bağlantısı yok. Anahtarlar tanımlı değil.' };
  }
  const { data: oturum } = await supabase.auth.getUser();
  const uid = oturum?.user?.id;
  if (!uid) return { ok: false, message: 'Fotoğraf yüklemek için giriş yapmalısın.' };

  // Hermes'te fetch(file://).blob() güvenilir değil; baytları doğrudan okuyoruz.
  let bytes: Uint8Array;
  try {
    bytes = await new File(localUri).bytes();
  } catch {
    return { ok: false, message: 'Fotoğraf okunamadı. Başka bir görsel dene.' };
  }

  /* Eski yol, yeni dosya yazılmadan ÖNCE okunuyor: satırı güncelledikten
     sonra öğrenilemez ve eski dosya depoda öksüz kalırdı. */
  const { data: eski } = await supabase
    .from('profiles')
    .select('avatar_path')
    .eq('user_id', uid)
    .maybeSingle();
  const eskiYol = (eski?.avatar_path as string) ?? null;

  const path = yeniYol(uid);
  const png = localUri.split('.').pop()?.toLowerCase() === 'png';
  const { error: yuklemeHatasi } = await supabase.storage.from('avatars').upload(path, bytes, {
    contentType: png ? 'image/png' : 'image/jpeg',
  });

  if (yuklemeHatasi) {
    console.error('[uploadAvatar] depo hatası', yuklemeHatasi.message);
    return { ok: false, message: yuklemeHatasiniCevir(yuklemeHatasi.message) };
  }

  /* Profil satırı yoksa açılıyor. `upsert` şart: kullanıcı profilini hiç
     kaydetmemiş olabilir ve o durumda `update` sessizce sıfır satır etkilerdi
     — dosya depoda durur, hiçbir yerde görünmez, kimse sebebini bilmez. */
  const { error: satirHatasi } = await supabase
    .from('profiles')
    .upsert({ user_id: uid, avatar_path: path }, { onConflict: 'user_id' });

  if (satirHatasi) {
    console.error('[uploadAvatar] profil yazılamadı', satirHatasi.message);
    /* Satır yazılamadıysa dosya öksüz: kimse ona bakmıyor ama depoda duruyor.
       Temizlemek denetimin bir parçası değil, saklamanın bir parçası. */
    await supabase.storage.from('avatars').remove([path]);
    return { ok: false, message: 'Fotoğraf kaydedilemedi. Tekrar dene.' };
  }

  /* Eski dosya artık hiçbir satırın işaret etmediği bir nesne. Sonucu
     beklenmiyor: silinemezse kullanıcının yeni avatarı yine de çalışır. */
  if (eskiYol && eskiYol !== path) {
    void supabase.storage.from('avatars').remove([eskiYol]);
  }

  try {
    const { data, error } = await supabase.functions.invoke('avatar-check', { body: {} });
    if (error) return { ok: true, durum: 'pending', gerekce: null };
    const durum = data?.status as AvatarDurumu;
    if (durum === 'approved' || durum === 'rejected') {
      return { ok: true, durum, gerekce: (data?.gerekce as string) || null };
    }
  } catch {
    // yut: aşağıdaki 'pending' doğru cevap
  }
  return { ok: true, durum: 'pending', gerekce: null };
}

/** Avatarı kaldırır — yol satırdan, dosya depodan. */
export async function removeAvatar(): Promise<BasitSonuc> {
  if (!supabaseConfigured || !supabase) {
    return { ok: false, message: 'Sunucu bağlantısı yok.' };
  }
  const { data: oturum } = await supabase.auth.getUser();
  const uid = oturum?.user?.id;
  if (!uid) return { ok: false, message: 'Bunun için giriş yapmalısın.' };

  const { data: satir } = await supabase
    .from('profiles')
    .select('avatar_path')
    .eq('user_id', uid)
    .maybeSingle();

  /* Önce satır, sonra dosya. Ters sırada dosya silinip satır güncellenemezse
     profil var olmayan bir dosyayı gösterir ve kullanıcı kırık bir kare
     görür; bu sırada ise en kötü durum depoda öksüz bir dosya kalması. */
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_path: null })
    .eq('user_id', uid);
  if (error) return { ok: false, message: 'Fotoğraf kaldırılamadı. Tekrar dene.' };

  if (satir?.avatar_path) {
    void supabase.storage.from('avatars').remove([satir.avatar_path as string]);
  }
  return { ok: true };
}

function yuklemeHatasiniCevir(ham: string): string {
  const m = ham.toLowerCase();
  if (m.includes('exceeded the maximum allowed size') || m.includes('payload too large')) {
    return 'Fotoğraf çok büyük (en fazla 3 MB). Daha küçük bir görsel seç.';
  }
  if (m.includes('mime type') || m.includes('invalid_mime')) {
    return 'Bu dosya biçimi desteklenmiyor. JPG, PNG ya da WebP kullan.';
  }
  if (m.includes('row-level security') || m.includes('unauthorized') || m.includes('403')) {
    return 'Yükleme izni alınamadı. Çıkış yapıp tekrar giriş yapmayı dene.';
  }
  return 'Fotoğraf yüklenemedi. Tekrar dene.';
}
