-- ============================================================================
-- Yerel test iskelesi — Supabase'in sağladığı ama düz Postgres'te olmayan her şey
-- ============================================================================
--
-- Göçler ve testler Supabase'e özgü birkaç şeye dayanıyor: `auth` şeması,
-- `auth.uid()`, `storage` tabloları, `cron.schedule`, ve `anon` /
-- `authenticated` / `service_role` rolleri. Düz bir Postgres'te bunların
-- hiçbiri yok.
--
-- Bu dosya onları taklit ediyor. **Göçlerden ÖNCE** çalıştırılır:
--
--   createdb kt
--   psql -d kt -f supabase/tests/00_yerel_kurulum.sql
--   for f in supabase/migrations/*.sql; do psql -d kt -v ON_ERROR_STOP=1 -f "$f"; done
--   for f in supabase/tests/*_test.sql; do psql -d kt -v ON_ERROR_STOP=1 -f "$f"; done
--
-- ## İki ayrıntı önemli
--
-- **`auth.uid()` `test.uid`'i okuyor.** Testler kimliği
-- `set_config('test.uid', ...)` ile veriyor; gerçek Supabase'de aynı işi JWT
-- yapıyor. İmza aynı olduğu için göçlerin hiçbiri değişmiyor.
--
-- **Varsayılan yetkiler göçlerden önce kuruluyor.** Supabase kurulumu
-- `alter default privileges ... grant all on tables to anon, authenticated`
-- diyor ve bizim `yetki_daraltma` göçümüz tam olarak bunu geri almak için
-- yazıldı. İskele bunu kurmazsa göç geri alacak bir şey bulamaz ve test,
-- üretimdekinden farklı bir dünyada koşar — yani hiçbir şey kanıtlamaz.
-- ============================================================================

create extension if not exists pgcrypto;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists cron;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon')
    then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated')
    then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role')
    then create role service_role nologin bypassrls; end if;
end $$;

grant usage on schema public, auth, storage to anon, authenticated, service_role;

-- Supabase'in varsayılanı. Göçlerden önce kurulmalı — gerekçesi yukarıda.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;

-- ------------------------------------------------------------------ auth

create table if not exists auth.users (
  id                  uuid primary key,
  email               text,
  phone               text,
  email_confirmed_at  timestamptz,
  phone_confirmed_at  timestamptz,
  confirmed_at        timestamptz,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

/* Gerçek Supabase'de JWT'den okur; burada testin kurduğu `test.uid`'den.
   İmza aynı olduğu için göç dosyalarında tek satır bile değişmiyor. */
create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid
$$;

create or replace function auth.role()
returns text language sql stable as $$
  select coalesce(nullif(current_setting('test.role', true), ''), current_user)
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;

-- --------------------------------------------------------------- storage

create table if not exists storage.buckets (
  id                 text primary key,
  name               text,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets(id),
  name       text,
  owner      uuid,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(n text)
returns text[] language sql immutable as $$
  select string_to_array(n, '/')
$$;

grant select, insert, update, delete on storage.objects to authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;

-- ------------------------------------------------------------------ cron

create table if not exists cron.job (
  jobid    bigserial primary key,
  jobname  text,
  schedule text,
  command  text,
  active   boolean not null default true
);

/* Gerçek pg_cron gibi kaydeder ama hiçbir şey zamanlamaz: testler cron
   fonksiyonlarını doğrudan çağırıyor, zamanlayıcıya ihtiyaç yok. */
create or replace function cron.schedule(p_ad text, p_zaman text, p_komut text)
returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command)
  values (p_ad, p_zaman, p_komut)
  returning jobid
$$;

create or replace function cron.unschedule(p_ad text)
returns boolean language sql as $$
  delete from cron.job where jobname = p_ad returning true
$$;
