-- KIDS TRADE — Kampanya puanı motoru (Ana Doküman 2.4)
--
-- Kapalı devrede puan parayla alınamıyor: yeni kullanıcı önce satmak zorunda,
-- ama satabilmesi için karşısında puanı olan bir alıcı gerekiyor. Kilidi kıran
-- şey kampanya puanının SATIŞTA DEĞİL, İLAN YAYINLANDIĞINDA verilmesi.
--
-- Motor olmadan kampanya başlatılamaz. Elle dağıtılsaydı hiçbir garanti
-- kalmazdı: aynı kişi tekrar tekrar alır, 1000 kullanıcı sınırı tutulamaz,
-- toplam yükümlülük ölçülemezdi.
--
-- 500.000 puan kalıcı bir yükümlülüktür ve puanın süresi olmadığı için
-- kendiliğinden sönmez. Bu yüzden her hak tek tek kaydedilir ve sayılır.

-- ============================ 1) AYARLAR ============================

create table if not exists public.campaign_settings (
  id                    boolean primary key default true check (id),
  active                boolean not null default true,
  listing_grant_points  integer not null check (listing_grant_points > 0),
  sale_grant_points     integer not null check (sale_grant_points > 0),
  -- 2.4: "İlk 1000 kullanıcı." Sınır, hak almış AYRI kullanıcı sayısıdır;
  -- bir kullanıcının iki hakkı da alması onu iki kişi saymaz.
  max_users             integer not null check (max_users > 0),
  updated_at            timestamptz not null default now()
);

insert into public.campaign_settings (id, active, listing_grant_points, sale_grant_points, max_users)
values (true, true, 250, 250, 1000)
on conflict (id) do update set
  listing_grant_points = excluded.listing_grant_points,
  sale_grant_points    = excluded.sale_grant_points,
  max_users            = excluded.max_users,
  updated_at           = now();

alter table public.campaign_settings enable row level security;
drop policy if exists "kampanya ayarları herkese açık" on public.campaign_settings;
create policy "kampanya ayarları herkese açık"
  on public.campaign_settings for select to anon, authenticated using (true);

-- ============================ 2) HAK KAYDI ============================

create table if not exists public.campaign_grants (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  kind       text not null check (kind in ('FIRST_LISTING','FIRST_SALE')),
  points     integer not null check (points > 0),
  -- Hakkın verildiği andaki doğrulanmış telefon. Kullanıcı sonradan numarasını
  -- değiştirse bile suistimal kontrolü bu kayda dayanır.
  phone      text not null,
  created_at timestamptz not null default now(),
  -- 2.4: hesap başına bir kez.
  constraint campaign_grants_tek_hak unique (user_id, kind)
);

-- 2.4: "aynı telefon numarasıyla ikinci hesap açılamaz." Hesap açmayı Auth
-- ayarları engeller; burada engellediğimiz şey aynı numaranın ikinci bir hesap
-- üzerinden aynı hakkı ikinci kez almasıdır — paranın döndüğü yer burası.
create unique index if not exists campaign_grants_telefon_uidx
  on public.campaign_grants(phone, kind);

create index if not exists campaign_grants_user_idx on public.campaign_grants(user_id);

alter table public.campaign_grants enable row level security;

drop policy if exists "kendi kampanya hakkını gör" on public.campaign_grants;
create policy "kendi kampanya hakkını gör"
  on public.campaign_grants for select to authenticated using (user_id = auth.uid());

drop policy if exists "yönetici kampanya haklarını görür" on public.campaign_grants;
create policy "yönetici kampanya haklarını görür"
  on public.campaign_grants for select to authenticated using (public.is_admin());

-- Yüklenmiş kampanya puanı geri alınmaz (2.4). Kaydı silmek, defterdeki
-- hareketi bırakıp hakkı serbest bırakmak olurdu: aynı kişi ikinci kez alırdı.
create or replace function public.campaign_grants_degismez()
returns trigger language plpgsql as $$
begin
  raise exception 'kampanya hakkı geri alınamaz veya değiştirilemez';
end; $$;

drop trigger if exists campaign_grants_no_update on public.campaign_grants;
create trigger campaign_grants_no_update before update on public.campaign_grants
  for each row execute function public.campaign_grants_degismez();

drop trigger if exists campaign_grants_no_delete on public.campaign_grants;
create trigger campaign_grants_no_delete before delete on public.campaign_grants
  for each row execute function public.campaign_grants_degismez();

