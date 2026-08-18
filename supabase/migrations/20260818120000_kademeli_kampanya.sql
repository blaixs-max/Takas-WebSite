/**
 * Kampanya iki kademeli oldu: ilk 50 kullanıcı 1000+1000, kalanlar 300+300.
 *
 * Karar kullanıcının (2026-08-18). Sebebi soğuk başlangıç: 250+250 ile yeni
 * bir kullanıcı vitrindeki hiçbir şeyi alamıyordu (en pahalı ilan 7030 puan,
 * en zengin cüzdan 1480). İlk elli kişiye ciddi bir başlangıç puanı vermek,
 * ilk takasların gerçekten olmasını sağlıyor — pazaryeri ancak iki tarafında
 * da hareket varsa çalışıyor.
 *
 * Toplam üst sınır **1000 kullanıcı** olarak kalıyor (Ana Doküman 2.4).
 * Yani 50 × 2000 + 950 × 600 = 670.000 puanlık bir tavan.
 *
 * ## Kademe kullanıcıya kilitleniyor, ana kilitlenmiyor
 *
 * Bu dosyanın asıl kararı ve tek zor kısmı bu.
 *
 * Bir kullanıcı iki hak alıyor: ilk ilan ve ilk satış. İkisi arasında haftalar
 * geçebilir. Kişi 40. kullanıcı olarak ilanını verirse "ilk 50"dedir ve 1000
 * puan alır; satışı ise 300. kullanıcı katıldıktan sonra tamamlanabilir.
 *
 * Kademeyi **o anki sayıya** göre seçseydik aynı kişi 1000 + 300 alırdı. Bu
 * hem yanlış hem de kırıcı: kullanıcıya "ilk 50 içindesin" denmiş, sonra
 * ikinci hakta sessizce kademe düşürülmüş olurdu. "İlk 50 kullanıcı" kişinin
 * bir özelliği, anın değil.
 *
 * Bu yüzden kademe **ilk hakta belirlenir ve satıra yazılır** (`erken`).
 * İkinci hak o satırı okur. Kayıt hem denetlenebilir hem de geriye dönük
 * yeniden hesaplanamaz — `campaign_grants` zaten değiştirilemez bir tablo
 * (`campaign_grants_degismez` tetikleyicisi).
 */

alter table public.campaign_settings
  add column if not exists erken_kullanici_sayisi integer not null default 50
    check (erken_kullanici_sayisi >= 0),
  add column if not exists erken_listing_grant_points integer not null default 1000
    check (erken_listing_grant_points > 0),
  add column if not exists erken_sale_grant_points integer not null default 1000
    check (erken_sale_grant_points > 0);

comment on column public.campaign_settings.erken_kullanici_sayisi is
  'Kaç kullanıcı yüksek kademeden yararlanır. Kademe kullanıcıya kilitlenir: '
  'ilk hakta belirlenir, ikinci hak aynı kademeden verilir.';

/* Normal kademe 250'den 300'e. `max_users` 1000 olarak kalıyor. */
update public.campaign_settings
   set listing_grant_points       = 300,
       sale_grant_points          = 300,
       erken_kullanici_sayisi     = 50,
       erken_listing_grant_points = 1000,
       erken_sale_grant_points    = 1000,
       updated_at                 = now()
 where id;

/**
 * Hangi kademeden alındığı kaydediliyor.
 *
 * `null` bırakılmıyor, varsayılan `false`: bu göçten önce verilmiş haklar
 * normal kademeden verildi ve öyle kalmalı. Geriye dönük 1000'e çıkarmak,
 * dağıtılmış puanı sonradan artırmak olurdu — cüzdan defteri o rakamı
 * taşıyor ve ikisi ayrışırdı.
 */
alter table public.campaign_grants
  add column if not exists erken boolean not null default false;

comment on column public.campaign_grants.erken is
  'Bu hak yüksek kademeden mi verildi. Kullanıcının ikinci hakkı bu alanı '
  'okuyarak aynı kademeden veriliyor — "ilk 50" kişinin özelliği, anın değil.';

/**
 * `grant_campaign_points` — kademeli.
 *
 * Değişen tek şey puanın nereden geldiği. Bütün suistimal kontrolleri
 * (telefon doğrulaması, aynı numarayla ikinci hesap, hesap başına tek hak,
 * toplam kontenjan) aynen duruyor ve sırası bozulmadı.
 */
