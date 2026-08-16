-- KIDS TRADE — Yedi kare fotoğraf
--
-- Ana Doküman 4.2: her ilan yedi açıdan çekilir. Beşi her ilanda zorunludur;
-- altıncı hasar beyan edilmişse, yedincisi ürün setse istenir. Kareler yalnız
-- değerleme girdisi değildir — anlaşmazlık çıktığında tarafların tek nesnel
-- kaydıdır, o yüzden vitrinde gösterilsin ya da gösterilmesin saklanırlar.
--
-- Buraya kadar ilan `create_listing` ile doğrudan ACTIVE açılıyordu. Artık
-- DRAFT açılıyor ve `publish_listing` ile yayına giriyor; o kapı zorunlu
-- karelerin varlığını ve moderasyondan geçtiğini kontrol ediyor.

-- ============================ 1) TASLAK DURUMU ============================

alter table public.products drop constraint if exists products_status_check;
alter table public.products
  add constraint products_status_check
  check (status in ('DRAFT','ACTIVE','RESERVED','SOLD','REMOVED'));

-- ============================ 2) DURUM BEYANLARI ============================
-- Hangi karelerin zorunlu olduğunu bu iki beyan belirler.

alter table public.products
  add column if not exists has_damage boolean not null default false,
  add column if not exists is_set     boolean not null default false;

comment on column public.products.has_damage is
  'Satıcı hasar beyan etti mi — true ise hasar yakın çekimi zorunlu olur.';
comment on column public.products.is_set is
  'Ürün set mi — true ise parça bütünlüğü karesi zorunlu olur.';

-- ============================ 3) KARELER ============================

do $$ begin
  if not exists (select 1 from pg_type where typname = 'photo_slot') then
    create type public.photo_slot as enum
      ('front','back','left','right','label','damage','parts');
  end if;
end $$;

create table if not exists public.product_photos (
  id                uuid primary key default gen_random_uuid(),
  product_id        text not null references public.products(id) on delete cascade,
  slot              public.photo_slot not null,
  storage_path      text not null,
  is_cover          boolean not null default false,
  -- Moderasyon sonucu. 'pending' otomatik onay DEĞİLDİR: yayın kapısı yalnız
  -- 'approved' kareyi geçirir, servis erişilemezse ilan insana kuyruklanır.
  moderation_status text not null default 'pending'
                      check (moderation_status in ('pending','approved','rejected')),
  moderation_reason text,
  created_at        timestamptz not null default now(),
  unique (product_id, slot)
);

create index if not exists product_photos_product_idx on public.product_photos(product_id);

-- Bir ilanda tek kapak olur.
create unique index if not exists product_photos_tek_kapak_uidx
  on public.product_photos(product_id) where is_cover;

-- ============================ 4) GÜVENLİK ============================

alter table public.product_photos enable row level security;

-- Yayındaki ilanın kareleri herkese açık: alıcı detayda yedisini de görür.
drop policy if exists "yayındaki ilanın kareleri açık" on public.product_photos;
create policy "yayındaki ilanın kareleri açık"
  on public.product_photos for select to anon, authenticated
  using (exists (select 1 from public.products p
                  where p.id = product_id and p.status in ('ACTIVE','RESERVED','SOLD')));

-- Satıcı kendi taslağının karelerini görür ve yönetir.
drop policy if exists "kendi karelerini gör" on public.product_photos;
create policy "kendi karelerini gör"
  on public.product_photos for select to authenticated
  using (exists (select 1 from public.products p
                  where p.id = product_id and p.seller_id = auth.uid()));

drop policy if exists "kendi karelerini ekle" on public.product_photos;
create policy "kendi karelerini ekle"
  on public.product_photos for insert to authenticated
  with check (exists (select 1 from public.products p
                       where p.id = product_id and p.seller_id = auth.uid()
                         and p.status = 'DRAFT'));

drop policy if exists "kendi karelerini sil" on public.product_photos;
create policy "kendi karelerini sil"
  on public.product_photos for delete to authenticated
  using (exists (select 1 from public.products p
                  where p.id = product_id and p.seller_id = auth.uid()
                    and p.status = 'DRAFT'));

-- Moderasyon sonucunu istemci yazamaz: UPDATE politikası yok, yalnızca
-- service_role (moderasyon Edge Function'ı) yazar.

-- ============================ 5) DEPOLAMA ============================
-- Kova özel: dosyalar imzalı bağlantıyla okunur. Yol düzeni:
--   {satici_id}/{ilan_id}/{slot}.jpg
-- Böylece ilk klasör adı sahibi belirtir ve politika onun üzerinden yazılır.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', false, 8388608,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "kendi klasörüne yükle" on storage.objects;
create policy "kendi klasörüne yükle"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos'
              and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "kendi klasörünü oku" on storage.objects;
create policy "kendi klasörünü oku"
  on storage.objects for select to authenticated
  using (bucket_id = 'listing-photos'
         and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "kendi klasöründen sil" on storage.objects;
create policy "kendi klasöründen sil"
  on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos'
         and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================ 6) HANGİ KARELER ZORUNLU ============================

