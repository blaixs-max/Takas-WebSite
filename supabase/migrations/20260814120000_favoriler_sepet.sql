-- Favori ve sepet — cihazdan buluta
--
-- İkisi de bugüne kadar yalnızca `AsyncStorage`daydı. Bu, tek cihazlı bir
-- kullanıcı için çalışıyordu ama iki gerçek sonucu vardı: telefon değişince
-- ya da uygulama silinince liste kayboluyordu, ve aynı hesaba başka bir
-- cihazdan girildiğinde favoriler boş görünüyordu.
--
-- ## Neden miktar sütunu yok
--
-- Sepet bir küme, çokluk değil. Her ilan tek ve benzersiz bir ikinci el ürün;
-- aynı üründen iki tane alınamaz. Birincil anahtar bu yüzden
-- (user_id, product_id) — çokluk sütunu koymak, olmayan bir yeteneği şema
-- düzeyinde vaat ederdi.
--
-- ## Neden `on delete cascade`
--
-- İlan silinirse satır da gider. Alternatifi, kullanıcının sepetinde artık
-- var olmayan bir ürüne işaret eden ölü bir satır tutmaktı; arayüzün onu her
-- açılışta ayıklaması gerekirdi.
--
-- Satılan ya da rezerve edilen ilan **silinmez**, durumu değişir; o yüzden
-- sepette kalır ve arayüz durumunu gösterir. Kullanıcının sepetine attığı bir
-- ürünün kapılmış olduğunu görmesi, ürünün sessizce yok olmasından iyidir.

-- ============================== Favoriler ==============================

create table if not exists public.favorites (
  user_id    uuid not null references auth.users (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

alter table public.favorites enable row level security;

-- Politikaların `using` ve `with check` yanları ayrı ayrı yazılıyor: yalnızca
-- `using` yazmak, kullanıcının BAŞKASININ adına satır eklemesine izin verir.
create policy "favori: kendi satırlarını görür"
  on public.favorites for select
  using (user_id = auth.uid());

create policy "favori: kendi adına ekler"
  on public.favorites for insert
  with check (user_id = auth.uid());

create policy "favori: kendi satırını siler"
  on public.favorites for delete
  using (user_id = auth.uid());

create index if not exists favorites_user_idx on public.favorites (user_id, created_at desc);

comment on table public.favorites is
  'Kullanıcının favori ilanları. Cihazdaki liste ile birleşerek senkron olur.';

-- =============================== Sepet ===============================

create table if not exists public.cart_items (
  user_id    uuid not null references auth.users (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

alter table public.cart_items enable row level security;

create policy "sepet: kendi satırlarını görür"
  on public.cart_items for select
  using (user_id = auth.uid());

create policy "sepet: kendi adına ekler"
  on public.cart_items for insert
  with check (user_id = auth.uid());

create policy "sepet: kendi satırını siler"
  on public.cart_items for delete
  using (user_id = auth.uid());

create index if not exists cart_items_user_idx on public.cart_items (user_id, created_at desc);

comment on table public.cart_items is
  'Kullanıcının sepeti. Küme; her ilan en fazla bir kez bulunur.';

-- Tablolara doğrudan erişim RLS ile korunuyor; istemci PostgREST üzerinden
-- okuyup yazıyor, ayrı bir RPC gerekmiyor.
grant select, insert, delete on public.favorites  to authenticated;
grant select, insert, delete on public.cart_items to authenticated;

-- `anon` hiçbirini göremez: oturumsuz favori diye bir şey yok.
revoke all on public.favorites  from anon;
revoke all on public.cart_items from anon;
