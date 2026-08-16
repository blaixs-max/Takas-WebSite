-- KIDS TRADE — Puan defteri sağlamlaştırma
--
-- İki açık kapatılır:
--
--  1. wallet_entries "asla UPDATE/DELETE edilmez" diye yazılıydı ama bunu
--     zorlayan hiçbir şey yoktu. RLS yalnızca istemciyi durdurur; service_role
--     RLS'i baypas eder, dolayısıyla bir Edge Function hatası defter satırını
--     değiştirebilir veya silebilirdi. Artık trigger engelliyor — hiçbir rol
--     geçemez.
--
--  2. earn_points idempotent değildi. Puan basan tek fonksiyon bu; bir yeniden
--     deneme (ağ zaman aşımı, Edge Function retry, webhook yeniden teslimi)
--     bonusu ikinci kez yazardı. Artık her çağrı bir idempotency anahtarı
--     taşımak zorunda ve aynı anahtarla ikinci çağrı yeni hareket yaratmaz.
--
-- hold/release/refund zaten takas durum makinesiyle korunuyordu; onlara da
-- anahtar eklendi ki koruma tek bir mekanizmaya bağlı kalmasın.

-- ============================ 1) İDEMPOTENCY ANAHTARI ============================

alter table public.wallet_entries
  add column if not exists idempotency_key text;

-- Kısmi indeks: geçmiş satırlarda anahtar null olabilir, yeni satırlarda benzersiz.
create unique index if not exists wallet_entries_idempotency_key_uidx
  on public.wallet_entries(idempotency_key)
  where idempotency_key is not null;

-- ============================ 2) DEĞİŞMEZLİK ============================

create or replace function public.wallet_entries_immutable()
returns trigger language plpgsql as $$
begin
  raise exception
    'wallet_entries değişmezdir; % işlemi engellendi (satır id=%)',
    tg_op, coalesce(old.id, new.id);
end; $$;

drop trigger if exists wallet_entries_no_update on public.wallet_entries;
create trigger wallet_entries_no_update
  before update on public.wallet_entries
  for each row execute function public.wallet_entries_immutable();

drop trigger if exists wallet_entries_no_delete on public.wallet_entries;
create trigger wallet_entries_no_delete
  before delete on public.wallet_entries
  for each row execute function public.wallet_entries_immutable();

-- ============================ 3) earn_points ============================

-- Eski iki/üç argümanlı imza kaldırılır: anahtarsız çağrı mümkün kalmamalı.
drop function if exists public.earn_points(uuid, integer, text);

create or replace function public.earn_points(
  p_user            uuid,
  p_amount          integer,
  p_idempotency_key text,
  p_memo            text default null
)
returns public.wallets
language plpgsql security definer set search_path = public as $$
declare w public.wallets;
begin
  if p_amount <= 0 then
    raise exception 'amount must be > 0';
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency_key zorunludur';
  end if;

  perform public.ensure_wallet(p_user);

  -- Cüzdan satırını kilitle: aynı kullanıcı için eşzamanlı iki çağrı sıraya
  -- girer, dolayısıyla aşağıdaki "daha önce yazıldı mı" kontrolü yarışmaz.
  select * into w from public.wallets where user_id = p_user for update;

  if exists (select 1 from public.wallet_entries
              where idempotency_key = p_idempotency_key) then
    return w;                      -- bu hareket zaten işlenmiş
  end if;

  update public.wallets
     set available_points = available_points + p_amount, updated_at = now()
   where user_id = p_user
   returning * into w;

  insert into public.wallet_entries(
    user_id, type, amount, available_after, held_after, memo, idempotency_key)
  values (
    p_user, 'EARN', p_amount, w.available_points, w.held_points,
    coalesce(p_memo, 'Puan kazanıldı'), p_idempotency_key);

  return w;
end; $$;

-- ============================ 4) hold / release / refund ============================
-- Durum makinesi zaten tekrar çalıştırmayı engelliyor. Anahtarlar takas
-- kimliğinden türetilir, böylece koruma tek mekanizmaya bağlı kalmaz ve defter
-- satırının hangi olaya ait olduğu satırın kendisinden okunur.

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
  insert into public.wallet_entries(
    user_id, trade_id, type, amount, available_after, held_after, memo, idempotency_key)
  values (t.buyer_id, t.id, 'HOLD', t.points, w.available_points, w.held_points,
          'Güvenli havuza alındı', 'hold:' || t.id);

  update public.trades set status = 'POINTS_HELD', updated_at = now()
   where id = t.id returning * into t;
  return t;
end; $$;

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
  insert into public.wallet_entries(
    user_id, trade_id, type, amount, available_after, held_after, memo, idempotency_key)
  values (t.buyer_id, t.id, 'RELEASE_OUT', t.points, wb.available_points, wb.held_points,
          'Teslim onaylandı — havuzdan çıktı', 'release_out:' || t.id);

  update public.wallets set available_points = available_points + t.points, updated_at = now()
   where user_id = t.seller_id returning * into ws;
  insert into public.wallet_entries(
    user_id, trade_id, type, amount, available_after, held_after, memo, idempotency_key)
  values (t.seller_id, t.id, 'RELEASE_IN', t.points, ws.available_points, ws.held_points,
          'Takas tamamlandı — puan alındı', 'release_in:' || t.id);

  update public.trades set status = 'COMPLETED', updated_at = now()
   where id = t.id returning * into t;
  return t;
end; $$;

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
  insert into public.wallet_entries(
    user_id, trade_id, type, amount, available_after, held_after, memo, idempotency_key)
  values (t.buyer_id, t.id, 'REFUND', t.points, w.available_points, w.held_points,
          coalesce(p_reason, 'İade edildi'), 'refund:' || t.id);

  update public.trades set status = 'REFUNDED', updated_at = now()
   where id = t.id returning * into t;
  return t;
end; $$;

-- ============================ 5) YETKİLER ============================
-- İmza değiştiği için yeniden verilir. İstemciye hiçbiri açılmaz.

revoke all on function public.earn_points(uuid, integer, text, text) from public;
revoke all on function public.hold_points(uuid)                      from public;
revoke all on function public.release_points(uuid)                   from public;
revoke all on function public.refund_points(uuid, text)              from public;

grant execute on function public.earn_points(uuid, integer, text, text) to service_role;
grant execute on function public.hold_points(uuid)                      to service_role;
grant execute on function public.release_points(uuid)                   to service_role;
grant execute on function public.refund_points(uuid, text)              to service_role;
