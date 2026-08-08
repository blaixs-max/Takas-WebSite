-- KIDS TRADE — İade ve uyuşmazlık (Ana Doküman Bölüm 5)
--
-- open_dispute() itirazı açıyor ve sayacı durduruyordu ama arkasında hiçbir şey
-- yoktu: kanıt yüklenemiyor, karar verilemiyor, puan karar verilene kadar
-- emanette asılı kalıyordu. Bu göç bölüm 5'in tamamını kodlar.
--
-- Ayrıca bir HATA düzeltir. 5.4 şunu söylüyor: "48 saatlik sayaç iade talebi
-- açıldığında durur; talep reddedilirse kaldığı yerden devam eder,
-- sıfırlanmaz." Önceki göçte durdurma `deadline_at := null` ile yapılıyordu ve
-- kalan süre kayboluyordu. Reddedilen her talepten sonra alıcı sıfırdan 48 saat
-- kazanırdı — dokümanın tam da uyardığı suistimal. Kalan süre artık saklanıyor.

-- ============================ 1) AYARLAR ============================

alter table public.trade_timings
  -- 5.3 · 2: kanıt yoksa 24 saat ek süre verilir.
  add column if not exists evidence_window interval,
  -- 4.5: iade değerlendirmesi hedefi 48 saat. Aşılırsa öncelik kuyruğuna alınır;
  -- karar OTOMATİK verilmez, süre yalnızca ölçülür.
  add column if not exists decision_window interval;

update public.trade_timings
   set evidence_window = coalesce(evidence_window, interval '24 hours'),
       decision_window = coalesce(decision_window, interval '48 hours')
 where id;

alter table public.trade_timings
  alter column evidence_window set not null,
  alter column decision_window set not null;

-- 5.2: eşikli hibrit modelin eşiği.
create table if not exists public.dispute_policy (
  id                     boolean primary key default true check (id),
  -- Bu puanın altında ürün alıcıda kalır; üstünde satıcıya geri gönderilir ve
  -- iade kargosu için satıcı adına borç kaydı açılır.
  return_threshold_points integer not null,
  updated_at             timestamptz not null default now()
);

insert into public.dispute_policy (id, return_threshold_points)
values (true, 500)
on conflict (id) do update set
  return_threshold_points = excluded.return_threshold_points,
  updated_at = now();

alter table public.dispute_policy enable row level security;
drop policy if exists "iade eşiği herkese açık" on public.dispute_policy;
create policy "iade eşiği herkese açık"
  on public.dispute_policy for select to anon, authenticated using (true);

-- ============================ 2) SAYACIN KALAN SÜRESİ ============================

alter table public.trades
  -- İtiraz açıldığında sayacın kalan süresi buraya yazılır. Talep reddedilirse
  -- sayaç bu süreyle devam eder; sıfırdan başlamaz (5.4).
  add column if not exists deadline_remaining interval;

create or replace function public.trades_stamp_timeline()
returns trigger language plpgsql set search_path = public as $$
declare s public.trade_timings;
begin
  select * into s from public.trade_timings where id;

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
      new.deadline_at := now() + s.payment_window;

    when 'SHIPPED' then
      new.shipped_at  := coalesce(new.shipped_at, now());
      new.deadline_at := now() + s.dropoff_window;

    when 'DELIVERED' then
      new.delivered_at := coalesce(new.delivered_at, now());
      if old.status = 'DISPUTED' then
        -- 5.4: reddedilen talepten dönüş. Sayaç KALDIĞI YERDEN devam eder.
        -- Kalan süre bilinmiyorsa (eski satır) tam pencere verilir; bu, alıcı
        -- lehine tek istisnadır ve yalnızca göç öncesi satırlarda olur.
        new.deadline_at        := now() + coalesce(old.deadline_remaining, s.confirm_window);
        new.deadline_remaining := null;
      else
        new.deadline_at := now() + s.confirm_window;
      end if;

    when 'DISPUTED' then
      -- Sayaç durur ama kalan süre saklanır. Süre zaten dolmuşsa sıfır yazılır:
      -- itiraz açmak geçmiş süreyi geri getirmez.
      new.deadline_remaining := greatest(coalesce(old.deadline_at, now()) - now(), interval '0');
      new.deadline_at        := null;

    when 'COMPLETED' then
      new.completed_at       := coalesce(new.completed_at, now());
      new.deadline_at        := null;
      new.deadline_remaining := null;

    when 'REFUNDED' then
      new.deadline_at        := null;
      new.deadline_remaining := null;

    else
      null;
  end case;

  return new;
