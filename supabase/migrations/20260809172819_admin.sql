-- KIDS TRADE — Yönetici yetkisi, denetim kaydı ve iki kuyruk
--
-- İki kapı yazıldı ve ikisinin de arkası boş kaldı:
--
--   1. Yayın kapısı `pending` kareyi geçirmiyor — ama `pending` kalan kareyi
--      gören kimse yok. Anahtar tanımlı değilse her ilan orada birikir.
--   2. İtiraz kaydı açılıyor ve karar bekliyor — ama `resolve_dispute` yalnızca
--      `service_role`'da. Karar vermenin tek yolu elle SQL yazmak.
--
-- Bu göç yetkiyi tanımlar, iki kuyruğu görünür kılar ve her insan kararını
-- denetim kaydına yazar.
--
-- Yetki neden JWT'de değil tabloda: rol iddiası oturum yenilenene kadar
-- geçerli olmaz. Yetkisi alınan bir yöneticinin elindeki token'la karar
-- vermeye devam edebilmesi kabul edilemez. Tablo anında etki eder.

-- ============================ 1) YÖNETİCİLER ============================

create table if not exists public.admins (
  user_id    uuid primary key,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Yönetici listesi kimseye açık değil. Kullanıcı kendi yönetici olup
-- olmadığını is_admin() ile öğrenir, listeyi göremez.
drop policy if exists "kendi yönetici satırını gör" on public.admins;
create policy "kendi yönetici satırını gör"
  on public.admins for select to authenticated using (user_id = auth.uid());

-- security definer: RLS'e takılmadan bakar, yoksa politikanın kendisi bu
-- fonksiyona ihtiyaç duyar ve döngü oluşur.
create or replace function public.is_admin(p_user uuid default null)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins a where a.user_id = coalesce(p_user, auth.uid())
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to service_role;

-- ============================ 2) DENETİM KAYDI ============================
-- 5.5: "kalıcı kapatma kararını her zaman insan verir ve gerekçesi denetim
-- kaydına yazılır." Artık insan kararları var, kaydı da olmalı.

create table if not exists public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid not null,
  action     text not null,
  subject    text not null,          -- hangi kayıt: 'dispute:<id>', 'photo:<id>'
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_actor_idx   on public.audit_logs(actor_id);
create index if not exists audit_logs_subject_idx on public.audit_logs(subject);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);

alter table public.audit_logs enable row level security;

-- Kimse silemez, kimse değiştiremez. Defterle aynı mantık: kayıt tutuluyorsa
-- sonradan düzeltilebilir olmamalı.
create or replace function public.audit_logs_degismez()
returns trigger language plpgsql as $$
begin
  raise exception 'denetim kaydı değiştirilemez ve silinemez';
end; $$;

drop trigger if exists audit_logs_no_update on public.audit_logs;
create trigger audit_logs_no_update before update on public.audit_logs
  for each row execute function public.audit_logs_degismez();

drop trigger if exists audit_logs_no_delete on public.audit_logs;
create trigger audit_logs_no_delete before delete on public.audit_logs
  for each row execute function public.audit_logs_degismez();

drop policy if exists "yönetici denetim kaydını görür" on public.audit_logs;
create policy "yönetici denetim kaydını görür"
  on public.audit_logs for select to authenticated using (public.is_admin());

create or replace function public.audit(p_action text, p_subject text, p_detail jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (actor_id, action, subject, detail)
  values (coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
          p_action, p_subject, p_detail);
$$;

-- ============================ 3) KUYRUKLARI GÖRÜNÜR KIL ============================
-- Yönetici karar verebilmek için kararın konusunu görmek zorunda. Bu
-- politikalar yalnızca yöneticiye açıktır; sıradan kullanıcı için hiçbir şey
-- değişmez.

drop policy if exists "yönetici tüm kareleri görür" on public.product_photos;
create policy "yönetici tüm kareleri görür"
  on public.product_photos for select to authenticated using (public.is_admin());

drop policy if exists "yönetici tüm ilanları görür" on public.products;
create policy "yönetici tüm ilanları görür"
  on public.products for select to authenticated using (public.is_admin());

drop policy if exists "yönetici tüm itirazları görür" on public.disputes;
create policy "yönetici tüm itirazları görür"
  on public.disputes for select to authenticated using (public.is_admin());

drop policy if exists "yönetici tüm kanıtları görür" on public.dispute_evidence;
create policy "yönetici tüm kanıtları görür"
  on public.dispute_evidence for select to authenticated using (public.is_admin());

drop policy if exists "yönetici tüm takasları görür" on public.trades;
create policy "yönetici tüm takasları görür"
  on public.trades for select to authenticated using (public.is_admin());

-- Kanıt ve ilan kareleri özel kovalarda; yöneticinin okuyabilmesi gerekiyor.
drop policy if exists "yönetici kanıt kovasını okur" on storage.objects;
create policy "yönetici kanıt kovasını okur"
  on storage.objects for select to authenticated
  using (bucket_id = 'dispute-evidence' and public.is_admin());

drop policy if exists "yönetici ilan kovasını okur" on storage.objects;
create policy "yönetici ilan kovasını okur"
  on storage.objects for select to authenticated
  using (bucket_id = 'listing-photos' and public.is_admin());

-- ============================ 4) MODERASYON KUYRUĞU ============================

create or replace function public.admin_photo_queue(p_limit integer default 50)
returns table (
  photo_id     uuid,
  product_id   text,
  product_title text,
  slot         public.photo_slot,
  storage_path text,
  bekleme_saati numeric,
  seller_id    uuid
)
language sql stable security definer set search_path = public as $$
  select f.id, p.id, p.title, f.slot, f.storage_path,
         round(extract(epoch from (now() - f.created_at)) / 3600.0, 1),
         p.seller_id
    from public.product_photos f
    join public.products p on p.id = f.product_id
   where public.is_admin()
     and f.moderation_status = 'pending'
     and p.status = 'DRAFT'
   order by f.created_at
   limit greatest(p_limit, 1);
