-- ELDENELE — Kategori ve Filtreleme Matrisi'ne geçiş
--
-- Kaynak: "ELDENELE · Ürün Mimarisi — Kategori ve Filtreleme Matrisi"
-- (Nihai, 12 Ağustos 2026). Doküman hem mobil hem web için geçerli.
--
-- Neden bir göç gerekiyor: `products.category` düz bir CHECK listesiydi ve
-- eski on dört kategoriyi sayıyordu. Uygulama dokuz kategoriye geçtiği anda
-- `create_listing` ilk ilanda kısıt hatasıyla düşerdi.
--
-- Neden CHECK değil de tablo: yeni yapıda 9 ana + 62 alt kategori var ve alt
-- kategorinin hangi anaya ait olduğu da kurala dahil. Bunu tek bir CHECK
-- ifadesinde tutmak 62 satırlık bir metin bloğu demek; her kategori
-- eklendiğinde fonksiyon gövdesi yeniden yazılırdı. Referans tablosu hem
-- kısıtı hem sırayı taşır, hem de ileride uygulamanın okuyabileceği bir
-- kaynak olur.
--
-- Eşleme kayıplıdır ve öyle olmak zorunda: eski "Elektronik" tek başına bir
-- ana kategoriydi, yeni yapıda "Kitap & Eğitim → Eğitici elektronik" altına
-- düşüyor. Aşağıdaki tablo bu kararların tamamını açıkça yazar; sessizce
-- düşen satır yoktur.

-- ============================ 1) Referans tabloları ============================

create table if not exists public.product_categories (
  name text primary key,
  sort smallint not null unique
);

create table if not exists public.product_sub_categories (
  category text    not null references public.product_categories(name) on update cascade,
  name     text    not null,
  sort     smallint not null,
  primary key (category, name)
);

create index if not exists product_sub_categories_category_idx
  on public.product_sub_categories(category);

insert into public.product_categories (name, sort) values
  ('Bebek Arabası & Puset', 1),
  ('Oto Koltuğu & Seyahat', 2),
  ('Oda & Uyku', 3),
  ('Beslenme', 4),
  ('Bakım & Güvenlik', 5),
  ('Oyun & Oyuncak', 6),
  ('Kitap & Eğitim', 7),
  ('Giyim & Ayakkabı', 8),
  ('Spor & Dış Mekân', 9)
on conflict (name) do update set sort = excluded.sort;

