/**
 * Profil fotoğrafı — yükleniyor, denetleniyor, onaylanmadan görünmüyor.
 *
 * Bugüne kadar avatar diye bir şey yoktu: her yerde adın baş harfleri
 * gösteriliyordu. İstek kullanıcının (2026-08-18): "isteyen kendi resmini
 * koyabilsin ama uygunsuz, pornografik vb. koyamasın."
 *
 * İkinci yarısı birincisinden daha önemli. Profil fotoğrafı ilan karesinden
 * **daha zor** bir denetim yüzeyi: kare çekimi bizim akışımız — kamera açılıyor,
 * yedi slot isteniyor, dosya seçtirilmiyor bile. Avatar ise galeriden geliyor,
 * yani kullanıcının telefonundaki herhangi bir görsel.
 *
 * ## Üç durumlu alan, iki değil
 *
 * `avatar_status`: null (fotoğraf yok) · pending (yüklendi, inceleniyor) ·
 * approved · rejected. `pending` şart: denetim saniyeler sürüyor ve o süre
 * boyunca fotoğrafın **görünmemesi** gerekiyor. İki durumlu bir alanla
 * ("var/yok") inceleme penceresi boyunca denetlenmemiş görsel yayında olurdu.
 *
 * ## Onay kapısı depolama katmanında, arayüzde değil
 *
 * Başkasının avatarını okuma politikası `avatar_status = 'approved'` koşuluna
 * bağlı. Yani arayüz hata yapsa bile — bir ekran yanlışlıkla `pending` bir
 * avatarı çizmeye çalışsa bile — imzalı bağlantı üretilemez. Kural tek yerde
 * ve o yer en alttaki katman.
 *
 * ## Yol her yüklemede DEĞİŞİYOR — ve bu bir ayrıntı değil
 *
 * İlk tasarım sabit bir yoldu (`{uid}/avatar.jpg`) ve denetimde bir delik
 * açıyordu: depoya aynı yola ikinci kez yazmak Postgres tarafında hiçbir iz
 * bırakmaz. Yani masum bir fotoğraf yükleyip onaylatmak, sonra aynı yola
 * başka bir dosya koymak yeterliydi — satır hâlâ `approved` derdi ve
 * denetlenmemiş görsel onaylı görünürdü.
 *
 * Yol artık her yüklemede yeni (`{uid}/{rastgele}.jpg`). Yol değişince
 * tetikleyici durumu `pending`e çekiyor, yani her yeni dosya kendi denetimini
 * bekliyor. Eski dosya yükleme başarılı olduktan sonra siliniyor.
 *
 * Sabit yolun tek gerekçesi "başkası avatarın yolunu nereden bilecek" idi;
 * onu `avatar_yolu()` çözüyor — ve zaten yalnızca onaylı avatarın yolunu
 * veriyor, yani ikinci bir kapı.
 */

alter table public.profiles
  add column if not exists avatar_path   text,
  add column if not exists avatar_status text
    check (avatar_status is null or avatar_status in ('pending','approved','rejected')),
  add column if not exists avatar_reason text;

comment on column public.profiles.avatar_status is
  'null = fotoğraf yok. pending = yüklendi, denetleniyor — GÖSTERİLMEZ. '
  'approved = denetimden geçti. rejected = engellendi, gerekçe avatar_reason.';

/**
 * İstemci kendi avatarını onaylayamaz.
 *
 * `product_photos_guard_client_update` ile aynı mekanik ve aynı gerekçe — ve
 * aynı tuzak: bu fonksiyon **`security invoker` olmak zorunda.** `security
 * definer` yazılsaydı `current_user` fonksiyonun sahibi olurdu, koşul hiç
 * tutmazdı ve kontrol sessizce hiçbir şey yapmazdı. Bu tam olarak 2026-08-17'de
 * yaşandı: kullanıcı kendi ilan karesini `approved` yapabiliyordu ve test
 * paketi yine "geçti" dedi.
 *
 * Yol değişince durum kendiliğinden `pending`e düşüyor — ve yükleyen taraf
 * her seferinde yeni bir yol üretiyor, yani bu yol her yüklemede geçiliyor.
 */
create or replace function public.profiles_guard_avatar()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.avatar_status := case when new.avatar_path is null then null else 'pending' end;
    new.avatar_reason := null;
    return new;
  end if;

  if new.avatar_path is distinct from old.avatar_path then
    new.avatar_status := case when new.avatar_path is null then null else 'pending' end;
    new.avatar_reason := null;
  else
    -- Yol aynıysa durum da aynı kalır; istemcinin oynayacağı bir şey yok.
    new.avatar_status := old.avatar_status;
    new.avatar_reason := old.avatar_reason;
  end if;

  return new;
end; $function$;

drop trigger if exists profiles_avatar_guard_trg on public.profiles;
create trigger profiles_avatar_guard_trg
  before insert or update on public.profiles
  for each row execute function public.profiles_guard_avatar();

/**
 * Avatar kovası.
 *
 * `public = false`: açık kova, onay kapısını tamamen anlamsız kılardı —
 * yüklenen her dosya anında herkese açık bir adrese düşerdi ve `pending`
 * diye bir şey kalmazdı.
 *
 * 3 MB, ilan karesinin (8 MB) altında: bir avatar 3 MB'ı geçiyorsa zaten
 * ölçeklenmemiş demektir ve profil dairesinde 40 piksel olarak görünecek.
 */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 3145728,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatarını yükle"        on storage.objects;
drop policy if exists "avatarını değiştir"     on storage.objects;
drop policy if exists "avatarını sil"          on storage.objects;
drop policy if exists "kendi avatarını gör"    on storage.objects;
drop policy if exists "onaylı avatarı gör"     on storage.objects;