$$;

revoke all on function public.admin_photo_queue(integer) from public;
grant execute on function public.admin_photo_queue(integer) to authenticated;
grant execute on function public.admin_photo_queue(integer) to service_role;

-- Yöneticinin kare kararı. photo-check'in yapay zekâ kararıyla aynı alanlara
-- yazar; fark, kararın kimden geldiğinin denetim kaydında durmasıdır.
create or replace function public.admin_moderate_photo(
  p_photo_id uuid,
  p_uygun    boolean,
  p_gerekce  text default null
)
returns public.product_photos
language plpgsql security definer set search_path = public as $$
declare f public.product_photos;
begin
  if not public.is_admin() then
    raise exception 'bu işlem için yönetici yetkisi gerekir';
  end if;
  if not p_uygun and (p_gerekce is null or btrim(p_gerekce) = '') then
    -- Reddedilen kare kullanıcıya gerekçesiyle döner; gerekçesiz ret,
    -- kullanıcının neyi düzelteceğini bilmemesi demektir.
    raise exception 'ret gerekçesi zorunludur';
  end if;

  update public.product_photos
     set moderation_status = case when p_uygun then 'approved' else 'rejected' end,
         moderation_reason = case when p_uygun then null else btrim(p_gerekce) end
   where id = p_photo_id
  returning * into f;

  if not found then
    raise exception 'kare bulunamadı';
  end if;

  perform public.audit(
    case when p_uygun then 'photo.approve' else 'photo.reject' end,
    'photo:' || p_photo_id::text,
    jsonb_build_object('slot', f.slot, 'product_id', f.product_id, 'gerekce', p_gerekce));

  return f;
end; $$;

revoke all on function public.admin_moderate_photo(uuid, boolean, text) from public;
grant execute on function public.admin_moderate_photo(uuid, boolean, text) to authenticated;
grant execute on function public.admin_moderate_photo(uuid, boolean, text) to service_role;

-- ============================ 5) İTİRAZ KUYRUĞU ============================

create or replace function public.admin_dispute_queue(p_limit integer default 50)
returns table (
  dispute_id    uuid,
  trade_id      uuid,
  dispute_status text,
  reason        text,
  product_title text,
  points        integer,
  esigin_ustunde boolean,
  kanit_sayisi  bigint,
  bekleme_saati numeric,
  deadline_at   timestamptz
)
language sql stable security definer set search_path = public as $$
  select d.id, t.id, d.status, d.reason, p.title, t.points,
         t.points >= (select return_threshold_points from public.dispute_policy where id),
         (select count(*) from public.dispute_evidence e where e.dispute_id = d.id),
         round(extract(epoch from (now() - d.created_at)) / 3600.0, 1),
         d.deadline_at
    from public.disputes d
    join public.trades t   on t.id = d.trade_id
    left join public.products p on p.id = t.product_id
   where public.is_admin()
     and d.status in ('OPEN','NEEDS_EVIDENCE')
   order by d.created_at
   limit greatest(p_limit, 1);
$$;

revoke all on function public.admin_dispute_queue(integer) from public;
grant execute on function public.admin_dispute_queue(integer) to authenticated;
grant execute on function public.admin_dispute_queue(integer) to service_role;

-- Yöneticinin itiraz kararı. Asıl mantık resolve_dispute'ta kalır; buradaki
-- katman yalnızca yetkiyi doğrular, kararı verenin kim olduğunu geçirir ve
-- denetim kaydını yazar. İki ayrı yerde iade mantığı bulundurmuyoruz.
create or replace function public.admin_resolve_dispute(
  p_dispute_id    uuid,
  p_kabul         boolean,
  p_not           text,
  p_kargo_hasari  boolean default false,
  p_iade_kargo_tl numeric default null
)
returns public.disputes
language plpgsql security definer set search_path = public as $$
declare d public.disputes;
begin
  if not public.is_admin() then
    raise exception 'bu işlem için yönetici yetkisi gerekir';
  end if;
  if p_not is null or btrim(p_not) = '' then
    -- Gerekçesiz karar denetlenemez. 5.5 gerekçenin kayda yazılmasını istiyor.
    raise exception 'karar gerekçesi zorunludur';
  end if;

  d := public.resolve_dispute(p_dispute_id, p_kabul, btrim(p_not),
                              p_kargo_hasari, p_iade_kargo_tl, auth.uid());

  perform public.audit(
    case when p_kabul then 'dispute.accept' else 'dispute.reject' end,
    'dispute:' || p_dispute_id::text,
    jsonb_build_object('resolution', d.resolution, 'trade_id', d.trade_id,
                       'kargo_hasari', p_kargo_hasari, 'iade_kargo_tl', p_iade_kargo_tl,
                       'not', btrim(p_not)));

  return d;
end; $$;

revoke all on function public.admin_resolve_dispute(uuid, boolean, text, boolean, numeric) from public;
grant execute on function public.admin_resolve_dispute(uuid, boolean, text, boolean, numeric)
  to authenticated;
grant execute on function public.admin_resolve_dispute(uuid, boolean, text, boolean, numeric)
  to service_role;

-- ============================ 6) İMZALI BAĞLANTI YARDIMCISI ============================
-- Kuyruk yalnızca depolama yolunu döner. Görseli göstermek için imzalı bağlantı
-- gerekiyor; istemci bunu supabase.storage üzerinden kendi üretir, çünkü
-- yönetici için kova okuma politikası yukarıda açıldı.
