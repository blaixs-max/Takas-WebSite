-- Kare denetimi: ölçüm, oran sınırı ve red sebebi.
--
-- ## Neden tek tablo
--
-- Üç ihtiyaç aynı veriden besleniyor:
--
--  1. **Maliyet ölçümü.** `TODO.md` "ilan başına kuruş mertebesinde ama
--     ölçülmüş bir rakam yok" diyor. Ücretli katmana geçerken tahminle
--     devam etmek, faturayı ilk ay öğrenmek demek.
--  2. **Oran sınırı.** Oturum açmış bir kullanıcı arka arkaya kare
--     yükleyerek kotayı yakabilir. Ücretsiz katmanda bu bir gecikmeydi,
--     ücretlide doğrudan para.
--  3. **Red sebebi dağılımı.** Hangi red baskın? "Yanlış açı" baskınsa
--     çekim ekranının yönlendirmesi zayıf demektir; "stok görsel" baskınsa
--     dolandırma denemesi var demektir. İkisi çok farklı işler.
--
-- Üçü için üç ayrı yapı kurmak, üçünün de ayrışması demekti.
--
-- ## Neden `sebep` serbest metin değil
--
-- Red gerekçesi bugün modelin yazdığı bir cümle. Cümle kullanıcıya
-- gösterilmek için iyi, sayılmak için kötü — model her seferinde başka
-- türlü yazıyor. Ayrıca **ikinci görüş mekanizması buna bağlı**: güvenlik
-- sebebiyle (çocuk yüzü, arka plan) verilen red ikinci bir modelle
-- bozulamaz, ürün sebebiyle (yanlış açı, aynı açı) verilen red bozulabilir.
-- Bu ayrımı serbest metin üzerinden yapmak, cümle eşleştirmek olurdu.

create table if not exists public.photo_check_events (
  id            bigserial primary key,
  user_id       uuid not null,
  photo_id      uuid,
  model         text not null,
  karar         text not null check (karar in ('approved', 'rejected', 'pending')),
  sebep         text,
  ikinci_gorus  boolean not null default false,
  giris_token   integer,
  cikis_token   integer,
  sure_ms       integer,
  created_at    timestamptz not null default now()
);

comment on table public.photo_check_events is
  'photo-check her çağrısında bir satır. Maliyet ölçümü, oran sınırı ve red '
  'sebebi dağılımı bu tablodan okunur. İstemciye kapalı.';

/* Oran sınırı sorgusu (user_id + son bir saat) bu indeksten geçiyor. */
create index if not exists photo_check_events_user_idx
  on public.photo_check_events (user_id, created_at desc);

alter table public.photo_check_events enable row level security;
/* Politika yok = her satır süzülür. `service_role` RLS'i atlıyor, yani
   yalnızca Edge Function yazıyor ve okuyor. Kullanıcının kendi satırlarını
   görmesi için bir sebep yok: burada onun işine yarayan bir bilgi yok,
   maliyet ve model adı var. */

/* **Yetki de geri alınıyor, RLS'e güvenilmiyor.** Supabase yeni tabloya
   varsayılan olarak anon + authenticated SELECT veriyor; RLS politikasız
   olduğu için satırlar bugün zaten süzülüyor, yani tek başına yeterli
   görünüyor. Ama o tek katman: ileride biri buraya "kendi satırını görsün"
   diye izin verici bir politika eklerse ya da RLS bir göçte kapanırsa,
   yetki çoktan verilmiş durumda olur. Bu depo aynı kararı `vitrin-cek`te de
   verdi (SELECT izin listesi **ve** alan alan nesne) — iki katman birden. */
revoke all on table public.photo_check_events from public, anon, authenticated;
revoke all on sequence public.photo_check_events_id_seq from public, anon, authenticated;

/**
 * Kullanıcının saatlik denetim hakkı kaldı mı?
 *
 * Sınır kareye değil **çağrıya** bakıyor: reddedilen kare yeniden çekilip
 * yeniden gönderiliyor ve her deneme para. Dürüst bir satıcı için 60 bol
 * bol yeter — ilan başına 7 kare, yani saatte sekiz ilan. Bunu aşan biri
 * ilan girmiyor, başka bir şey yapıyor.
 */
create or replace function public.foto_denetim_hakki(
  p_user_id uuid,
  p_saatlik integer default 60
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select count(*) < greatest(1, p_saatlik)
    from public.photo_check_events
   where user_id = p_user_id
     and created_at > now() - interval '1 hour';
$function$;

/** Bir denetim çağrısını kaydeder. */
create or replace function public.foto_denetim_kaydet(
  p_user_id      uuid,
  p_photo_id     uuid,
  p_model        text,
  p_karar        text,
  p_sebep        text default null,
  p_ikinci_gorus boolean default false,
  p_giris_token  integer default null,
  p_cikis_token  integer default null,
  p_sure_ms      integer default null
)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  insert into public.photo_check_events
    (user_id, photo_id, model, karar, sebep, ikinci_gorus,
     giris_token, cikis_token, sure_ms)
  values
    (p_user_id, p_photo_id, p_model, p_karar, p_sebep, p_ikinci_gorus,
     p_giris_token, p_cikis_token, p_sure_ms);
$function$;

/**
 * Son N günün özeti — yöneticiye.
 *
 * Tek satırlık bir tablo değil, model ve karar kırılımı: "Flash yeterli mi"
 * sorusunun cevabı burada. İkinci görüşün ne sıklıkta çağrıldığı ve ne
 * sıklıkta reddi bozduğu, daha güçlü modele geçmenin gerekip gerekmediğini
 * tahminle değil sayıyla söyler.
 */
create or replace function public.admin_foto_denetim_ozeti(p_gun integer default 7)
returns table(
  model text,
  karar text,
  sebep text,
  ikinci_gorus boolean,
  adet bigint,
  toplam_giris_token bigint,
  toplam_cikis_token bigint,
  ortalama_ms numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  return query
    select e.model, e.karar, e.sebep, e.ikinci_gorus,
           count(*)::bigint,
           coalesce(sum(e.giris_token), 0)::bigint,
           coalesce(sum(e.cikis_token), 0)::bigint,
           round(avg(e.sure_ms)::numeric, 0)
      from public.photo_check_events e
     where e.created_at > now() - make_interval(days => greatest(1, p_gun))
     group by e.model, e.karar, e.sebep, e.ikinci_gorus
     order by count(*) desc;
end;
$function$;

/* İlk üçü iç fonksiyon: çağıranı doğrulamıyorlar, yalnızca `service_role`
   çağırır. Özet yöneticiye açık ve kendi `is_admin()` denetimini yapıyor. */
revoke all on function public.foto_denetim_hakki(uuid, integer) from public, anon, authenticated;
revoke all on function public.foto_denetim_kaydet(uuid, uuid, text, text, text, boolean, integer, integer, integer)
  from public, anon, authenticated;
revoke all on function public.admin_foto_denetim_ozeti(integer) from public, anon;
grant execute on function public.admin_foto_denetim_ozeti(integer) to authenticated;