insert into public.product_sub_categories (category, name, sort) values
  ('Bebek Arabası & Puset', 'Bebek arabaları', 1),
  ('Bebek Arabası & Puset', 'Puset & portbebe', 2),
  ('Bebek Arabası & Puset', 'Bebek taşıyıcıları', 3),
  ('Bebek Arabası & Puset', 'Aksesuarlar', 4),
  ('Oto Koltuğu & Seyahat', 'Bebek oto koltukları', 1),
  ('Oto Koltuğu & Seyahat', 'Çocuk oto koltukları', 2),
  ('Oto Koltuğu & Seyahat', 'Yükseltici & baza', 3),
  ('Oto Koltuğu & Seyahat', 'Oto aksesuarları', 4),
  ('Oto Koltuğu & Seyahat', 'Seyahat ürünleri', 5),
  ('Oda & Uyku', 'Beşik & yatak', 1),
  ('Oda & Uyku', 'Dinlenme', 2),
  ('Oda & Uyku', 'Mobilya', 3),
  ('Oda & Uyku', 'Düzenleme', 4),
  ('Oda & Uyku', 'Uyku tekstili', 5),
  ('Oda & Uyku', 'Aydınlatma & dekor', 6),
  ('Beslenme', 'Mama sandalyesi', 1),
  ('Beslenme', 'Öğrenme & destek', 2),
  ('Beslenme', 'Hazırlama cihazları', 3),
  ('Beslenme', 'Sofra ürünleri', 4),
  ('Beslenme', 'Saklama & taşıma', 5),
  ('Beslenme', 'Emzirme & sağım', 6),
  ('Bakım & Güvenlik', 'Banyo', 1),
  ('Bakım & Güvenlik', 'Alt değiştirme', 2),
  ('Bakım & Güvenlik', 'Tuvalet eğitimi', 3),
  ('Bakım & Güvenlik', 'Bakım cihazları', 4),
  ('Bakım & Güvenlik', 'İzleme', 5),
  ('Bakım & Güvenlik', 'Ev güvenliği', 6),
  ('Bakım & Güvenlik', 'Güvenli oyun alanı', 7),
  ('Bakım & Güvenlik', 'Çocuk takibi', 8),
  ('Oyun & Oyuncak', 'Bebek aktivite', 1),
  ('Oyun & Oyuncak', 'Bebek oyuncakları', 2),
  ('Oyun & Oyuncak', 'Gelişim & duyu', 3),
  ('Oyun & Oyuncak', 'Yapı & inşa', 4),
  ('Oyun & Oyuncak', 'Puzzle & zekâ', 5),
  ('Oyun & Oyuncak', 'Rol oyunu', 6),
  ('Oyun & Oyuncak', 'Bebek, figür & pelüş', 7),
  ('Oyun & Oyuncak', 'Araç & pist', 8),
  ('Oyun & Oyuncak', 'Müzik & elektronik', 9),
  ('Oyun & Oyuncak', 'Kutu & kart oyunları', 10),
  ('Kitap & Eğitim', 'Kitaplar', 1),
  ('Kitap & Eğitim', 'Eğitim materyalleri', 2),
  ('Kitap & Eğitim', 'STEM & deney', 3),
  ('Kitap & Eğitim', 'Okul ürünleri', 4),
  ('Kitap & Eğitim', 'Sanat & hobi', 5),
  ('Kitap & Eğitim', 'Eğitici elektronik', 6),
  ('Giyim & Ayakkabı', 'Temel giyim', 1),
  ('Giyim & Ayakkabı', 'Üst giyim', 2),
  ('Giyim & Ayakkabı', 'Alt giyim', 3),
  ('Giyim & Ayakkabı', 'Elbise & etek', 4),
  ('Giyim & Ayakkabı', 'Uyku giyimi', 5),
  ('Giyim & Ayakkabı', 'Dış giyim', 6),
  ('Giyim & Ayakkabı', 'Spor & plaj', 7),
  ('Giyim & Ayakkabı', 'Kostüm', 8),
  ('Giyim & Ayakkabı', 'Ayakkabı', 9),
  ('Giyim & Ayakkabı', 'Aksesuar', 10),
  ('Spor & Dış Mekân', 'Bisiklet', 1),
  ('Spor & Dış Mekân', 'Scooter & binilebilir araç', 2),
  ('Spor & Dış Mekân', 'Paten & kaykay', 3),
  ('Spor & Dış Mekân', 'Spor ekipmanları', 4),
  ('Spor & Dış Mekân', 'Koruyucu ekipman', 5),
  ('Spor & Dış Mekân', 'Bahçe & açık hava', 6),
  ('Spor & Dış Mekân', 'Deniz & kamp', 7)
on conflict (category, name) do update set sort = excluded.sort;

-- Referans tabloları vitrini gezmek için okunabilir olmalı; yazma yalnızca
-- göçle olur, istemciye insert/update/delete açılmaz.
alter table public.product_categories     enable row level security;
alter table public.product_sub_categories enable row level security;

drop policy if exists "kategori ağacı herkese açık"     on public.product_categories;
drop policy if exists "alt kategori ağacı herkese açık" on public.product_sub_categories;

create policy "kategori ağacı herkese açık"
  on public.product_categories for select to anon, authenticated using (true);

create policy "alt kategori ağacı herkese açık"
  on public.product_sub_categories for select to anon, authenticated using (true);

-- ============================ 2) products.sub_category ============================

alter table public.products add column if not exists sub_category text;

-- Eski CHECK kalkıyor; yerini referans tablolarına bakan iki dış anahtar alacak.
alter table public.products drop constraint if exists products_category_check;