create or replace function public.required_slots(p_product_id text)
returns public.photo_slot[]
language sql stable security definer set search_path = public as $$
  select array_remove(array[
    'front'::public.photo_slot,
    'back'::public.photo_slot,
    'left'::public.photo_slot,
    'right'::public.photo_slot,
    'label'::public.photo_slot,
    case when p.has_damage then 'damage'::public.photo_slot end,
    case when p.is_set     then 'parts'::public.photo_slot end
  ], null)
  from public.products p where p.id = p_product_id;
$$;

grant execute on function public.required_slots(text) to authenticated, service_role;

-- ============================ 7) YAYIN KAPISI ============================

create or replace function public.publish_listing(
  p_product_id text,
  p_cover_slot public.photo_slot default 'front'
)
returns public.products
language plpgsql security definer set search_path = public as $$
declare
  p        public.products;
  gerekli  public.photo_slot[];
  eksik    public.photo_slot[];
  bekleyen int;
  reddedilen int;
begin
  select * into p from public.products where id = p_product_id for update;
  if not found then raise exception 'ilan % bulunamadı', p_product_id; end if;
  if p.seller_id is distinct from auth.uid() then
    raise exception 'yalnızca ilan sahibi yayına alabilir';
  end if;
  if p.status <> 'DRAFT' then
    raise exception 'yalnızca taslak ilan yayına alınır (mevcut: %)', p.status;
  end if;

  gerekli := public.required_slots(p_product_id);

  select array_agg(s) into eksik
    from unnest(gerekli) s
   where not exists (select 1 from public.product_photos ph
                      where ph.product_id = p_product_id and ph.slot = s);
  if eksik is not null then
    raise exception 'eksik kare: %', array_to_string(eksik, ', ');
  end if;

  select count(*) filter (where moderation_status = 'rejected'),
         count(*) filter (where moderation_status = 'pending')
    into reddedilen, bekleyen
    from public.product_photos where product_id = p_product_id;

  if reddedilen > 0 then
    raise exception 'moderasyondan geçmeyen kare var; yeniden çekin';
  end if;
  if bekleyen > 0 then
    raise exception 'kareler hâlâ inceleniyor, birazdan tekrar deneyin';
  end if;

  -- Kapak seçimi: yalnızca hangi karenin vitrinde görüneceğini belirler.
  -- Ürünün durumu kapağın üzerinde rozet olarak her hâlükârda görünür, yani
  -- hasar karesini kapak yapmamak kusuru gizlemeye yaramaz.
  if not exists (select 1 from public.product_photos
                  where product_id = p_product_id and slot = p_cover_slot) then
    raise exception 'kapak olarak seçilen kare yok: %', p_cover_slot;
  end if;
  update public.product_photos set is_cover = false where product_id = p_product_id;
  update public.product_photos set is_cover = true
   where product_id = p_product_id and slot = p_cover_slot;

  perform set_config('kt.bypass_product_guard', 'on', true);
  update public.products set status = 'ACTIVE' where id = p_product_id returning * into p;
  perform set_config('kt.bypass_product_guard', 'off', true);

  return p;
end; $$;

revoke all on function public.publish_listing(text, public.photo_slot) from public;
grant execute on function public.publish_listing(text, public.photo_slot) to authenticated;

-- ============================ 8) create_listing ARTIK TASLAK AÇAR ============================

create or replace function public.create_listing(
  p_title       text,
  p_category    text,
  p_condition   text,
  p_size_class  text,
  p_points      integer,
  p_location    text default 'Belirtilmedi',
  p_description text default null,
  p_has_damage  boolean default false,
  p_is_set      boolean default false
)
returns public.products
language plpgsql security definer set search_path = public as $$
declare p public.products; satici uuid := auth.uid(); ad text; bas text;
begin
  if satici is null then raise exception 'ilan vermek için oturum açmalısınız'; end if;
  if p_title is null or btrim(p_title) = '' then raise exception 'başlık zorunludur'; end if;
  if p_points is null or p_points <= 0 then raise exception 'puan sıfırdan büyük olmalı'; end if;
  if not exists (select 1 from public.shipping_rates where size_class = p_size_class) then
    raise exception 'geçersiz desi kademesi: %', p_size_class;
  end if;

  select coalesce(
           nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
           nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
           split_part(coalesce(u.email, 'Üye'), '@', 1))
    into ad from auth.users u where u.id = satici;
  ad := coalesce(ad, 'Üye');
  bas := upper(left(ad, 1)) ||
         upper(coalesce(nullif(left(split_part(ad, ' ', 2), 1), ''), left(ad, 1)));

  insert into public.products (
    title, points, ai_suggested_points, condition, category, size_class,
    location, description, seller_id, seller_name, seller_initials,
    has_damage, is_set, status)
  values (
    btrim(p_title), p_points, p_points, p_condition, p_category, p_size_class,
    coalesce(nullif(btrim(p_location), ''), 'Belirtilmedi'), p_description,
    satici, ad, bas, coalesce(p_has_damage, false), coalesce(p_is_set, false), 'DRAFT')
  returning * into p;

  return p;
end; $$;

drop function if exists public.create_listing(text, text, text, text, integer, text, text);
revoke all on function public.create_listing(text, text, text, text, integer, text, text, boolean, boolean) from public;
grant execute on function public.create_listing(text, text, text, text, integer, text, text, boolean, boolean) to authenticated;
