-- KIDS TRADE — Teslimat onayı, otomatik tamamlanma ve zaman aşımı
--
-- Puan katmanının bir ucu bağlıydı, diğeri açıktı: create_trade() puanı
-- havuza alıyordu ama havuzdan çıkaran hiçbir çağrı yoktu. Sonuç:
--
--   1. Satıcı ürünü teslim etse bile puanını hiç alamıyordu. release_points()
--      yazılmıştı, kimse çağırmıyordu.
--   2. Alıcı takas açıp kargo bedelini ödemezse puanı sonsuza kadar havuzda
--      kalıyor, ilan da RESERVED'de takılıp vitrine dönmüyordu. Sessiz sızıntı.
--   3. Ana Doküman 4.5'teki "teslimat onayı 48 saat" taahhüdünün karşılığı
--      kodda yoktu; sayaç diye bir şey yoktu.
--
-- Bu göç üç şeyi getirir: zaman damgaları (kim ne zaman hangi duruma geçti),
-- tarafların çağırabileceği aksiyonlar (teslim aldım / itiraz ediyorum) ve
-- süresi dolanları toplayan tek bir bakım fonksiyonu.
--
-- Tasarım kararı: durum değişimini kim yaparsa yapsın zaman damgaları
-- trigger'da basılır. Böylece iyzico callback'i, cron ve elle müdahale aynı
-- takvimi üretir; her çağıran yerinin damgayı hatırlamasına gerek kalmaz.

-- ============================ 1) SÜRELER ============================
-- Ana Doküman 4.5 ile aynı sayılar. Tek satırlık ayar tablosu: süre değişikliği
-- kod dağıtımı gerektirmez, fee_settings ile aynı desen.

create table if not exists public.trade_timings (
  id              boolean primary key default true check (id),
  -- Takas açıldıktan sonra alıcının kargo bedelini ödemesi için verilen süre.
  -- Dolarsa puan iade edilir ve ilan vitrine döner.
  payment_window  interval not null,
  -- Kargo etiketi üretildikten sonra satıcının şubeye bırakması için süre.
  dropoff_window  interval not null,
  -- Teslimattan sonra alıcının onaylaması için süre. Dolarsa puan satıcıya
  -- otomatik geçer (Ana Doküman 4.5).
  confirm_window  interval not null,
  updated_at      timestamptz not null default now()
);

insert into public.trade_timings (id, payment_window, dropoff_window, confirm_window)
values (true, interval '1 hour', interval '3 days', interval '48 hours')
on conflict (id) do update set
  payment_window = excluded.payment_window,
  dropoff_window = excluded.dropoff_window,
  confirm_window = excluded.confirm_window,
  updated_at     = now();

alter table public.trade_timings enable row level security;
drop policy if exists "süreler herkese açık" on public.trade_timings;
create policy "süreler herkese açık"
  on public.trade_timings for select to anon, authenticated using (true);

-- ============================ 2) TAKVİM KOLONLARI ============================

alter table public.trades
  add column if not exists shipped_at   timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists completed_at timestamptz,
  -- Süresi dolduğunda bakım fonksiyonunun işleyeceği an. Takas beklemede
  -- değilse null olur — cron yalnızca dolu satırlara bakar.
  add column if not exists deadline_at  timestamptz,
  add column if not exists dispute_reason text;

-- Bakım taraması yalnızca süresi dolmuşlara baksın.
create index if not exists trades_deadline_idx
  on public.trades(deadline_at)
  where deadline_at is not null;

-- ============================ 3) TAKVİMİ TRIGGER BASAR ============================