-- ============================ 3) Eski kategorilerin eşlenmesi ============================
--
-- | Eski (14)                  | Yeni ana               | Yeni alt              |
-- |----------------------------|------------------------|-----------------------|
-- | Annelere Özel              | Beslenme               | Emzirme & sağım       |
-- | Oda & Dekorasyon           | Oda & Uyku             | Aydınlatma & dekor    |
-- | Giyim & Aksesuar           | Giyim & Ayakkabı       | Temel giyim           |
-- | Tekstil                    | Oda & Uyku             | Uyku tekstili         |
-- | Banyo & Bakım              | Bakım & Güvenlik       | Banyo                 |
-- | Beslenme                   | Beslenme               | Sofra ürünleri        |
-- | Bebek & Çocuk Araç Gereç   | Bebek Arabası & Puset  | Bebek arabaları       |
-- | Oto Koltuğu                | Oto Koltuğu & Seyahat  | Çocuk oto koltukları  |
-- | Oyuncak                    | Oyun & Oyuncak         | Bebek oyuncakları     |
-- | Kitap & Kırtasiye          | Kitap & Eğitim         | Kitaplar              |
-- | Parti & Kostüm             | Giyim & Ayakkabı       | Kostüm                |
-- | Güvenlik                   | Bakım & Güvenlik       | Ev güvenliği          |
-- | Sağlık                     | Bakım & Güvenlik       | Bakım cihazları       |
-- | Elektronik                 | Kitap & Eğitim         | Eğitici elektronik    |
--
-- Muafiyet açık yazılıyor: `products_client_update_guard` istemci
-- güncellemelerini kilitliyor ve göç `auth.uid()` boşken koşsa da canlıda
-- `postgres` rolüyle çalıştığı kesin değil. Muafiyet olmadan bu blok, bir
-- oturum bağlamında çalıştırıldığında sessizce değil gürültüyle düşerdi.
do $$
declare
  esleme constant text[][] := array[
    array['Annelere Özel',            'Beslenme',              'Emzirme & sağım'],
    array['Oda & Dekorasyon',         'Oda & Uyku',            'Aydınlatma & dekor'],
    array['Giyim & Aksesuar',         'Giyim & Ayakkabı',      'Temel giyim'],
    array['Tekstil',                  'Oda & Uyku',            'Uyku tekstili'],
    array['Banyo & Bakım',            'Bakım & Güvenlik',      'Banyo'],
    array['Beslenme',                 'Beslenme',              'Sofra ürünleri'],
    array['Bebek & Çocuk Araç Gereç', 'Bebek Arabası & Puset', 'Bebek arabaları'],
    array['Oto Koltuğu',              'Oto Koltuğu & Seyahat', 'Çocuk oto koltukları'],
    array['Oyuncak',                  'Oyun & Oyuncak',        'Bebek oyuncakları'],
    array['Kitap & Kırtasiye',        'Kitap & Eğitim',        'Kitaplar'],
    array['Parti & Kostüm',           'Giyim & Ayakkabı',      'Kostüm'],
    array['Güvenlik',                 'Bakım & Güvenlik',      'Ev güvenliği'],
    array['Sağlık',                   'Bakım & Güvenlik',      'Bakım cihazları'],
    array['Elektronik',               'Kitap & Eğitim',        'Eğitici elektronik']
  ];
  i int;
  kalan int;
begin
  perform set_config('kt.bypass_product_guard', 'on', true);

  for i in 1 .. array_length(esleme, 1) loop
    update public.products
       set category     = esleme[i][2],
           sub_category = esleme[i][3]
     where category = esleme[i][1];
  end loop;

  -- Demo ilanların alt kategorisi bloğun tamamı için seçilen 'Bebek
  -- oyuncakları'ndan daha isabetli olabiliyor; dördü tek tek düzeltiliyor.
  update public.products set sub_category = 'Yapı & inşa'    where id = 'blocks';
  update public.products set sub_category = 'Gelişim & duyu' where id in ('sorter', 'rings', 'rings-natural');

  perform set_config('kt.bypass_product_guard', 'off', true);

  -- Eşlemeden geçmemiş bir kategori kaldıysa dış anahtar birazdan zaten
  -- reddedecek; hatayı orada değil burada, adıyla vermek daha okunur.
  select count(*) into kalan
    from public.products p
   where not exists (select 1 from public.product_categories c where c.name = p.category);
  if kalan > 0 then
    raise exception 'eşlenemeyen kategori taşıyan % ilan var', kalan;
  end if;
end $$;

-- ============================ 4) Kısıtlar ============================

