-- KIDS TRADE — Desi tarifesi ve sunucu tarafı fiyatlandırma
--
-- cargo-payment-init, alıcının ödeyeceği tutarı istek gövdesinden geliyordu:
--
--     const carrierCost = Number(b.carrierCost);
--     const commission  = Number(b.commission);
--
-- Yani fiyatı çağıran belirliyordu. {"carrierCost": 0.01, "commission": 0}
-- gönderen bir istemci kargoyu bir kuruşa ödeyebilirdi. Sunucuda ne tarife
-- tablosu vardı ne desi kavramı.
--
-- Bu migration fiyatın türetildiği yeri veri tabanına taşır. Rakamlar Ana
-- Doküman v1.1, Bölüm 3 (Seçenek B+) ile aynıdır:
--   alıcı öder = desi kademesinin kargo bedeli + hizmet bedeli + işlem payı
--   hizmet bedeli = ₺17,90 sabit
--   işlem payı    = ürün puanının %6'sı, asgari ₺6
--
-- Kargo maliyetleri hâlâ varsayımdır; sözleşme imzalandığında bu tablo
-- güncellenir, kod değişmez.

-- ============================ 1) TARİFE ============================

create table if not exists public.shipping_rates (
  size_class      text primary key check (size_class in ('XS','S','M','L','XL','XXL')),
  desi_min        integer not null,
  desi_max        integer,                          -- null = üst sınır yok
  carrier_cost_tl numeric(10,2) not null check (carrier_cost_tl > 0),
  buyer_price_tl  numeric(10,2) not null check (buyer_price_tl > 0),
  sort_order      integer not null,
  updated_at      timestamptz not null default now(),
  constraint marj_pozitif check (buyer_price_tl > carrier_cost_tl)
);

insert into public.shipping_rates
  (size_class, desi_min, desi_max, carrier_cost_tl, buyer_price_tl, sort_order) values
  ('XS',  0,  1,  28.00,  38.00, 1),
  ('S',   2,  3,  42.00,  52.00, 2),
  ('M',   4, 10,  68.00,  78.00, 3),
  ('L',  11, 20, 105.00, 115.00, 4),
  ('XL', 21, 30, 165.00, 175.00, 5),
  ('XXL',31, null, 240.00, 250.00, 6)
on conflict (size_class) do update set
  desi_min        = excluded.desi_min,
  desi_max        = excluded.desi_max,
  carrier_cost_tl = excluded.carrier_cost_tl,
  buyer_price_tl  = excluded.buyer_price_tl,
  sort_order      = excluded.sort_order,
  updated_at      = now();

-- Tarife herkese açık okunur: alıcı satın almadan önce kargo bedelini görür.
alter table public.shipping_rates enable row level security;
drop policy if exists "tarife herkese açık" on public.shipping_rates;
create policy "tarife herkese açık"
  on public.shipping_rates for select to anon, authenticated using (true);
-- Yazma politikası YOK → yalnızca service_role değiştirebilir.

-- ============================ 2) ÜCRET PARAMETRELERİ ============================
-- Tek satırlık yapılandırma. Ücret değişikliği kod dağıtımı gerektirmesin.

create table if not exists public.fee_settings (
  id                    boolean primary key default true check (id),
  service_fee_tl        numeric(10,2) not null,
  transaction_fee_rate  numeric(5,4)  not null,   -- 0.0600 = %6
  transaction_fee_min   numeric(10,2) not null,
  updated_at            timestamptz not null default now()
);

insert into public.fee_settings (id, service_fee_tl, transaction_fee_rate, transaction_fee_min)
values (true, 17.90, 0.0600, 6.00)
on conflict (id) do update set
  service_fee_tl       = excluded.service_fee_tl,
  transaction_fee_rate = excluded.transaction_fee_rate,
  transaction_fee_min  = excluded.transaction_fee_min,
  updated_at           = now();

alter table public.fee_settings enable row level security;
drop policy if exists "ücretler herkese açık" on public.fee_settings;
create policy "ücretler herkese açık"
  on public.fee_settings for select to anon, authenticated using (true);

-- ============================ 3) İLANDA DESİ ============================

alter table public.products
  add column if not exists size_class text
  references public.shipping_rates(size_class);

-- Mevcut örnek ilanlar için makul bir varsayılan; yeni ilanlarda zorunlu olacak.
update public.products set size_class = 'S' where size_class is null;

-- ============================ 4) FİYAT TÜRETME ============================
-- Alıcının ödeyeceği tutarın tek kaynağı. Edge Function bunu çağırır ve
-- sonucu olduğu gibi kullanır; istemciden gelen hiçbir tutara bakmaz.

create or replace function public.quote_trade_price(p_trade_id uuid)
returns table (
  size_class      text,
  carrier_cost_tl numeric,
  shipping_tl     numeric,
  service_fee_tl  numeric,
  transaction_fee_tl numeric,
  total_tl        numeric,
  commission_tl   numeric
)
language plpgsql security definer set search_path = public as $$
declare t public.trades; p public.products; r public.shipping_rates; f public.fee_settings;
begin
  select * into t from public.trades where id = p_trade_id;
  if not found then
    raise exception 'trade % bulunamadı', p_trade_id;
  end if;

  select * into p from public.products where id = t.product_id;
  if not found then
    raise exception 'takasın ürünü bulunamadı (product_id=%)', t.product_id;
  end if;
  if p.size_class is null then
    raise exception 'ilanın desi kademesi yok (product_id=%)', p.id;
  end if;

  select * into r from public.shipping_rates where shipping_rates.size_class = p.size_class;
  if not found then
    raise exception 'desi kademesi tarifede yok: %', p.size_class;
  end if;

  select * into f from public.fee_settings where id;

  size_class      := r.size_class;
  carrier_cost_tl := r.carrier_cost_tl;
  shipping_tl     := r.buyer_price_tl;
  service_fee_tl  := f.service_fee_tl;
  -- İşlem payı ürün puanı üzerinden; kargonun değil, ürünün riskini karşılar.
  transaction_fee_tl := round(
    greatest(f.transaction_fee_min, t.points * f.transaction_fee_rate), 2);
  total_tl      := round(shipping_tl + service_fee_tl + transaction_fee_tl, 2);
  commission_tl := round(total_tl - carrier_cost_tl, 2);
  return next;
end; $$;

revoke all on function public.quote_trade_price(uuid) from public;
grant execute on function public.quote_trade_price(uuid) to service_role;
-- Alıcı satın almadan önce tutarı görebilsin diye istemciye de açılır;
-- fonksiyon yalnızca okur, hiçbir şey yazmaz.
grant execute on function public.quote_trade_price(uuid) to authenticated;
