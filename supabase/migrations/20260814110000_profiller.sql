-- Kullanıcı profili — ad, konum, hakkında
--
-- `app/edit-profile.tsx` bugüne kadar bir maketti: alanlar sabit metinle
-- ("Emrah Atabek", "Kadıköy, İstanbul") doluyordu ve "Kaydet" yalnızca
-- `router.back()` çağırıyordu. Ekran kaydettiğini söylüyor, hiçbir şey
-- kaydetmiyordu — kusurun en kötü türü, çünkü kullanıcı yanlış bir şey
-- öğrenmiyor, doğru bir şey öğrendiğini sanıyor.
--
-- Somut bedeli ilk canlı ilanda görüldü: `create_listing`, profilde ad
-- bulamayınca `seller_name`'i `split_part(email, '@', 1)` ile dolduruyor.
-- İlan vitrine "emrahatabek" adıyla düştü — yani kişinin e-posta adresinin
-- yarısı, arama motorlarına açık bir sayfada.
--
-- ## seller_name neden ayrıca güncelleniyor
--
-- `products.seller_name` bir kopya: ilan yazıldığı anda dondurulur, sonra
-- profilden bağımsız yaşar. Kopyanın olması doğru — ilan kartı her açılışta
-- profil tablosuna gitmemeli, ve satıcı adını sonradan değiştirse bile eski
-- takasların kaydı o günkü adı taşımalı.
--
-- Ama kullanıcının **kendi** ilanları için kopya güncellenmezse ad sonsuza
-- kadar kayar: profilde "Emrah Atabek" yazar, vitrinde "emrahatabek" durur.
-- Bu yüzden `update_profile` kendi ilanlarının kopyasını da tazeliyor.
--
-- ## auth.users neden buradan yazılmıyor
--
-- `create_listing` adı `auth.users.raw_user_meta_data`'dan okuyor ve o tablo
-- `supabase_auth_admin`'e ait. Oraya SQL'den uzanmak yerine istemci resmî
-- yolu kullanıyor: `supabase.auth.updateUser({ data: { full_name } })`.
-- Yani kayıt iki adım — GoTrue metadata'yı yazar, bu RPC profili ve ilan
-- kopyalarını yazar. Metadata tek gerçek kaynak olarak kalır.

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  city       text,
  bio        text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "kendi profilini gör"      on public.profiles;
drop policy if exists "kendi profilini oluştur"  on public.profiles;
drop policy if exists "kendi profilini güncelle" on public.profiles;

-- Profil yalnızca sahibinindir. Vitrin bu tabloyu hiç okumuyor — satıcı adı
-- `products.seller_name` üzerinden geliyor — o yüzden herkese açık bir okuma
-- politikasına gerek yok, olmasın.
create policy "kendi profilini gör"
  on public.profiles for select to authenticated using (user_id = auth.uid());

create policy "kendi profilini oluştur"
  on public.profiles for insert to authenticated with check (user_id = auth.uid());

create policy "kendi profilini güncelle"
  on public.profiles for update to authenticated using (user_id = auth.uid());

-- ============================ update_profile ============================

create or replace function public.update_profile(
  p_full_name text,
  p_city      text default null,
  p_bio       text default null
)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  kim uuid := auth.uid();
  ad  text;
  bas text;
  p   public.profiles;
begin
  if kim is null then raise exception 'oturum açmalısınız'; end if;

  ad := nullif(btrim(coalesce(p_full_name, '')), '');
  if ad is not null and length(ad) > 60 then
    raise exception 'ad en fazla 60 karakter olabilir';
  end if;

  insert into public.profiles (user_id, full_name, city, bio, updated_at)
  values (kim, ad, nullif(btrim(coalesce(p_city, '')), ''), nullif(btrim(coalesce(p_bio, '')), ''), now())
  on conflict (user_id) do update
     set full_name  = excluded.full_name,
         city       = excluded.city,
         bio        = excluded.bio,
         updated_at = now()
  returning * into p;

  -- Kendi ilanlarındaki kopyayı tazele. Ad boşaltıldıysa dokunmuyoruz:
  -- `create_listing`in e-posta türevine geri düşmek, duran bir addan kötüdür.
  if ad is not null then
    bas := upper(left(ad, 1)) ||
           upper(coalesce(nullif(left(split_part(ad, ' ', 2), 1), ''), left(ad, 1)));

    perform set_config('kt.bypass_product_guard', 'on', true);
    update public.products
       set seller_name = ad, seller_initials = bas
     where seller_id = kim
       and (seller_name is distinct from ad or seller_initials is distinct from bas);
    perform set_config('kt.bypass_product_guard', 'off', true);
  end if;

  return p;
end; $$;

revoke execute on function public.update_profile(text, text, text) from public, anon;
grant execute on function public.update_profile(text, text, text) to authenticated;

-- ============================ Vitrin tazeleme ============================
--
-- Satıcı adı vitrin kartında görünüyor; değiştiğinde site de tazelenmeli.
-- Trigger daha önce yalnızca başlık, puan, kategori, kapak ve konumu
-- izliyordu — ad değişikliği sessizce sitede eski hâliyle kalırdı.

create or replace function public.products_vitrin_tetikle()
returns trigger
language plpgsql security definer set search_path = public as $$
declare eski text; yeni text;
begin
  eski := case when tg_op = 'INSERT' then null else old.status end;
  yeni := case when tg_op = 'DELETE' then null else new.status end;

  if eski is distinct from yeni and ('ACTIVE' in (coalesce(eski, ''), coalesce(yeni, ''))) then
    perform public.vitrin_tazele(
      format('%s: %s → %s', coalesce(new.id, old.id), coalesce(eski, '(yeni)'), coalesce(yeni, '(silindi)')));
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' and new.status = 'ACTIVE' and (
       new.title        is distinct from old.title or
       new.points       is distinct from old.points or
       new.category     is distinct from old.category or
       new.sub_category is distinct from old.sub_category or
       new.image_key    is distinct from old.image_key or
       new.location     is distinct from old.location or
       new.seller_name  is distinct from old.seller_name) then
    perform public.vitrin_tazele(format('%s: alan değişti', new.id));
  end if;

  return coalesce(new, old);
end; $$;

revoke execute on function public.products_vitrin_tetikle() from public, anon, authenticated;
