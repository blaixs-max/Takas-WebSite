-- KIDS TRADE — Yaptırım merdiveni (Ana Doküman 5.5)
--
-- Beş ayrı olay güven skorunu düşürüyordu ama düşük skorun hiçbir sonucu
-- yoktu: ceza sayılıyor, uygulanmıyordu. Merdiven bunu kapatır.
--
-- 5.5: "Merdiven üç basamaklıdır: uyarı → kısıt (yeni ilan ve alım durur,
-- süren takaslar tamamlanır) → kalıcı kapatma. İlk iki basamak otomatik
-- olabilir; kalıcı kapatma kararını her zaman insan verir."
--
-- ÖNEMLİ: MERDİVEN KAPALI KURULUYOR (active = false).
--
-- Sebebi eşiklerin ürün kararı olması. Çok sert bir eşik dürüst satıcıyı da
-- vurur ve o kişi bir daha dönmez; çok gevşek olanı merdiveni anlamsız kılar.
-- Buradaki 70 ve 40 birer başlangıç önerisidir, karar değildir. Kurucu
-- onayladıktan sonra tek satırla açılır:
--
--   update sanction_settings set active = true;
--
-- Mekanizmayı hazır ama kapalı bırakmak bilinçli: gerçek kullanıcı hesabını
-- otomatik kısıtlamak, etkisi geri alınması zor bir iştir.

-- ============================ 1) AYARLAR ============================

create table if not exists public.sanction_settings (
  id             boolean primary key default true check (id),
  active         boolean not null default false,
  -- Bu skorun altında uyarı gider.
  warn_score     integer not null,
  -- Bu skorun altında yeni ilan ve yeni alım durur.
  restrict_score integer not null,
  updated_at     timestamptz not null default now(),
  constraint sanction_esik_sirasi check (restrict_score < warn_score)
);

insert into public.sanction_settings (id, active, warn_score, restrict_score)
values (true, false, 70, 40)
on conflict (id) do nothing;

alter table public.sanction_settings enable row level security;
drop policy if exists "yaptırım ayarları herkese açık" on public.sanction_settings;
create policy "yaptırım ayarları herkese açık"
  on public.sanction_settings for select to anon, authenticated using (true);

-- ============================ 2) YAPTIRIM KAYDI ============================

create table if not exists public.user_sanctions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  level      text not null check (level in ('WARNED','RESTRICTED','CLOSED')),
  reason     text not null,
  -- null ise merdiven otomatik uyguladı; dolu ise insan kararı.
  decided_by uuid,
  lifted_at  timestamptz,
  lifted_by  uuid,
  created_at timestamptz not null default now()
);

create index if not exists user_sanctions_user_idx
  on public.user_sanctions(user_id, created_at desc);
-- Bir kullanıcının aynı seviyede birden çok AÇIK yaptırımı olmasın.
create unique index if not exists user_sanctions_acik_uidx
  on public.user_sanctions(user_id, level) where lifted_at is null;

alter table public.user_sanctions enable row level security;

drop policy if exists "kendi yaptırımını gör" on public.user_sanctions;
create policy "kendi yaptırımını gör"
  on public.user_sanctions for select to authenticated using (user_id = auth.uid());

drop policy if exists "yönetici yaptırımları görür" on public.user_sanctions;
create policy "yönetici yaptırımları görür"
  on public.user_sanctions for select to authenticated using (public.is_admin());

-- ============================ 3) DURUM SORGULARI ============================

create or replace function public.is_restricted(p_user uuid default null)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_sanctions s
     where s.user_id = coalesce(p_user, auth.uid())
       and s.level in ('RESTRICTED','CLOSED')
       and s.lifted_at is null
  );
$$;

revoke all on function public.is_restricted(uuid) from public;
grant execute on function public.is_restricted(uuid) to authenticated;
grant execute on function public.is_restricted(uuid) to service_role;

create or replace function public.my_sanction()
returns table (level text, reason text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.level, s.reason, s.created_at
    from public.user_sanctions s
   where s.user_id = auth.uid() and s.lifted_at is null
   order by case s.level when 'CLOSED' then 3 when 'RESTRICTED' then 2 else 1 end desc
   limit 1;
$$;

revoke all on function public.my_sanction() from public;
grant execute on function public.my_sanction() to authenticated;

-- ============================ 4) MERDİVEN ============================

