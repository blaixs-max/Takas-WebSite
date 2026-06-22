-- KIDS TRADE — Ürünler (takas rafı ilanları)
-- Görseller uygulamada paketli (bundled) olduğundan, tabloda yalnızca image_key
-- tutulur; mobil tarafta data/productImages.ts ile require()'a eşlenir.

create table if not exists public.products (
  id               text primary key,
  title            text not null,
  points           integer not null check (points > 0),
  condition        text not null check (condition in ('İyi durumda','Az kullanılmış','Yeni gibi')),
  category         text not null check (category in ('Oyuncak','Kitap','Montessori','Kutu oyunu')),
  location         text not null,
  distance_km      numeric(5,1) not null default 0,
  rating           numeric(2,1) not null default 5.0,
  market_value     text,
  badge            text,                         -- 'Popüler' | 'Editör seçimi' | null
  description      text,
  image_key        text not null,               -- yerel görsel anahtarı
  gallery_keys     text[] not null default '{}',
  seller_id        uuid,                         -- ilan sahibi (auth.users)
  seller_name      text not null,
  seller_initials  text not null,
  seller_trust     integer not null default 90,
  seller_trades    integer not null default 0,
  status           text not null default 'ACTIVE' check (status in ('ACTIVE','RESERVED','REMOVED')),
  created_at       timestamptz not null default now()
);

create index if not exists products_status_idx   on public.products(status);
create index if not exists products_category_idx on public.products(category);
create index if not exists products_seller_idx   on public.products(seller_id);

-- RLS
alter table public.products enable row level security;

-- Aktif ilanlar herkese açık (rafı gezmek için)
create policy "aktif ilanlar herkese açık"
  on public.products for select
  to anon, authenticated
  using (status = 'ACTIVE');

-- Kullanıcı kendi ilanını ekleyebilir/günceller/siler
create policy "kendi ilanını ekle"
  on public.products for insert
  to authenticated
  with check (seller_id = auth.uid());

create policy "kendi ilanını güncelle"
  on public.products for update
  to authenticated
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

create policy "kendi ilanını sil"
  on public.products for delete
  to authenticated
  using (seller_id = auth.uid());

-- ============================ SEED (demo ilanlar) ============================
insert into public.products
  (id, title, points, condition, category, location, distance_km, rating, market_value, badge,
   description, image_key, gallery_keys, seller_name, seller_initials, seller_trust, seller_trades)
values
  ('blocks', 'Montessori ahşap blok seti', 420, 'Az kullanılmış', 'Montessori', 'Kadıköy', 2.4, 4.9, '~520–610 ₺', 'Popüler',
   'Doğal kayın ağacından, 48 parçalık geometrik blok seti. 2 yıl kullanıldı, boyası dökülmemiş. Orijinal ahşap kutusuyla birlikte gönderilir.',
   'wooden-blocks', '{wooden-blocks,wooden-close,rings-close,color-sorter}', 'Zeynep D.', 'ZD', 96, 38),

  ('sorter', 'Ahşap renk ayırma oyunu', 260, 'İyi durumda', 'Oyuncak', 'Beşiktaş', 5.1, 4.7, '~300–360 ₺', null,
   'El becerisi ve renk eşleştirme için ahşap sıralama oyunu. Tüm parçalar tam, küçük kullanım izleri mevcut.',
   'color-sorter', '{color-sorter,wooden-close,wooden-blocks}', 'Murat K.', 'MK', 91, 22),

  ('rings', 'Montessori halka kulesi', 340, 'Yeni gibi', 'Montessori', 'Üsküdar', 3.8, 5.0, '~400–470 ₺', 'Editör seçimi',
   'Doğal boyalı ahşap halka kulesi. Neredeyse hiç kullanılmadı, kutusunda. Bebek ve yürüme dönemi için ideal.',
   'montessori-rings', '{montessori-rings,rings-close,wooden-blocks}', 'Elif T.', 'ET', 98, 51),

  ('rings-natural', 'Doğal ahşap denge halkaları', 300, 'Az kullanılmış', 'Montessori', 'Şişli', 6.7, 4.8, '~350–410 ₺', null,
   'Doğal yağ ile cilalanmış denge ve istifleme halkaları. Hafif kullanım izi var, tüm parçalar mevcut.',
   'rings-close', '{rings-close,montessori-rings,wooden-close}', 'Can A.', 'CA', 89, 17)
on conflict (id) do nothing;