end; $$;

-- ============================ 3) İTİRAZ KAYDI ============================

create table if not exists public.disputes (
  id          uuid primary key default gen_random_uuid(),
  trade_id    uuid not null references public.trades(id) on delete restrict,
  opened_by   uuid not null,
  reason      text not null check (btrim(reason) <> ''),
  status      text not null default 'OPEN'
                check (status in ('OPEN','NEEDS_EVIDENCE','RESOLVED','REJECTED')),
  -- Karar verildiğinde doldurulur. 5.2'deki üç sonuç:
  --   REFUND_KEEP   — tam iade, ürün alıcıda kalır (puan < eşik)
  --   REFUND_RETURN — tam iade, ürün satıcıya döner, borç kaydı açılır
  --   REJECTED      — talep reddedilir, sayaç kaldığı yerden devam eder
  resolution  text check (resolution in ('REFUND_KEEP','REFUND_RETURN','REJECTED')),
  -- 5.2: hasar kargodan kaynaklıysa kargo firmasından tazmin talep edilir.
  carrier_claim boolean not null default false,
  decision_note text,
  decided_by  uuid,
  decided_at  timestamptz,
  -- Kanıt ya da karar için beklenen an. Kapanınca null olur.
  deadline_at timestamptz,
  created_at  timestamptz not null default now()
);

-- Bir takasın aynı anda yalnızca bir açık itirazı olabilir. Kapanmışlar sayılmaz,
-- çünkü reddedilen talepten sonra ikinci bir talep açılabilmeli.
create unique index if not exists disputes_tek_acik_uidx
  on public.disputes(trade_id)
  where status in ('OPEN','NEEDS_EVIDENCE');

create index if not exists disputes_deadline_idx
  on public.disputes(deadline_at) where deadline_at is not null;

alter table public.disputes enable row level security;

drop policy if exists "taraf olduğun itirazı gör" on public.disputes;
create policy "taraf olduğun itirazı gör"
  on public.disputes for select to authenticated
  using (exists (select 1 from public.trades t
                  where t.id = disputes.trade_id
                    and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())));

-- Yazma yok: itiraz yalnızca open_dispute() ile açılır, yalnızca
-- resolve_dispute() ile kapanır. İstemci satırı doğrudan değiştiremez.

-- ============================ 4) KANIT ============================

create table if not exists public.dispute_evidence (
  id           uuid primary key default gen_random_uuid(),
  dispute_id   uuid not null references public.disputes(id) on delete cascade,
  uploaded_by  uuid not null,
  storage_path text not null unique,
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists dispute_evidence_dispute_idx
  on public.dispute_evidence(dispute_id);

alter table public.dispute_evidence enable row level security;

drop policy if exists "taraf olduğun kanıtı gör" on public.dispute_evidence;
create policy "taraf olduğun kanıtı gör"
  on public.dispute_evidence for select to authenticated
  using (exists (select 1 from public.disputes d
                  join public.trades t on t.id = d.trade_id
                 where d.id = dispute_evidence.dispute_id
                   and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())));

drop policy if exists "kendi kanıtını ekle" on public.dispute_evidence;
create policy "kendi kanıtını ekle"
  on public.dispute_evidence for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (select 1 from public.disputes d
                 join public.trades t on t.id = d.trade_id
                where d.id = dispute_evidence.dispute_id
                  and d.status in ('OPEN','NEEDS_EVIDENCE')
                  and (t.buyer_id = auth.uid() or t.seller_id = auth.uid()))
  );