create or replace function public.apply_sanction_ladder(p_user uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare s public.sanction_settings; skor integer; hedef text;
begin
  select * into s from public.sanction_settings where id;
  if not found or not s.active then
    return null;                       -- merdiven kapalı: hiçbir şey yapılmaz
  end if;

  select t.skor into skor from public.user_trust(p_user) t;
  if skor is null then
    return null;                       -- skoru olmayana yaptırım uygulanmaz
  end if;

  if skor < s.restrict_score then
    hedef := 'RESTRICTED';
  elsif skor < s.warn_score then
    hedef := 'WARNED';
  else
    return null;
  end if;

  -- Kapatılmış hesaba alt basamak yazmaya gerek yok.
  if exists (select 1 from public.user_sanctions x
              where x.user_id = p_user and x.level = 'CLOSED' and x.lifted_at is null) then
    return null;
  end if;

  -- Zaten bu basamakta ya da daha ağırındaysa tekrar yazma.
  if hedef = 'WARNED' and exists (
       select 1 from public.user_sanctions x
        where x.user_id = p_user and x.lifted_at is null
          and x.level in ('WARNED','RESTRICTED')) then
    return null;
  end if;
  if hedef = 'RESTRICTED' and exists (
       select 1 from public.user_sanctions x
        where x.user_id = p_user and x.level = 'RESTRICTED' and x.lifted_at is null) then
    return null;
  end if;

  insert into public.user_sanctions (user_id, level, reason)
  values (p_user, hedef,
          'Güven skoru ' || skor || ' — otomatik ' ||
          case hedef when 'WARNED' then 'uyarı' else 'kısıt' end);

  if hedef = 'WARNED' then
    perform public.notify(p_user, 'sanction.warned',
      'Güven skorunuz düştü',
      'Skorunuz ' || skor || '. Düşmeye devam ederse yeni ilan verme ve alım yapma ' ||
      'yetkiniz geçici olarak durur. Profilinizden nedenlerini görebilirsiniz.',
      jsonb_build_object('skor', skor));
  else
    -- Süren takaslar tamamlanır (5.5); duran şey yalnızca yeni ilan ve yeni alım.
    perform public.notify(p_user, 'sanction.restricted',
      'Hesabınız geçici olarak kısıtlandı',
      'Güven skorunuz ' || skor || '. Yeni ilan veremez ve yeni alım yapamazsınız. ' ||
      'Süren takaslarınız normal şekilde tamamlanır.',
      jsonb_build_object('skor', skor));
  end if;

  perform public.audit('sanction.auto', 'user:' || p_user::text,
    jsonb_build_object('level', hedef, 'skor', skor));

  return hedef;
end; $$;

revoke all on function public.apply_sanction_ladder(uuid) from public;
grant execute on function public.apply_sanction_ladder(uuid) to service_role;

-- ============================ 5) TETİKLEYİCİLER ============================
-- Skoru düşüren her olaydan sonra merdiven yoklanır. Cron yerine trigger:
-- kısıt, cezayı doğuran olayla aynı anda doğmalı.

create or replace function public.sanction_after_dispute()
returns trigger language plpgsql security definer set search_path = public as $$
declare t public.trades;
begin
  if new.status not in ('RESOLVED','REJECTED') or old.status = new.status then
    return new;
  end if;
  select * into t from public.trades where id = new.trade_id;
  if new.status = 'RESOLVED' then
    perform public.apply_sanction_ladder(t.seller_id);     -- ayıplı satış
  else
    perform public.apply_sanction_ladder(new.opened_by);   -- asılsız talep
  end if;
  return new;
end; $$;

drop trigger if exists disputes_sanction_trg on public.disputes;
create trigger disputes_sanction_trg
  after update on public.disputes
  for each row execute function public.sanction_after_dispute();

create or replace function public.sanction_after_report()
returns trigger language plpgsql security definer set search_path = public as $$
declare m public.messages;
begin
  if new.status <> 'ACTIONED' or old.status = 'ACTIONED' then
    return new;
  end if;
  select * into m from public.messages where id = new.message_id;
  perform public.apply_sanction_ladder(m.sender_id);
  return new;
end; $$;

drop trigger if exists reports_sanction_trg on public.message_reports;
create trigger reports_sanction_trg
  after update on public.message_reports
  for each row execute function public.sanction_after_report();

create or replace function public.sanction_after_debt()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.apply_sanction_ladder(new.seller_id);
  return new;
end; $$;

drop trigger if exists debts_sanction_trg on public.seller_debts;
create trigger debts_sanction_trg
  after insert on public.seller_debts
  for each row execute function public.sanction_after_debt();

-- ============================ 6) KISITIN DİŞİ ============================
-- Kayıt tutmak yaptırım değildir; kısıt gerçekten bir şeyi durdurmalı.

-- İki ayrı fonksiyon: plpgsql bir AND ifadesini kısa devre yapmaz, ifadenin
-- tamamını SQL çalıştırıcısına verir. Tek fonksiyonda `tg_table_name = 'trades'
-- and ... new.buyer_id` yazmak, ürün eklerken de new.buyer_id'yi çözmeye
-- çalışır ve "record new has no field buyer_id" hatası verir.

