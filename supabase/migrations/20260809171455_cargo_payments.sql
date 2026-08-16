-- KIDS TRADE — kargo ödemeleri + komisyon
-- Güvenli havuz PUAN tutar (bu tabloda değil); burada YALNIZCA kargo parası akar.

create table if not exists public.cargo_payments (
  id                uuid primary key default gen_random_uuid(),
  trade_id          text not null,
  buyer_id          uuid,
  seller_id         uuid,
  conversation_id   text not null,                 -- iyzico conversationId (= trade_id)
  token             text,                          -- iyzico checkout form token
  amount            numeric(10,2) not null,        -- alıcının ödediği toplam (komisyon dahil)
  carrier_cost      numeric(10,2) not null,        -- anlaşmalı kargo maliyeti
  commission        numeric(10,2) not null default 0, -- platform komisyonu = amount - carrier_cost
  currency          text not null default 'TRY',
  status            text not null default 'PENDING'   -- PENDING | PAID | FAILED
                      check (status in ('PENDING','PAID','FAILED')),
  iyzico_payment_id text,
  created_at        timestamptz not null default now(),
  paid_at           timestamptz,
  -- tutarlılık: toplam = kargo + komisyon
  constraint amount_breakdown check (amount = carrier_cost + commission)
);

create index if not exists cargo_payments_trade_idx on public.cargo_payments(trade_id);
create index if not exists cargo_payments_token_idx on public.cargo_payments(token);
create index if not exists cargo_payments_status_idx on public.cargo_payments(status);

-- RLS: bu tabloya yalnızca backend (service_role) yazar; istemci doğrudan erişemez.
alter table public.cargo_payments enable row level security;

-- Alıcı/satıcı kendi ödeme kaydını görebilir (opsiyonel okuma politikası)
create policy "kendi kargo ödemesini gör"
  on public.cargo_payments for select
  to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- Platformun günlük komisyon geliri için pratik bir görünüm
create or replace view public.daily_commission as
  select
    date_trunc('day', paid_at) as gun,
    count(*)                   as tahsilat_adedi,
    sum(amount)                as toplam_tahsilat,
    sum(carrier_cost)          as toplam_kargo_maliyeti,
    sum(commission)            as toplam_komisyon
  from public.cargo_payments
  where status = 'PAID'
  group by 1
  order by 1 desc;