alter table public.products drop constraint if exists products_category_fkey;
alter table public.products drop constraint if exists products_sub_category_fkey;

-- Ana kategori her zaman ağaçtan gelir.
alter table public.products
  add constraint products_category_fkey
  foreign key (category) references public.product_categories(name) on update cascade;

-- Alt kategori, ana kategorisiyle birlikte doğrulanır: "Giyim & Ayakkabı /
-- Bisiklet" gibi bir çift kabul edilmez. NULL olabilir çünkü ilan TASLAK
-- doğar ve alt kategori yayına girerken zorunlu olur (bkz. publish_listing).
alter table public.products
  add constraint products_sub_category_fkey
  foreign key (category, sub_category)
  references public.product_sub_categories(category, name) on update cascade;

create index if not exists products_sub_category_idx on public.products(sub_category);

-- ============================ 5) create_listing alt kategori alır ============================
--
-- Yeni parametre SONA ekleniyor. Ortaya alınsaydı konumsal çağrı yapan her
-- yer (arka uç testlerinin tamamı) sessizce kayardı: 'Az kullanılmış' alt
-- kategori sanılır, kondisyon bir sonraki argümana düşerdi.

create or replace function public.create_listing(
  p_title        text,
  p_category     text,
  p_condition    text,
  p_size_class   text,
  p_points       integer,
  p_location     text default 'Belirtilmedi',
  p_description  text default null,
  p_has_damage   boolean default false,
  p_is_set       boolean default false,
  p_sub_category text default null
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
  if not exists (select 1 from public.product_categories where name = p_category) then
    raise exception 'geçersiz kategori: %', p_category;
  end if;
  if p_sub_category is not null
     and not exists (select 1 from public.product_sub_categories
                      where category = p_category and name = p_sub_category) then
    raise exception 'alt kategori "%" bu kategoriye ait değil: %', p_sub_category, p_category;
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
    title, points, ai_suggested_points, condition, category, sub_category, size_class,
    location, description, seller_id, seller_name, seller_initials,
    has_damage, is_set, status)
  values (
    btrim(p_title), p_points, p_points, p_condition, p_category, p_sub_category, p_size_class,
    coalesce(nullif(btrim(p_location), ''), 'Belirtilmedi'), p_description,
    satici, ad, bas, coalesce(p_has_damage, false), coalesce(p_is_set, false), 'DRAFT')
  returning * into p;

  return p;
end; $$;

-- Eski dokuz parametreli imza kalkıyor; kalsaydı konumsal çağrılar hangisine
-- gittiğini söylemeden ikisi arasında bölünürdü.
drop function if exists public.create_listing(text, text, text, text, integer, text, text, boolean, boolean);

revoke execute on function
  public.create_listing(text, text, text, text, integer, text, text, boolean, boolean, text)
  from public, anon;
grant execute on function
  public.create_listing(text, text, text, text, integer, text, text, boolean, boolean, text)
  to authenticated;

-- ============================ 6) set_listing_category ============================
--
-- Taslak ilanın kategorisi düzeltilebilmeli: kullanıcı formda seçtikten sonra
-- fotoğraf adımında fikrini değiştirebiliyor. Doğrudan UPDATE istemciye kapalı
-- (products RLS + guard), o yüzden ince bir RPC.

create or replace function public.set_listing_category(
  p_product_id   text,
  p_category     text,
  p_sub_category text
)
returns public.products
language plpgsql security definer set search_path = public as $$
declare p public.products;
begin
  select * into p from public.products where id = p_product_id for update;
  if not found then raise exception 'ilan % bulunamadı', p_product_id; end if;
  if p.seller_id is distinct from auth.uid() then
    raise exception 'yalnızca ilan sahibi kategoriyi değiştirebilir';
  end if;
  if p.status <> 'DRAFT' then
    raise exception 'yayındaki ilanın kategorisi değiştirilemez (mevcut: %)', p.status;
  end if;
  if not exists (select 1 from public.product_sub_categories
                  where category = p_category and name = p_sub_category) then
    raise exception 'alt kategori "%" bu kategoriye ait değil: %', p_sub_category, p_category;
  end if;

  perform set_config('kt.bypass_product_guard', 'on', true);
  update public.products
     set category = p_category, sub_category = p_sub_category
   where id = p_product_id
  returning * into p;
  perform set_config('kt.bypass_product_guard', 'off', true);

  return p;