create or replace function public.guard_restricted_product()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.seller_id is not null and public.is_restricted(new.seller_id) then
    raise exception 'hesabınız kısıtlı: yeni ilan veremezsiniz';
  end if;
  return new;
end; $$;

create or replace function public.guard_restricted_trade()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_restricted(new.buyer_id) then
    raise exception 'hesabınız kısıtlı: yeni takas başlatamazsınız';
  end if;
  return new;
end; $$;

drop trigger if exists products_restricted_guard on public.products;
create trigger products_restricted_guard
  before insert on public.products
  for each row execute function public.guard_restricted_product();

drop trigger if exists trades_restricted_guard on public.trades;
create trigger trades_restricted_guard
  before insert on public.trades
  for each row execute function public.guard_restricted_trade();

-- ============================ 7) İNSAN KARARLARI ============================
-- 5.5: kalıcı kapatma kararını HER ZAMAN insan verir.

create or replace function public.admin_close_account(p_user uuid, p_not text)
returns public.user_sanctions
language plpgsql security definer set search_path = public as $$
declare s public.user_sanctions;
begin
  if not public.is_admin() then
    raise exception 'bu işlem için yönetici yetkisi gerekir';
  end if;
  if p_not is null or btrim(p_not) = '' then
    raise exception 'karar gerekçesi zorunludur';
  end if;
  if p_user = auth.uid() then
    raise exception 'kendi hesabınızı kapatamazsınız';
  end if;

  insert into public.user_sanctions (user_id, level, reason, decided_by)
  values (p_user, 'CLOSED', btrim(p_not), auth.uid())
  on conflict do nothing
  returning * into s;

  if s.id is null then
    select * into s from public.user_sanctions
     where user_id = p_user and level = 'CLOSED' and lifted_at is null;
    return s;
  end if;

  perform public.notify(p_user, 'sanction.closed',
    'Hesabınız kapatıldı', btrim(p_not),
    jsonb_build_object('sanction', s.id));
  perform public.audit('sanction.close', 'user:' || p_user::text,
    jsonb_build_object('not', btrim(p_not)));

  return s;
end; $$;

revoke all on function public.admin_close_account(uuid, text) from public;
grant execute on function public.admin_close_account(uuid, text) to authenticated;
grant execute on function public.admin_close_account(uuid, text) to service_role;

-- Yanlış uygulanan kısıt geri alınabilmeli: otomatik bir karar, itiraz edilemez
-- bir karar olmamalı.
create or replace function public.admin_lift_sanction(p_sanction_id uuid, p_not text)
returns public.user_sanctions
language plpgsql security definer set search_path = public as $$
declare s public.user_sanctions;
begin
  if not public.is_admin() then
    raise exception 'bu işlem için yönetici yetkisi gerekir';
  end if;
  if p_not is null or btrim(p_not) = '' then
    raise exception 'karar gerekçesi zorunludur';
  end if;

  update public.user_sanctions
     set lifted_at = now(), lifted_by = auth.uid()
   where id = p_sanction_id and lifted_at is null
  returning * into s;

  if not found then
    raise exception 'açık yaptırım bulunamadı';
  end if;

  perform public.notify(s.user_id, 'sanction.lifted',
    'Hesap kısıtınız kaldırıldı', btrim(p_not),
    jsonb_build_object('sanction', s.id));
  perform public.audit('sanction.lift', 'user:' || s.user_id::text,
    jsonb_build_object('sanction', s.id, 'not', btrim(p_not)));

  return s;
end; $$;

revoke all on function public.admin_lift_sanction(uuid, text) from public;
grant execute on function public.admin_lift_sanction(uuid, text) to authenticated;
grant execute on function public.admin_lift_sanction(uuid, text) to service_role;

-- ============================ 8) YÖNETİM GÖRÜNÜMÜ ============================

create or replace function public.admin_sanction_list(p_limit integer default 50)
returns table (
  sanction_id uuid,
  user_id     uuid,
  level       text,
  reason      text,
  otomatik    boolean,
  skor        integer,
  created_at  timestamptz
)
language sql stable security definer set search_path = public as $$
  select s.id, s.user_id, s.level, s.reason, s.decided_by is null,
         (select t.skor from public.user_trust(s.user_id) t),
         s.created_at
    from public.user_sanctions s
   where public.is_admin() and s.lifted_at is null
   order by case s.level when 'CLOSED' then 3 when 'RESTRICTED' then 2 else 1 end desc,
            s.created_at desc
   limit greatest(p_limit, 1);
$$;

revoke all on function public.admin_sanction_list(integer) from public;
grant execute on function public.admin_sanction_list(integer) to authenticated;
grant execute on function public.admin_sanction_list(integer) to service_role;
