/**
 * Reddedilen avatar temizlenebiliyor.
 *
 * Canlıdaki ilk gerçek denetim turu (2026-08-18) mekanizmanın çalıştığını
 * gösterdi — fotoğraf reddedildi, gerekçe yazıldı, dosya depodan silindi — ama
 * arkasında **çıkışı olmayan bir durum** bıraktı.
 *
 * ## Kusur
 *
 * `avatar_karar` reddederken `avatar_path`i **null** yapıyor (doğru: dosya
 * zaten silindi, ölü bir yol bırakmak sonraki yüklemede "yol değişmedi" diye
 * okunurdu). Geriye `avatar_status = 'rejected'` ve gerekçe kalıyor.
 *
 * İstemci "Kaldır"da `update profiles set avatar_path = null` yazıyordu.
 * Tetikleyici durumu yalnızca **yol değişince** sıfırlıyor:
 *
 *     if new.avatar_path is distinct from old.avatar_path then ...
 *
 * Yol **zaten null**. `is distinct from` false, koşul atlanıyor, durum
 * `rejected` kalıyor. Ekrandaki kırmızı gerekçe kutusunu kapatmanın hiçbir
 * yolu yoktu: "Kaldır" basılıyor, sunucu sıfır iş yapıyor, hiçbir şey
 * değişmiyor. Kullanıcının bildirdiği "Kaldır tuşuna bastım ama çalışmadı"
 * tam olarak bu.
 *
 * ## Neden tetikleyici gevşetilmedi
 *
 * İlk düzeltme "yol null'a çekiliyorsa durumu da gerekçeyi de sil" idi ve
 * `profil_fotografi_test.sql`in 6. iddiası onu düşürdü — haklı olarak.
 * Tetikleyici `new.avatar_path is null` ile "kullanıcı fotoğrafını kaldırdı"yı
 * ayırt edemez; ikisi de null görünür. Yani o kural **fotoğrafı olmayan bir
 * hesapta profile yapılan her yazmada** ret gerekçesini süpürürdü. Gerekçeyi
 * ekranda tutmak bir güvenlik kuralı değil ama bir kullanıcı borcu: neyin
 * neden engellendiğini söylemeyen ekran aynı hatayı tekrar yaptırır.
 *
 * ## Çözüm: kaldırmak bir yan etki değil, bir eylem
 *
 * `avatar_kaldir()` açık bir çağrı. `security definer` olduğu için tetikleyici
 * muafiyetiyle çalışıyor (`current_user` fonksiyon sahibi, `authenticated`
 * değil), yani üç alanı birlikte boşaltabiliyor. Tetikleyici olduğu gibi
 * kalıyor: istemci hâlâ `approved` yazamıyor ve hâlâ düz bir `update` ile
 * gerekçeyi silemiyor.
 *
 * Depodaki dosyayı istemci siliyor; fonksiyon eski yolu döndürüyor ki
 * silinecek nesnenin adı bilinsin. Yol güncellemeden **önce** okunuyor —
 * sonra okunsa null gelirdi ve dosya depoda öksüz kalırdı.
 */
create or replace function public.avatar_kaldir()
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  uid  uuid := auth.uid();
  eski text;
begin
  if uid is null then
    raise exception 'oturum yok';
  end if;

  select p.avatar_path into eski
    from public.profiles p
   where p.user_id = uid;

  update public.profiles
     set avatar_path   = null,
         avatar_status = null,
         avatar_reason = null
   where user_id = uid;

  return eski;
end; $function$;

revoke all on function public.avatar_kaldir() from public, anon;
grant execute on function public.avatar_kaldir() to authenticated;