create or replace function public.grant_campaign_points(p_user uuid, p_kind text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  s public.campaign_settings;
  tel text;
  dogrulandi timestamptz;
  puan integer;
  mevcut_kullanici integer;
  erken_mi boolean;
begin
  select * into s from public.campaign_settings where id;
  if not found or not s.active then
    return false;
  end if;

  -- Zaten almışsa çık.
  if exists (select 1 from public.campaign_grants g
              where g.user_id = p_user and g.kind = p_kind) then
    return false;
  end if;

  -- 2.4: telefon doğrulaması olmadan verilmez.
  select u.phone, u.phone_confirmed_at into tel, dogrulandi
    from auth.users u where u.id = p_user;
  if tel is null or btrim(tel) = '' or dogrulandi is null then
    return false;
  end if;

  -- Aynı numara başka bir hesapla bu hakkı almışsa verilmez.
  if exists (select 1 from public.campaign_grants g
              where g.phone = tel and g.kind = p_kind) then
    return false;
  end if;

  -- Toplam kontenjan. Daha önce hak almış kullanıcı sınırı yeniden yoklamaz.
  select count(distinct g.user_id) into mevcut_kullanici from public.campaign_grants g;
  if mevcut_kullanici >= s.max_users then
    return false;
  end if;

  /* KADEME.
     Kullanıcının önceki bir hakkı varsa onun kademesi geçerli — "ilk 50"
     kişinin özelliği, anın değil. Yoksa kampanyaya şimdi katılıyor demektir
     ve sırası mevcut kullanıcı sayısı. */
  select g.erken into erken_mi
    from public.campaign_grants g
   where g.user_id = p_user
   order by g.created_at
   limit 1;

  if erken_mi is null then
    erken_mi := mevcut_kullanici < s.erken_kullanici_sayisi;
  end if;

  puan := case
            when erken_mi and p_kind = 'FIRST_LISTING' then s.erken_listing_grant_points
            when erken_mi and p_kind = 'FIRST_SALE'    then s.erken_sale_grant_points
            when p_kind = 'FIRST_LISTING'              then s.listing_grant_points
            when p_kind = 'FIRST_SALE'                 then s.sale_grant_points
          end;
  if puan is null then
    return false;
  end if;

  insert into public.campaign_grants (user_id, kind, points, phone, erken)
  values (p_user, p_kind, puan, tel, erken_mi);

  perform public.earn_points(
    p_user, puan,
    'campaign:' || p_kind || ':' || p_user::text,
    case p_kind when 'FIRST_LISTING' then 'Kampanya — ilk ilan'
                else 'Kampanya — ilk satış' end);

  return true;
end; $$;

revoke all on function public.grant_campaign_points(uuid, text) from public;
grant execute on function public.grant_campaign_points(uuid, text) to service_role;

/**
 * `campaign_status` kademeyi de gösteriyor.
 *
 * Yönetim ekranı "kalan kontenjan 950" derken hangi kademeden bahsettiğini
 * söylemezse rakam yanıltıcı olur: asıl merak edilen, yüksek kademede kaç yer
 * kaldığı. `create or replace` dönüş tipini değiştiremiyor, o yüzden önce
 * düşürülüyor.
 */
drop function if exists public.campaign_status();

create or replace function public.campaign_status()
returns table (
  aktif             boolean,
  kullanici_sayisi  bigint,
  kalan_kontenjan   integer,
  dagitilan_puan    bigint,
  ilk_ilan_hakki    bigint,
  ilk_satis_hakki   bigint,
  erken_kalan       integer,
  erken_kullanici   bigint
)
language sql stable security definer set search_path = public as $$
  select s.active,
         (select count(distinct g.user_id) from public.campaign_grants g),
         greatest(s.max_users - (select count(distinct g.user_id)::integer
                                   from public.campaign_grants g), 0),
         (select coalesce(sum(g.points), 0) from public.campaign_grants g),
         (select count(*) from public.campaign_grants g where g.kind = 'FIRST_LISTING'),
         (select count(*) from public.campaign_grants g where g.kind = 'FIRST_SALE'),
         greatest(s.erken_kullanici_sayisi - (select count(distinct g.user_id)::integer
                                                from public.campaign_grants g), 0),
         (select count(distinct g.user_id) from public.campaign_grants g where g.erken)
    from public.campaign_settings s
   where s.id and public.is_admin();
$$;

revoke all on function public.campaign_status() from public;
grant execute on function public.campaign_status() to authenticated, service_role;