create policy "avatarını yükle"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatarını değiştir"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatarını sil"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

/* Sahibi kendi avatarını her durumda görür — `pending` iken de. Görmeseydi
   kullanıcı yüklediği fotoğrafı inceleme bitene kadar hiç göremezdi ve
   "yüklendi mi?" sorusunun cevabı olmazdı. Ekran o sırada üstüne
   "inceleniyor" yazıyor. */
create policy "kendi avatarını gör"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

/* Başkasının avatarı YALNIZCA onaylıysa. Kapı burada; arayüz hata yapsa bile
   denetlenmemiş bir görselin bağlantısı üretilemez. */
create policy "onaylı avatarı gör"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and exists (
      select 1 from public.profiles p
       where p.avatar_path = storage.objects.name
         and p.avatar_status = 'approved'
    )
  );

/**
 * Başkasının avatar durumunu okumak.
 *
 * `profiles` satırı sahibinden başkasına kapalı ve öyle kalmalı — içinde
 * `bio` ve `city` de var. Ama ilan kartının satıcının avatarını çizebilmesi
 * için "bu kullanıcının onaylı bir avatarı var mı" sorusunun bir cevabı olmalı.
 *
 * Fonksiyon o tek soruyu cevaplıyor ve başka hiçbir şey döndürmüyor. Dönen
 * değer zaten depolama politikasının izin verdiği bilgiyle aynı: onaylı avatarı
 * olan kullanıcının yolu tahmin edilebilir ve bağlantısı üretilebilir.
 */
create or replace function public.avatar_yolu(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select p.avatar_path from public.profiles p
   where p.user_id = p_user_id and p.avatar_status = 'approved';
$function$;

revoke all on function public.avatar_yolu(uuid) from public, anon;
grant execute on function public.avatar_yolu(uuid) to authenticated;

/**
 * Denetim sonucunu yazar. Yalnızca `service_role` çağırır.
 *
 * Edge Function `service_role` ile bağlanıyor ve tabloya doğrudan da
 * yazabilirdi; RPC olmasının sebebi kapının **adının** olması: `avatar_karar`
 * dışında hiçbir yerde `avatar_status = 'approved'` yazılmıyor, yani onayın
 * nereden geldiği tek bir grep'le görülüyor.
 */
create or replace function public.avatar_karar(
  p_user_id uuid,
  p_durum   text,
  p_gerekce text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_durum not in ('pending','approved','rejected') then
    raise exception 'geçersiz avatar durumu: %', p_durum;
  end if;
  update public.profiles
     set avatar_status = p_durum,
         avatar_reason = p_gerekce,
         /* Reddedilen avatarın yolu da siliniyor: dosya depodan kalkıyor ve
            satırda ölü bir yol bırakmak, sonraki yüklemede "yol değişmedi"
            diye okunup denetimi atlatabilirdi. */
         avatar_path   = case when p_durum = 'rejected' then null else avatar_path end
   where user_id = p_user_id;
end; $function$;

revoke all on function public.avatar_karar(uuid, text, text) from public, anon, authenticated;

/**
 * Ölçüm tablosu avatar denetimini de taşıyor.
 *
 * Ayrı bir tablo açmak, aynı üç ihtiyacı (maliyet, oran sınırı, sebep
 * dağılımı) ikinci kez kurmak olurdu. Daha önemlisi **oran sınırı ortak
 * olmalı**: sınır kullanıcının bize çıkardığı yapay zekâ maliyetini
 * sınırlıyor ve o maliyet, çağrının kare mi avatar mı olduğuna bakmıyor.
 * Ayrı sayaçlar, iki ayrı kotayı yakma imkânı verirdi.
 *
 * `tur` kolonu maliyeti yine de ayırabilmek için: hangi denetimin ne kadara
 * mal olduğunu bilmeden hangisini ucuzlatacağımıza karar veremeyiz.
 */
alter table public.photo_check_events
  add column if not exists tur text not null default 'kare';

alter table public.photo_check_events drop constraint if exists photo_check_events_tur_check;
alter table public.photo_check_events
  add constraint photo_check_events_tur_check check (tur in ('kare','avatar'));

/* `create or replace` yeni bir varsayılanlı parametre eklerse iki imza birden
   var olur ve 9 argümanlı çağrılar belirsiz kalır. Bu yüzden önce düşürülüyor;
   `photo-check` adlandırılmış argümanlarla çağırdığı için 10'uncu parametrenin
   varsayılanı yeterli, o taraf değişmiyor. */
drop function if exists public.foto_denetim_kaydet(uuid, uuid, text, text, text, boolean, integer, integer, integer);

create or replace function public.foto_denetim_kaydet(
  p_user_id      uuid,
  p_photo_id     uuid,
  p_model        text,
  p_karar        text,
  p_sebep        text default null,
  p_ikinci_gorus boolean default false,
  p_giris_token  integer default null,
  p_cikis_token  integer default null,
  p_sure_ms      integer default null,
  p_tur          text default 'kare'
)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  insert into public.photo_check_events
    (user_id, photo_id, model, karar, sebep, ikinci_gorus,
     giris_token, cikis_token, sure_ms, tur)
  values
    (p_user_id, p_photo_id, p_model, p_karar, p_sebep, coalesce(p_ikinci_gorus, false),
     p_giris_token, p_cikis_token, p_sure_ms, coalesce(p_tur, 'kare'));
$function$;

revoke all on function public.foto_denetim_kaydet(uuid, uuid, text, text, text, boolean, integer, integer, integer, text)
  from public, anon, authenticated;
