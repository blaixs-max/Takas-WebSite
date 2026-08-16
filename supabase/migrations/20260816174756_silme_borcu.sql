-- Reddedilen karenin silinme borcu.
--
-- ## Sorun
--
-- Reddedilen görsel depodan siliniyor (KVKK; `/gizlilik/` bunu açıkça
-- **yayında vaat ediyor**: "reddedilen kare anında silinir"). Ama silme
-- çağrısı başarısız olduğunda kod yalnızca `console.error` yazıp devam
-- ediyordu. Sonuç: dosya depoda süresiz kalıyor, kimse bilmiyor ve yayında
-- duran cümle sessizce yanlış hâle geliyor. Bir günlük satırı, kimsenin
-- bakmadığı yerde tutulan bir borçtur.
--
-- ## Çözüm
--
-- Borç satıra yazılıyor. `photo-check` her çağrıldığında en eski birkaç
-- borcu yeniden deniyor — yani silme oranı yükleme trafiğiyle birlikte
-- ölçekleniyor, ki borcun oluştuğu an da tam olarak o.
--
-- Zamana bağlı bir süpürücü (pg_cron + pg_net ile Edge Function'a POST)
-- bilerek **yapılmadı**: yeni bir sır (fonksiyon anahtarı) veri tabanına
-- girerdi ve buradaki borç yalnızca yükleme varken oluşuyor. Yükleme
-- dururken biriken bir borç kalmadığı sürece gerek yok; kalırsa
-- `silme_borcu_sayisi()` bunu görünür kılıyor.

alter table public.product_photos
  add column if not exists deletion_pending_at timestamptz;

comment on column public.product_photos.deletion_pending_at is
  'Reddedilen karenin depodan silinmesi başarısız olduğunda damgalanır; '
  'photo-check sonraki çağrılarında yeniden dener. Null = borç yok.';

/* Kısmi indeks: borçlu satır sayısı normalde sıfır, tam indeks boşuna yer
   kaplardı. Sıralama en eskiden başlıyor — bir kare kuyrukta sonsuza kadar
   beklememeli. */
create index if not exists product_photos_silme_borcu_idx
  on public.product_photos (deletion_pending_at)
  where deletion_pending_at is not null;

/**
 * Silinmeyi bekleyen kareleri verir ve **damgayı tazeler.**
 *
 * Tazeleme bir kilit yerine geçiyor: iki eşzamanlı `photo-check` çağrısı aynı
 * kareyi almasın diye satır alınır alınmaz sona atılıyor. Gerçek bir kilit
 * değil — aynı nesneyi iki kez silmeye çalışmak zararsız, ikinci silme
 * "bulunamadı" der. Amaç sıra israfını önlemek.
 */
create or replace function public.silme_borcu_al(p_adet integer default 5)
returns table(photo_id uuid, storage_path text)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  return query
  update public.product_photos p
     set deletion_pending_at = now()
   where p.id in (
     select q.id from public.product_photos q
      where q.deletion_pending_at is not null
      order by q.deletion_pending_at
      limit greatest(1, least(p_adet, 25))
      for update skip locked
   )
  returning p.id, p.storage_path;
end;
$function$;

/** Borç kapandı. */
create or replace function public.silme_borcu_kapat(p_photo_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update public.product_photos set deletion_pending_at = null where id = p_photo_id;
$function$;

/** Borç açıldı — silme başarısız oldu. */
create or replace function public.silme_borcu_ac(p_photo_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update public.product_photos set deletion_pending_at = now() where id = p_photo_id;
$function$;

/**
 * Bekleyen borç sayısı — yöneticiye görünür olsun diye.
 *
 * Sıfırdan farklıysa ve yükleme trafiği varken düşmüyorsa, depo silme
 * çağrısında kalıcı bir sorun var demektir ve zamana bağlı süpürücü
 * gerekiyor demektir.
 */
create or replace function public.silme_borcu_sayisi()
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select count(*)::integer from public.product_photos where deletion_pending_at is not null;
$function$;

/* Üçü de iç fonksiyon: çağıranı doğrulamıyorlar, yalnızca `service_role`
   (Edge Function) çağırır. Sayaç yöneticiye açılıyor ama kendi denetimini
   yapan bir sarmalayıcıyla değil — `is_admin()` burada doğrudan uygulanıyor. */
revoke all on function public.silme_borcu_al(integer) from public, anon, authenticated;
revoke all on function public.silme_borcu_kapat(uuid) from public, anon, authenticated;
revoke all on function public.silme_borcu_ac(uuid) from public, anon, authenticated;
revoke all on function public.silme_borcu_sayisi() from public, anon, authenticated;

create or replace function public.admin_silme_borcu_sayisi()
returns integer
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  return public.silme_borcu_sayisi();
end;
$function$;

revoke all on function public.admin_silme_borcu_sayisi() from public, anon;
grant execute on function public.admin_silme_borcu_sayisi() to authenticated;