-- Kanıt kovası. İlan kareleriyle aynı desen: yolun ilk klasörü sahibi belirtir.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dispute-evidence', 'dispute-evidence', false, 10485760,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "kanıtı kendi klasörüne yükle" on storage.objects;
create policy "kanıtı kendi klasörüne yükle"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'dispute-evidence'
              and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "kendi kanıt klasörünü oku" on storage.objects;
create policy "kendi kanıt klasörünü oku"
  on storage.objects for select to authenticated
  using (bucket_id = 'dispute-evidence'
         and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================ 5) SATICI BORCU ============================
-- 5.2: ürün puanı eşiğin üstündeyse iade kargosunu platform öder ve satıcı
-- adına borç kaydı açılır.

create table if not exists public.seller_debts (
  id         uuid primary key default gen_random_uuid(),
  seller_id  uuid not null,
  trade_id   uuid not null references public.trades(id) on delete restrict,
  dispute_id uuid references public.disputes(id) on delete set null,
  amount_tl  numeric(10,2) not null check (amount_tl > 0),
  reason     text not null,
  status     text not null default 'OPEN' check (status in ('OPEN','PAID','WAIVED')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists seller_debts_seller_idx on public.seller_debts(seller_id);

alter table public.seller_debts enable row level security;
drop policy if exists "kendi borcunu gör" on public.seller_debts;
create policy "kendi borcunu gör"
  on public.seller_debts for select to authenticated using (seller_id = auth.uid());

-- ============================ 6) İTİRAZ AÇMA ============================
-- Önceki sürüm yalnızca takasın durumunu değiştiriyordu. Artık kayıt da açılır.

-- Dönüş tipi değişiyor (trades → disputes), o yüzden önce düşürülmeli.
drop function if exists public.open_dispute(uuid, text);

create or replace function public.open_dispute(p_trade_id uuid, p_reason text)
returns public.disputes
language plpgsql security definer set search_path = public as $$
declare t public.trades; d public.disputes; s public.trade_timings;
begin
  if auth.uid() is null then
    raise exception 'oturum bulunamadı';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'itiraz gerekçesi zorunludur';
  end if;

  select * into s from public.trade_timings where id;
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

  -- 5.3 · 1: şikâyet teslimden sonraki 48 saat içinde mi? Teslim bildirilmemişse
  -- süre henüz başlamamıştır, itiraz her zaman açılabilir.
  if t.delivered_at is not null and now() > t.delivered_at + s.confirm_window then
    raise exception 'itiraz süresi geçmiş (teslimden sonra % içinde açılmalıydı)', s.confirm_window;
  end if;

  insert into public.disputes (trade_id, opened_by, reason, status, deadline_at)
  values (t.id, auth.uid(), btrim(p_reason), 'NEEDS_EVIDENCE', now() + s.evidence_window)
  returning * into d;

  update public.trades
     set status = 'DISPUTED', dispute_reason = btrim(p_reason), updated_at = now()
   where id = t.id;

  return d;
end; $$;

revoke all on function public.open_dispute(uuid, text) from public;
grant execute on function public.open_dispute(uuid, text) to authenticated;
grant execute on function public.open_dispute(uuid, text) to service_role;

-- ============================ 7) KANIT EKLEME ============================

