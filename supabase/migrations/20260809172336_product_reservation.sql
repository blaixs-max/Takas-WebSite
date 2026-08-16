-- KIDS TRADE — Ürün rezervasyonu
--
-- trades.product_id serbest bir text kolonuydu: products'a yabancı anahtar
-- değildi ve takas açılınca ilanın durumu değişmiyordu. İki sonucu vardı:
--
--   1. Var olmayan bir ürün için takas açılabiliyordu.
--   2. Aynı ürüne aynı anda iki takas açılabiliyordu. İki alıcının da puanı
--      havuza alınıyor, ürün bir tanesine gidiyordu.
--
-- Çözüm, takas oluşturmayı tek bir atomik fonksiyona taşımak: ürün satırı
-- kilitlenir, hâlâ satılabilir mi diye bakılır, takas açılır, ilan rezerve
-- edilir ve puan havuza alınır. Hepsi ya olur ya hiçbiri.

-- ============================ 1) SATILDI DURUMU ============================
-- Tamamlanan takasın ürünü ACTIVE'e dönmemeli, REMOVED de olmamalı.

alter table public.products drop constraint if exists products_status_check;
alter table public.products
  add constraint products_status_check
  check (status in ('ACTIVE','RESERVED','SOLD','REMOVED'));

-- ============================ 2) YABANCI ANAHTAR ============================
-- Önce sahipsiz product_id taşıyan takasları temizle, sonra kısıtı koy.

update public.trades t
   set product_id = null
 where t.product_id is not null
   and not exists (select 1 from public.products p where p.id = t.product_id);

alter table public.trades drop constraint if exists trades_product_id_fkey;
alter table public.trades
  add constraint trades_product_id_fkey
  foreign key (product_id) references public.products(id)
  on update cascade on delete restrict;

-- Bir ürün için aynı anda yalnızca bir canlı takas olabilir. Kapanmış
-- takaslar (COMPLETED, REFUNDED) sayılmaz, o yüzden kısmi indeks.
create unique index if not exists trades_tek_canli_takas_uidx
  on public.trades(product_id)
  where product_id is not null
    and status in ('CREATED','POINTS_HELD','SHIPPED','DELIVERED','DISPUTED');

-- ============================ 3) TAKAS OLUŞTURMA ============================

create or replace function public.create_trade(
  p_product_id text,
  p_buyer_id   uuid default null
)
returns public.trades
language plpgsql security definer set search_path = public as $$
declare p public.products; t public.trades; alici uuid;
begin
  alici := coalesce(p_buyer_id, auth.uid());
  if alici is null then
    raise exception 'alıcı belirlenemedi';
  end if;

  -- Ürünü kilitle: eşzamanlı ikinci çağrı burada sıraya girer ve aşağıdaki
  -- durum kontrolüne takılır.
  select * into p from public.products where id = p_product_id for update;
  if not found then
    raise exception 'ilan % bulunamadı', p_product_id;
  end if;
  if p.status <> 'ACTIVE' then
    raise exception 'ilan satın alınabilir durumda değil (mevcut: %)', p.status;
  end if;
  if p.seller_id is null then
    raise exception 'ilanın satıcısı yok';
  end if;
  if p.seller_id = alici then
    raise exception 'kendi ilanınızı satın alamazsınız';
  end if;

  insert into public.trades (buyer_id, seller_id, product_id, points)
  values (alici, p.seller_id, p.id, p.points)
  returning * into t;

  -- İlan rezerve edilir. Kolon kilidi trigger'ı istemci oturumunda status
  -- değişimini reddediyor; bu fonksiyon meşru yol olduğu için muafiyeti açar.
  perform set_config('kt.bypass_product_guard', 'on', true);
  update public.products set status = 'RESERVED' where id = p.id;
  perform set_config('kt.bypass_product_guard', 'off', true);

  -- Puanı havuza al. Bakiye yetmezse burada patlar ve tüm işlem geri sarılır:
  -- takas da açılmamış, ilan da rezerve edilmemiş olur.
  t := public.hold_points(t.id);

  return t;
end; $$;

revoke all on function public.create_trade(text, uuid) from public;
grant execute on function public.create_trade(text, uuid) to authenticated;
grant execute on function public.create_trade(text, uuid) to service_role;

-- ============================ 4) İLAN DURUMUNU TAKASA BAĞLA ============================
-- release → SOLD, refund → tekrar ACTIVE. Puan fonksiyonlarının içine
-- gömmek yerine trigger'a alınır: takas durumu nereden değişirse değişsin
-- ilan onu izler.

create or replace function public.trades_sync_product_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.product_id is null or new.status is not distinct from old.status then
    return new;
  end if;

  perform set_config('kt.bypass_product_guard', 'on', true);

  if new.status = 'COMPLETED' then
    update public.products set status = 'SOLD'
     where id = new.product_id and status <> 'SOLD';
  elsif new.status = 'REFUNDED' then
    -- İlan tekrar vitrine döner. Satıcı istemiyorsa kendisi kaldırır.
    update public.products set status = 'ACTIVE'
     where id = new.product_id and status = 'RESERVED';
  end if;

  perform set_config('kt.bypass_product_guard', 'off', true);
  return new;
end; $$;

drop trigger if exists trades_product_status_sync on public.trades;
create trigger trades_product_status_sync
  after update on public.trades
  for each row execute function public.trades_sync_product_status();
