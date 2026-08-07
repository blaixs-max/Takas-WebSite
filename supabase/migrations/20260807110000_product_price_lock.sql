-- KIDS TRADE — İlan fiyatı ve durumu istemciden değiştirilemez
--
-- products RLS'i "kendi ilanını güncelle" diyordu ve hangi kolonun
-- güncellenebileceğini hiç sınırlamıyordu. Postgres'te UPDATE politikası satır
-- düzeyindedir, kolon düzeyinde değil; dolayısıyla satıcı 260 puanlık ilanını
-- 999999 yapabiliyordu. Sepetindeki alıcı için de değişiyordu.
--
-- Aynı boşluk status kolonunda da vardı: satıcı satılmış bir ilanı elle
-- ACTIVE'e çevirip ikinci kez sattırabilirdi.
--
-- Çözüm iki katmanlı:
--   * Trigger, istemci oturumundan gelen UPDATE'te points ve status'ün
--     değişmesini reddeder. Kural veri tabanında, politikada değil — RLS
--     politikası ileride gevşetilse bile ayakta kalır.
--   * Fiyat değişikliği için ayrı bir RPC verilir: yalnızca AŞAĞI yönde ve
--     yalnızca ilan ACTIVE iken. Yukarı yön tamamen kapalıdır.

-- ============================ 1) DEĞERLEME İZİ ============================
-- Yapay zekâ değerlemesinin önerdiği puan saklanır; satıcı bunun üzerine
-- çıkamaz. Kolon yoksa mevcut ilanlar için listelenen puanla doldurulur.

alter table public.products
  add column if not exists ai_suggested_points integer;

update public.products
   set ai_suggested_points = points
 where ai_suggested_points is null;

alter table public.products
  drop constraint if exists products_points_le_suggested;
alter table public.products
  add constraint products_points_le_suggested
  check (ai_suggested_points is null or points <= ai_suggested_points);

-- ============================ 2) KOLON KİLİDİ ============================

create or replace function public.products_guard_client_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- service_role ve tabloyu doğrudan yöneten roller muaf; kilit istemci
  -- oturumları içindir. auth.uid() yalnızca istemci oturumunda doludur.
  if auth.uid() is null then
    return new;
  end if;

  if new.points is distinct from old.points then
    raise exception
      'İlan puanı doğrudan değiştirilemez; set_product_points() kullanın';
  end if;

  if new.status is distinct from old.status then
    raise exception
      'İlan durumu doğrudan değiştirilemez; durum takas akışıyla değişir';
  end if;

  if new.ai_suggested_points is distinct from old.ai_suggested_points then
    raise exception 'Değerleme sonucu değiştirilemez';
  end if;

  if new.seller_id is distinct from old.seller_id then
    raise exception 'İlan sahibi değiştirilemez';
  end if;

  return new;
end; $$;

drop trigger if exists products_client_update_guard on public.products;
create trigger products_client_update_guard
  before update on public.products
  for each row execute function public.products_guard_client_update();

-- ============================ 3) FİYAT DÜŞÜRME RPC'Sİ ============================
-- Satıcının tek meşru fiyat hareketi: aşağı çekmek. Hızlı satış için indirim
-- yapabilsin diye vardır; yukarı yön değerlemenin anlamını ortadan kaldırırdı.

create or replace function public.set_product_points(
  p_product_id text,
  p_points     integer
)
returns public.products
language plpgsql security definer set search_path = public as $$
declare p public.products;
begin
  select * into p from public.products where id = p_product_id for update;
  if not found then
    raise exception 'ilan % bulunamadı', p_product_id;
  end if;
  if p.seller_id is distinct from auth.uid() then
    raise exception 'yalnızca ilan sahibi fiyat değiştirebilir';
  end if;
  if p.status <> 'ACTIVE' then
    raise exception 'yalnızca yayındaki ilanın fiyatı değiştirilebilir (mevcut: %)', p.status;
  end if;
  if p_points <= 0 then
    raise exception 'puan sıfırdan büyük olmalı';
  end if;
  if p_points > p.points then
    raise exception 'ilan puanı yalnızca aşağı çekilebilir (mevcut: %)', p.points;
  end if;

  -- Trigger istemci oturumunda points değişimini reddediyor; bu fonksiyon
  -- security definer olduğu için auth.uid() dolu kalır, o yüzden trigger
  -- geçici olarak atlanır.
  perform set_config('kt.bypass_product_guard', 'on', true);
  update public.products set points = p_points where id = p.id returning * into p;
  perform set_config('kt.bypass_product_guard', 'off', true);

  return p;
end; $$;

-- Trigger'ın RPC muafiyetini tanıması için güncellenir.
create or replace function public.products_guard_client_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null
     or coalesce(current_setting('kt.bypass_product_guard', true), 'off') = 'on' then
    return new;
  end if;

  if new.points is distinct from old.points then
    raise exception
      'İlan puanı doğrudan değiştirilemez; set_product_points() kullanın';
  end if;
  if new.status is distinct from old.status then
    raise exception
      'İlan durumu doğrudan değiştirilemez; durum takas akışıyla değişir';
  end if;
  if new.ai_suggested_points is distinct from old.ai_suggested_points then
    raise exception 'Değerleme sonucu değiştirilemez';
  end if;
  if new.seller_id is distinct from old.seller_id then
    raise exception 'İlan sahibi değiştirilemez';
  end if;

  return new;
end; $$;

revoke all on function public.set_product_points(text, integer) from public;
grant execute on function public.set_product_points(text, integer) to authenticated;