end; $$;

revoke execute on function public.set_listing_category(text, text, text) from public, anon;
grant execute on function public.set_listing_category(text, text, text) to authenticated;

-- ============================ 7) Yayın kapısı alt kategori ister ============================
--
-- Alt kategorisi olmayan bir ilan vitrine çıksaydı ana kategori süzgecinde
-- görünür, her alt kategori süzgecinde kaybolurdu. Kullanıcı ilanını
-- yayında sanar, alıcı hiçbir zaman bulamazdı. Kapı zaten eksik kareyi
-- reddediyor; eksik alt kategori de aynı sınıftan bir eksiktir.
--
-- Gövdenin geri kalanı 20260809110000'deki hâliyle aynıdır.

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
  kapak    text;
begin
  select * into p from public.products where id = p_product_id for update;
  if not found then raise exception 'ilan % bulunamadı', p_product_id; end if;
  if p.seller_id is distinct from auth.uid() then
    raise exception 'yalnızca ilan sahibi yayına alabilir';
  end if;
  if p.status <> 'DRAFT' then
    raise exception 'yalnızca taslak ilan yayına alınır (mevcut: %)', p.status;
  end if;
  if p.sub_category is null then
    raise exception 'alt kategori seçilmeden ilan yayına alınamaz';
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

  select ph.storage_path into kapak
    from public.product_photos ph
   where ph.product_id = p_product_id and ph.slot = p_cover_slot;

  if kapak is null then
    raise exception 'kapak olarak seçilen kare yok: %', p_cover_slot;
  end if;

  update public.product_photos set is_cover = false where product_id = p_product_id;
  update public.product_photos set is_cover = true
   where product_id = p_product_id and slot = p_cover_slot;

  perform set_config('kt.bypass_product_guard', 'on', true);
  update public.products
     set status = 'ACTIVE',
         image_key = kapak
   where id = p_product_id
  returning * into p;
  perform set_config('kt.bypass_product_guard', 'off', true);

  return p;
end; $$;

revoke execute on function public.publish_listing(text, public.photo_slot) from public, anon;
grant execute on function public.publish_listing(text, public.photo_slot) to authenticated;
grant execute on function public.publish_listing(text, public.photo_slot) to service_role;

-- ============================ 8) Kategori değişimi de korunur ============================
--
-- Guard puanı, durumu ve sahibi kilitliyordu; kategori serbestti. Yayındaki
-- bir ilanın kategorisi istemciden değiştirilebilseydi, alıcının gördüğü
-- süzgeç ile ürünün yeri ayrışırdı. Taslakta değişim `set_listing_category`
-- üzerinden yapılır, o da muafiyeti kendisi açar.

create or replace function public.products_guard_client_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null
     or coalesce(current_setting('kt.bypass_product_guard', true), 'off') = 'on' then
    return new;
  end if;

  if new.points is distinct from old.points then
    raise exception
      'İlan puanı doğrudan değiştirilemez; set_product_points() kullanın';
  end if;
  if new.status is distinct from old.status then
    raise exception
      'İlan durumu doğrudan değiştirilemez; durum takas akışıyla değişir';
  end if;
  if new.ai_suggested_points is distinct from old.ai_suggested_points then
    raise exception 'Değerleme sonucu değiştirilemez';
  end if;
  if new.seller_id is distinct from old.seller_id then
    raise exception 'İlan sahibi değiştirilemez';
  end if;
  if new.category is distinct from old.category
     or new.sub_category is distinct from old.sub_category then
    raise exception
      'Kategori doğrudan değiştirilemez; set_listing_category() kullanın';
  end if;

  return new;
end; $$;

-- Trigger fonksiyonu istemciden çağrılmaz. `create or replace` mevcut
-- yetkileri koruduğu için bu satır bugün bir şeyi değiştirmiyor; kural
-- "fonksiyona dokunan göç yetkisini de yazar" olduğu için duruyor — fonksiyon
-- bir gün sıfırdan oluşursa PostgreSQL onu PUBLIC'e açar.
revoke execute on function public.products_guard_client_update() from public, anon, authenticated;