create or replace function public.add_dispute_evidence(
  p_dispute_id uuid,
  p_storage_path text,
  p_note text default null
)
returns public.disputes
language plpgsql security definer set search_path = public as $$
declare d public.disputes; s public.trade_timings; taraf boolean;
begin
  if auth.uid() is null then
    raise exception 'oturum bulunamadı';
  end if;

  select * into s from public.trade_timings where id;
  select * into d from public.disputes where id = p_dispute_id for update;
  if not found then
    raise exception 'itiraz bulunamadı';
  end if;
  if d.status not in ('OPEN','NEEDS_EVIDENCE') then
    raise exception 'kapanmış itiraza kanıt eklenemez';
  end if;

  -- Kanıtı iki taraf da yükleyebilir: satıcının savunma hakkı vardır.
  select exists (select 1 from public.trades t
                  where t.id = d.trade_id
                    and (t.buyer_id = auth.uid() or t.seller_id = auth.uid()))
    into taraf;
  if not taraf then
    raise exception 'bu itiraza yalnızca takasın tarafları kanıt ekleyebilir';
  end if;

  -- Yol sahipliği: kimse başkasının klasörünü kanıt diye gösteremesin.
  if split_part(p_storage_path, '/', 1) <> auth.uid()::text then
    raise exception 'kanıt kendi klasörünüzde olmalı';
  end if;

  insert into public.dispute_evidence (dispute_id, uploaded_by, storage_path, note)
  values (d.id, auth.uid(), p_storage_path, p_note);

  -- İlk kanıt gelince talep karar kuyruğuna geçer ve karar sayacı başlar.
  if d.status = 'NEEDS_EVIDENCE' then
    update public.disputes
       set status = 'OPEN', deadline_at = now() + s.decision_window
     where id = d.id
    returning * into d;
  end if;

  return d;
end; $$;

revoke all on function public.add_dispute_evidence(uuid, text, text) from public;
grant execute on function public.add_dispute_evidence(uuid, text, text) to authenticated;
grant execute on function public.add_dispute_evidence(uuid, text, text) to service_role;

-- ============================ 8) KARAR ============================
-- Kararı insan verir. Bu fonksiyon yalnızca service_role'a açıktır ve hiçbir
-- koşulda authenticated'a verilmez: kendi itirazına karar veren bir alıcı,
-- platformun tamamını boşaltabilirdi.

create or replace function public.resolve_dispute(
  p_dispute_id    uuid,
  p_kabul         boolean,
  p_not           text default null,
  p_kargo_hasari  boolean default false,
  p_iade_kargo_tl numeric default null,
  p_karar_veren   uuid default null
)
returns public.disputes
language plpgsql security definer set search_path = public as $$
declare d public.disputes; t public.trades; esik integer; sonuc text;
begin
  select return_threshold_points into esik from public.dispute_policy where id;

  select * into d from public.disputes where id = p_dispute_id for update;
  if not found then
    raise exception 'itiraz bulunamadı';
  end if;
  if d.status not in ('OPEN','NEEDS_EVIDENCE') then
    raise exception 'itiraz zaten sonuçlanmış (%)', d.status;
  end if;

  select * into t from public.trades where id = d.trade_id for update;

  if not p_kabul then
    -- 5.3 · 3: ürün ayıpsızsa talep reddedilir. 5.4: sayaç kaldığı yerden
    -- devam eder — trigger `deadline_remaining` üzerinden sürdürür.
    update public.trades set status = 'DELIVERED', updated_at = now()
     where id = t.id;

    update public.disputes
       set status = 'REJECTED', resolution = 'REJECTED', decision_note = p_not,
           decided_by = p_karar_veren, decided_at = now(), deadline_at = null
     where id = d.id
    returning * into d;
    return d;
  end if;

  -- Kabul: her hâlükârda tam iade. Fark, ürünün nerede kaldığında (5.2).
  sonuc := case when t.points >= esik then 'REFUND_RETURN' else 'REFUND_KEEP' end;

  perform public.refund_points(
    t.id,
    case when sonuc = 'REFUND_RETURN'
         then 'İade kabul edildi — ürün satıcıya geri gönderiliyor'
         else 'İade kabul edildi — ürün alıcıda kalıyor' end);

  -- Eşiğin üstünde iade kargosunu platform öder, satıcıya borç yazılır.
  if sonuc = 'REFUND_RETURN' and coalesce(p_iade_kargo_tl, 0) > 0 then
    insert into public.seller_debts (seller_id, trade_id, dispute_id, amount_tl, reason)
    values (t.seller_id, t.id, d.id, p_iade_kargo_tl, 'İade kargosu');
  end if;

  update public.disputes
     set status = 'RESOLVED', resolution = sonuc, carrier_claim = p_kargo_hasari,
         decision_note = p_not, decided_by = p_karar_veren, decided_at = now(),
         deadline_at = null
   where id = d.id
  returning * into d;

  return d;
