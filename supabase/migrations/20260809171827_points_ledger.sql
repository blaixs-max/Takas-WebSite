-- KIDS TRADE — Puan defteri (güvenli havuz)
-- Çift girişli, değişmez kayıt + ATOMİK HOLD/RELEASE/REFUND.
-- Burada GERÇEK PARA YOKTUR; yalnızca Takas Puanı akar.
--
-- Eşzamanlılık güvenliği:
--  * wallets satırları SELECT ... FOR UPDATE ile kilitlenir (yarış koşulu yok)
--  * available_points >= 0 / held_points >= 0 CHECK kısıtları çift harcamayı engeller
--  * takas durum makinesi tekrar çalıştırmayı (idempotency) engeller
--  * iki cüzdan kilitlenirken user_id sırasıyla kilitlenip deadlock önlenir

-- ============================ TABLOLAR ============================

-- Kullanıcı cüzdanı: anlık durum + kilit hedefi
create table if not exists public.wallets (
  user_id          uuid primary key,
  available_points integer not null default 0 check (available_points >= 0),
  held_points      integer not null default 0 check (held_points >= 0),
  updated_at       timestamptz not null default now()
);

-- Değişmez hareket defteri (audit log) — asla UPDATE/DELETE edilmez
create table if not exists public.wallet_entries (
  id              bigint generated always as identity primary key,
  user_id         uuid not null,
  trade_id        uuid,
  type            text not null check (type in ('EARN','HOLD','RELEASE_IN','RELEASE_OUT','REFUND')),
  amount          integer not null check (amount > 0),
  available_after integer not null,
  held_after      integer not null,
  memo            text,
  created_at      timestamptz not null default now()
);
create index if not exists wallet_entries_user_idx  on public.wallet_entries(user_id);
create index if not exists wallet_entries_trade_idx on public.wallet_entries(trade_id);