create or replace function public.trades_stamp_timeline()
returns trigger language plpgsql set search_path = public as $$
declare s public.trade_timings;
begin
  select * into s from public.trade_timings where id;

  -- Yeni takas: ödeme sayacı hemen başlar.
  if tg_op = 'INSERT' then
    if new.status in ('CREATED','POINTS_HELD') then
      new.deadline_at := now() + s.payment_window;
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  case new.status
    when 'POINTS_HELD' then
      -- Puan havuza alındı, sıra kargo bedelinde.
      new.deadline_at := now() + s.payment_window;

    when 'SHIPPED' then
      -- Ödeme alındı, etiket üretildi. Sayaç artık şubeye bırakmayı bekliyor.
      new.shipped_at  := coalesce(new.shipped_at, now());
      new.deadline_at := now() + s.dropoff_window;

    when 'DELIVERED' then
      -- 48 saatlik onay sayacı burada başlar.
      new.delivered_at := coalesce(new.delivered_at, now());
      new.deadline_at  := now() + s.confirm_window;

    when 'DISPUTED' then
      -- İtiraz sayacı durdurur. Otomatik tamamlama itirazlı takası ödemez;
      -- karar insana kalır.
      new.deadline_at := null;

    when 'COMPLETED' then
      new.completed_at := coalesce(new.completed_at, now());
      new.deadline_at  := null;

    when 'REFUNDED' then
      new.deadline_at := null;

    else
      null;
  end case;

  return new;
end; $$;

drop trigger if exists trades_timeline_stamp on public.trades;
create trigger trades_timeline_stamp
  before insert or update on public.trades
  for each row execute function public.trades_stamp_timeline();

-- Zaten açık olan takasların sayacı yoksa başlat; göç öncesi satırlar
-- deadline'sız kalmasın diye.
update public.trades t
   set deadline_at = now() + (select payment_window from public.trade_timings where id)
 where t.deadline_at is null
   and t.status in ('CREATED','POINTS_HELD');

-- ============================ 4) TARAFLARIN AKSİYONLARI ============================

-- Alıcı "teslim aldım" der: puan satıcıya geçer, takas kapanır.
-- 48 saat dolmadan onaylamak satıcının parasını erken almasını sağlar; bu
-- teşvik bilinçlidir.
create or replace function public.confirm_delivery(p_trade_id uuid)
returns public.trades
language plpgsql security definer set search_path = public as $$
declare t public.trades;
begin
  if auth.uid() is null then
    raise exception 'oturum bulunamadı';
  end if;

  select * into t from public.trades where id = p_trade_id for update;
  if not found then
    raise exception 'takas bulunamadı';
  end if;
  if t.buyer_id <> auth.uid() then
    -- Satıcı kendi takasını onaylayamaz; onaylayabilseydi ürünü hiç
    -- göndermeden puanı alırdı.
    raise exception 'bu takası yalnızca alıcı onaylayabilir';
  end if;
  if t.status not in ('SHIPPED','DELIVERED') then
    raise exception 'takas onaylanabilir durumda değil (mevcut: %)', t.status;
  end if;

  return public.release_points(p_trade_id);
end; $$;

revoke all on function public.confirm_delivery(uuid) from public;
grant execute on function public.confirm_delivery(uuid) to authenticated;
grant execute on function public.confirm_delivery(uuid) to service_role;

-- Alıcı itiraz eder: sayaç durur, otomatik tamamlama devre dışı kalır.
-- İadeye karar vermek bu fonksiyonun işi DEĞİL; o insan kararıdır ve
-- refund_points yalnızca service_role'da kalır.
create or replace function public.open_dispute(p_trade_id uuid, p_reason text)
returns public.trades
language plpgsql security definer set search_path = public as $$
declare t public.trades;
begin
  if auth.uid() is null then
    raise exception 'oturum bulunamadı';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'itiraz gerekçesi zorunludur';
  end if;

  select * into t from public.trades where id = p_trade_id for update;
  if not found then
    raise exception 'takas bulunamadı';
  end if;
  if t.buyer_id <> auth.uid() then
    raise exception 'bu takasa yalnızca alıcı itiraz edebilir';
  end if;
  if t.status not in ('SHIPPED','DELIVERED') then
    raise exception 'bu durumda itiraz açılamaz (mevcut: %)', t.status;
  end if;

  update public.trades
     set status = 'DISPUTED', dispute_reason = btrim(p_reason), updated_at = now()
   where id = t.id
  returning * into t;
  return t;