end; $$;

revoke all on function public.resolve_dispute(uuid, boolean, text, boolean, numeric, uuid) from public;
grant execute on function public.resolve_dispute(uuid, boolean, text, boolean, numeric, uuid)
  to service_role;

-- ============================ 9) KARGO ÖNCESİ İPTAL ============================
-- 5.1: alıcı, ürün kargoya verilmeden önce satıcı onayı gerekmeden iptal eder.

create or replace function public.cancel_trade(p_trade_id uuid)
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
    raise exception 'bu takası yalnızca alıcı iptal edebilir';
  end if;
  if t.status not in ('CREATED','POINTS_HELD') then
    -- Kargoya verildikten sonrası iptal değil, iade konusudur (5.2).
    raise exception 'ürün kargoya verildikten sonra iptal edilemez (mevcut: %)', t.status;
  end if;

  -- Kart ödemesi alınmışsa iadesi iyzico tarafında yapılır; burada yalnızca
  -- işaretlenir. Sessizce puan iade edip parayı unutmayalım.
  update public.cargo_payments
     set status = 'FAILED'
   where conversation_id = t.id::text and status = 'PENDING';

  if exists (select 1 from public.cargo_payments
              where conversation_id = t.id::text and status = 'PAID') then
    raise warning '[cancel_trade] kart ödemesi alınmış, iyzico iadesi elle yapılmalı: %', t.id;
  end if;

  return public.refund_points(t.id, 'Alıcı kargo öncesi iptal etti');
end; $$;

revoke all on function public.cancel_trade(uuid) from public;
grant execute on function public.cancel_trade(uuid) to authenticated;
grant execute on function public.cancel_trade(uuid) to service_role;

-- ============================ 10) SÜRESİ DOLAN İTİRAZLAR ============================

create or replace function public.expire_stale_disputes()
returns table (kanit_gelmedi integer, karar_gecikti integer)
language plpgsql security definer set search_path = public as $$
declare d public.disputes;
begin
  kanit_gelmedi := 0; karar_gecikti := 0;

  for d in
    select * from public.disputes
     where deadline_at is not null and deadline_at <= now()
       and status in ('OPEN','NEEDS_EVIDENCE')
     order by deadline_at
     for update
  loop
    if d.status = 'NEEDS_EVIDENCE' then
      -- 5.3 · 2: 24 saatte kanıt gelmediyse talep reddedilir ve sayaç kaldığı
      -- yerden devam eder. Kararı burada makine veriyor çünkü kanıtsız talep
      -- değerlendirilemez; insanın bakacağı bir şey yok.
      update public.trades set status = 'DELIVERED', updated_at = now()
       where id = d.trade_id;
      update public.disputes
         set status = 'REJECTED', resolution = 'REJECTED', deadline_at = null,
             decision_note = 'Kanıt süresinde yüklenmedi', decided_at = now()
       where id = d.id;
      kanit_gelmedi := kanit_gelmedi + 1;
    else
      -- 4.5: karar hedefi aşıldı. KARAR VERİLMEZ — yalnızca öncelik kuyruğuna
      -- alınır. Makinenin ayıplı olup olmadığına karar vermesi istenmiyor.
      update public.disputes set deadline_at = now() + interval '6 hours'
       where id = d.id;
      karar_gecikti := karar_gecikti + 1;
      raise warning '[expire_stale_disputes] karar süresi aşıldı: %', d.id;
    end if;
  end loop;

  return next;
end; $$;

revoke all on function public.expire_stale_disputes() from public;
grant execute on function public.expire_stale_disputes() to service_role;