-- ============================ 3) HAK VERME ============================
-- Sessizdir: koşullar sağlanmıyorsa hata vermez, yalnızca hak vermez. Çağıran
-- yerler ilan yayınlama ve takas tamamlama — kampanya kuralı yüzünden bir
-- ilanın yayına girmemesi ya da bir takasın tamamlanmaması kabul edilemez.

create or replace function public.grant_campaign_points(p_user uuid, p_kind text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  s public.campaign_settings;
  tel text;
  dogrulandi timestamptz;
  puan integer;
  mevcut_kullanici integer;
begin
  select * into s from public.campaign_settings where id;
  if not found or not s.active then
    return false;
  end if;

  -- Zaten almışsa çık. Benzersiz kısıt da engeller ama sessiz dönmek,
  -- çağıranın istisna yakalamak zorunda kalmamasını sağlar.
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

  -- 1000 kullanıcı sınırı. Daha önce hak almış bir kullanıcının ikinci hakkı
  -- sınırı yeniden yoklamaz: o zaten kampanyanın içinde.
  select count(distinct g.user_id) into mevcut_kullanici from public.campaign_grants g;
  if mevcut_kullanici >= s.max_users then
    return false;
  end if;

  puan := case p_kind
            when 'FIRST_LISTING' then s.listing_grant_points
            when 'FIRST_SALE'    then s.sale_grant_points
          end;
  if puan is null then
    return false;
  end if;

  insert into public.campaign_grants (user_id, kind, points, phone)
  values (p_user, p_kind, puan, tel);

  -- Defter hareketi. Idempotency anahtarı kullanıcı ve hak türünden türetiliyor:
  -- aynı hak iki kez yazılamaz, kayıt bir şekilde tekrarlansa bile.
  perform public.earn_points(
    p_user, puan,
    'campaign:' || p_kind || ':' || p_user::text,
    case p_kind when 'FIRST_LISTING' then 'Kampanya — ilk ilan'
                else 'Kampanya — ilk satış' end);

  return true;
end; $$;

revoke all on function public.grant_campaign_points(uuid, text) from public;
grant execute on function public.grant_campaign_points(uuid, text) to service_role;

-- ============================ 4) İLK İLAN ============================
-- publish_listing() içine gömmek yerine trigger: ilan hangi yoldan yayına
-- girerse girsin (kullanıcı, yönetici, ileride toplu işlem) hak aynı anda doğar.

create or replace function public.products_campaign_on_publish()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'ACTIVE' and old.status = 'DRAFT' and new.seller_id is not null then
    -- Reddedilen ilan hak doğurmaz: buraya yalnızca yayın kapısından geçen
    -- ilan gelir, kapı da onaysız kareyi geçirmez.
    perform public.grant_campaign_points(new.seller_id, 'FIRST_LISTING');
  end if;
  return new;
end; $$;

drop trigger if exists products_campaign_publish on public.products;
create trigger products_campaign_publish
  after update on public.products
  for each row execute function public.products_campaign_on_publish();

-- ============================ 5) İLK SATIŞ ============================

create or replace function public.trades_campaign_on_complete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'COMPLETED' and old.status is distinct from 'COMPLETED' then
    perform public.grant_campaign_points(new.seller_id, 'FIRST_SALE');
  end if;
  return new;
end; $$;

drop trigger if exists trades_campaign_complete on public.trades;
create trigger trades_campaign_complete
  after update on public.trades
  for each row execute function public.trades_campaign_on_complete();

-- ============================ 6) YÜKÜMLÜLÜK ÖLÇÜMÜ ============================
-- 2.4: "Bu rakam pazarlama bütçesidir, hediye değil." Ölçülemeyen bütçe
-- yönetilemez; dağıtılan toplam ve kalan kontenjan her an görülebilmeli.

create or replace function public.campaign_status()
returns table (
  aktif             boolean,
  kullanici_sayisi  bigint,
  kalan_kontenjan   integer,
  dagitilan_puan    bigint,
  ilk_ilan_hakki    bigint,
  ilk_satis_hakki   bigint
)
language sql stable security definer set search_path = public as $$
  select s.active,
         (select count(distinct g.user_id) from public.campaign_grants g),
         greatest(s.max_users - (select count(distinct g.user_id)::integer
                                   from public.campaign_grants g), 0),
         (select coalesce(sum(g.points), 0) from public.campaign_grants g),
         (select count(*) from public.campaign_grants g where g.kind = 'FIRST_LISTING'),
         (select count(*) from public.campaign_grants g where g.kind = 'FIRST_SALE')
    from public.campaign_settings s
   where s.id and public.is_admin();
$$;

revoke all on function public.campaign_status() from public;
grant execute on function public.campaign_status() to authenticated;
grant execute on function public.campaign_status() to service_role;