end; $$;

revoke all on function public.open_dispute(uuid, text) from public;
grant execute on function public.open_dispute(uuid, text) to authenticated;
grant execute on function public.open_dispute(uuid, text) to service_role;

-- Kargo tarafı teslimatı bildirir. Şimdilik yalnızca arka uç çağırır;
-- aggregator entegrasyonu gelince webhook buraya bağlanır.
create or replace function public.mark_delivered(p_trade_id uuid)
returns public.trades
language plpgsql security definer set search_path = public as $$
declare t public.trades;
begin
  select * into t from public.trades where id = p_trade_id for update;
  if not found then
    raise exception 'takas bulunamadı';
  end if;
  if t.status = 'DELIVERED' then
    return t;                      -- idempotent: aynı webhook iki kez gelebilir
  end if;
  if t.status <> 'SHIPPED' then
    raise exception 'teslim edildi yalnızca SHIPPED durumundan işaretlenir (mevcut: %)', t.status;
  end if;

  update public.trades set status = 'DELIVERED', updated_at = now()
   where id = t.id
  returning * into t;
  return t;
end; $$;

revoke all on function public.mark_delivered(uuid) from public;
grant execute on function public.mark_delivered(uuid) to service_role;

-- ============================ 5) SÜRESİ DOLANLAR ============================
-- Tek bakım fonksiyonu; zamanlanmış görev bunu çağırır. Her satır kendi
-- işleminde ele alınmaz — biri patlarsa tümü geri sarılır ve bir sonraki
-- koşuda tekrar denenir. Bu bilinçli: yarım kalmış bir tarama, yanlış
-- tamamlanmış bir takastan iyidir.

create or replace function public.expire_stale_trades()
returns table (odenmedi integer, birakilmadi integer, otomatik_onay integer)
language plpgsql security definer set search_path = public as $$
declare t public.trades;
begin
  odenmedi := 0; birakilmadi := 0; otomatik_onay := 0;

  for t in
    select * from public.trades
     where deadline_at is not null and deadline_at <= now()
     order by deadline_at
     for update
  loop
    if t.status in ('CREATED','POINTS_HELD') then
      -- Kargo bedeli ödenmedi. Ödeme gerçekten yoksa iade et: PAID bir kayıt
      -- varken iade etmek, parası alınmış alıcının takasını iptal etmek olurdu.
      if exists (select 1 from public.cargo_payments c
                  where c.conversation_id = t.id::text and c.status = 'PAID') then
        -- Ödeme var ama takas ilerlememiş: veri tutarsızlığı, sayacı ileri
        -- alıp insana bırakıyoruz. Sessizce iade YOK.
        update public.trades set deadline_at = now() + interval '1 hour' where id = t.id;
        raise warning '[expire_stale_trades] ödeme PAID ama takas % durumunda: %', t.status, t.id;
      else
        perform public.refund_points(t.id, 'Kargo bedeli süresinde ödenmedi');
        odenmedi := odenmedi + 1;
      end if;

    elsif t.status = 'SHIPPED' then
      -- Satıcı üç gün içinde şubeye bırakmadı. Puan alıcıya döner; kargo
      -- bedelinin iadesi ayrı bir iştir ve elle yapılır (Ana Doküman 4.5).
      perform public.refund_points(t.id, 'Satıcı ürünü süresinde kargoya vermedi');
      birakilmadi := birakilmadi + 1;

    elsif t.status = 'DELIVERED' then
      -- 48 saat doldu, alıcı ne onayladı ne itiraz etti. Puan satıcıya geçer.
      perform public.release_points(t.id);
      otomatik_onay := otomatik_onay + 1;

    else
      -- Beklenmeyen durumda sayaç asılı kalmasın.
      update public.trades set deadline_at = null where id = t.id;
    end if;
  end loop;

  return next;
end; $$;

revoke all on function public.expire_stale_trades() from public;
grant execute on function public.expire_stale_trades() to service_role;