-- Takaslar: durum makinesi
--  CREATED → POINTS_HELD → SHIPPED → DELIVERED → COMPLETED
--                       ↘ DISPUTED → REFUNDED
create table if not exists public.trades (
  id         uuid primary key default gen_random_uuid(),
  buyer_id   uuid not null,
  seller_id  uuid not null,
  product_id text,
  points     integer not null check (points > 0),
  status     text not null default 'CREATED'
               check (status in ('CREATED','POINTS_HELD','SHIPPED','DELIVERED','COMPLETED','DISPUTED','REFUNDED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint buyer_ne_seller check (buyer_id <> seller_id)
);
create index if not exists trades_buyer_idx  on public.trades(buyer_id);
create index if not exists trades_seller_idx on public.trades(seller_id);

-- ============================ YARDIMCI ============================

create or replace function public.ensure_wallet(p_user uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.wallets(user_id) values (p_user)
  on conflict (user_id) do nothing;
$$;

-- ============================ FONKSİYONLAR =========================

-- Puan kazan (ilan onayı, bonus vb.)
create or replace function public.earn_points(p_user uuid, p_amount integer, p_memo text default null)
returns public.wallets
language plpgsql security definer set search_path = public as $$
declare w public.wallets;
begin
  if p_amount <= 0 then raise exception 'amount must be > 0'; end if;
  perform public.ensure_wallet(p_user);
  update public.wallets
     set available_points = available_points + p_amount, updated_at = now()
   where user_id = p_user
   returning * into w;
  insert into public.wallet_entries(user_id, type, amount, available_after, held_after, memo)
       values (p_user, 'EARN', p_amount, w.available_points, w.held_points, coalesce(p_memo,'Puan kazanıldı'));
  return w;
end; $$;

-- Güvenli havuza al: alıcının puanı available → held
create or replace function public.hold_points(p_trade_id uuid)
returns public.trades
language plpgsql security definer set search_path = public as $$
declare t public.trades; w public.wallets;
begin
  select * into t from public.trades where id = p_trade_id for update;
  if not found then raise exception 'trade % bulunamadı', p_trade_id; end if;
  if t.status <> 'CREATED' then
    raise exception 'HOLD yalnızca CREATED durumundan yapılır (mevcut: %)', t.status;
  end if;

  perform public.ensure_wallet(t.buyer_id);
  select * into w from public.wallets where user_id = t.buyer_id for update;
  if w.available_points < t.points then
    raise exception 'yetersiz bakiye: % < %', w.available_points, t.points;
  end if;

  update public.wallets
     set available_points = available_points - t.points,
         held_points      = held_points + t.points,
         updated_at = now()
   where user_id = t.buyer_id
   returning * into w;
  insert into public.wallet_entries(user_id, trade_id, type, amount, available_after, held_after, memo)
       values (t.buyer_id, t.id, 'HOLD', t.points, w.available_points, w.held_points, 'Güvenli havuza alındı');

  update public.trades set status = 'POINTS_HELD', updated_at = now()
   where id = t.id returning * into t;
  return t;
end; $$;

-- Teslim onayı: alıcının held puanı satıcının available'ına geçer
create or replace function public.release_points(p_trade_id uuid)
returns public.trades
language plpgsql security definer set search_path = public as $$
declare t public.trades; wb public.wallets; ws public.wallets;
begin
  select * into t from public.trades where id = p_trade_id for update;
  if not found then raise exception 'trade % bulunamadı', p_trade_id; end if;
  if t.status not in ('SHIPPED','DELIVERED') then
    raise exception 'RELEASE yalnızca SHIPPED/DELIVERED durumundan yapılır (mevcut: %)', t.status;
  end if;

  perform public.ensure_wallet(t.buyer_id);
  perform public.ensure_wallet(t.seller_id);
  -- deadlock önleme: iki cüzdanı user_id sırasıyla kilitle
  perform 1 from public.wallets
   where user_id in (t.buyer_id, t.seller_id) order by user_id for update;

  update public.wallets set held_points = held_points - t.points, updated_at = now()
   where user_id = t.buyer_id returning * into wb;
  insert into public.wallet_entries(user_id, trade_id, type, amount, available_after, held_after, memo)
       values (t.buyer_id, t.id, 'RELEASE_OUT', t.points, wb.available_points, wb.held_points, 'Teslim onaylandı — havuzdan çıktı');

  update public.wallets set available_points = available_points + t.points, updated_at = now()
   where user_id = t.seller_id returning * into ws;
  insert into public.wallet_entries(user_id, trade_id, type, amount, available_after, held_after, memo)
       values (t.seller_id, t.id, 'RELEASE_IN', t.points, ws.available_points, ws.held_points, 'Takas tamamlandı — puan alındı');

  update public.trades set status = 'COMPLETED', updated_at = now()
   where id = t.id returning * into t;
  return t;
end; $$;

-- İade / itiraz: alıcının held puanı available'ına geri döner
create or replace function public.refund_points(p_trade_id uuid, p_reason text default null)
returns public.trades
language plpgsql security definer set search_path = public as $$
declare t public.trades; w public.wallets;
begin
  select * into t from public.trades where id = p_trade_id for update;
  if not found then raise exception 'trade % bulunamadı', p_trade_id; end if;
  if t.status not in ('POINTS_HELD','SHIPPED','DELIVERED','DISPUTED') then
    raise exception 'REFUND bu durumdan yapılamaz (mevcut: %)', t.status;
  end if;

  perform public.ensure_wallet(t.buyer_id);
  select * into w from public.wallets where user_id = t.buyer_id for update;

  update public.wallets
     set held_points      = held_points - t.points,
         available_points = available_points + t.points,
         updated_at = now()
   where user_id = t.buyer_id
   returning * into w;
  insert into public.wallet_entries(user_id, trade_id, type, amount, available_after, held_after, memo)
       values (t.buyer_id, t.id, 'REFUND', t.points, w.available_points, w.held_points, coalesce(p_reason,'İade edildi'));

  update public.trades set status = 'REFUNDED', updated_at = now()
   where id = t.id returning * into t;
  return t;
end; $$;

-- ============================ GÜVENLİK (RLS) ======================

alter table public.wallets        enable row level security;
alter table public.wallet_entries enable row level security;
alter table public.trades         enable row level security;

-- Okuma: kullanıcı yalnızca kendi verisini görür
create policy "kendi cüzdanını gör"     on public.wallets        for select to authenticated using (auth.uid() = user_id);
create policy "kendi hareketlerini gör" on public.wallet_entries for select to authenticated using (auth.uid() = user_id);
create policy "taraf olduğun takası gör" on public.trades        for select to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- Yazma: yalnızca SECURITY DEFINER fonksiyonlar (backend/service_role) yapar.
-- Fonksiyonları istemciye AÇMIYORUZ; release/refund gibi hassas işlemler
-- backend orkestrasyonuyla service_role üzerinden çağrılır.
revoke all on function public.earn_points(uuid, integer, text)  from public;
revoke all on function public.hold_points(uuid)                 from public;
revoke all on function public.release_points(uuid)              from public;
revoke all on function public.refund_points(uuid, text)         from public;
grant execute on function public.earn_points(uuid, integer, text)  to service_role;
grant execute on function public.hold_points(uuid)                 to service_role;
grant execute on function public.release_points(uuid)              to service_role;
grant execute on function public.refund_points(uuid, text)         to service_role;
