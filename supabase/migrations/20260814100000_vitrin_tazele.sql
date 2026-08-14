-- Vitrin tazeleme — yayındaki ilan değişince pazarlama sitesi yeniden derlenir
--
-- Pazarlama sitesi (blaixs-max/Takas-site) veri tabanına bağlanmaz; vitrini
-- derleme anında çekilen bir anlık görüntüden okur. Anlık görüntü de doğal
-- olarak son derlemenin yaşındadır. Bu göç aradaki farkı kapatıyor: ilan
-- yayına girdiğinde Vercel'in deploy hook'u tetikleniyor, site ~1 dakikada
-- yenileniyor.
--
-- ## Neden yalnızca "yayına girdi" yetmiyor
--
-- Vitrin ACTIVE ilanları gösteriyor. Yani listeyi değiştiren her geçiş önemli:
--
--   DRAFT    → ACTIVE    ilan vitrine girdi
--   ACTIVE   → RESERVED  biri takas başlattı, ilan vitrinden düşmeli
--   ACTIVE   → SOLD      satıldı, düşmeli
--   ACTIVE   → REMOVED   kaldırıldı, düşmeli
--   RESERVED → ACTIVE    takas iptal oldu, geri döndü
--
-- Yalnızca girişi dinleseydik satılan ilan vitrinde asılı kalırdı — ziyaretçi
-- tıklar, uygulamada bulamaz. Çıkış girişten daha önemli.
--
-- ## Neden bir gecikme sayacı var
--
-- Her tetikleme bir derleme demek. Yayına alma anında `publish_listing()`
-- ürünü bir kez güncelliyor ama başka trigger'lar (kampanya, bildirim) aynı
-- işlemde ek güncellemeler yapabiliyor; art arda beş derleme başlatmanın
-- kimseye faydası yok. Son tetiklemeden bu yana 60 saniye geçmediyse
-- atlanıyor. Derleme ~15 saniye sürdüğü için 60 saniye hem israfı kesiyor
-- hem gecikmeyi hissettirmiyor.
--
-- ## Neden pg_net
--
-- `net.http_post` isteği kuyruğa alıp döner; işlemi bekletmez. Senkron bir
-- çağrı olsaydı Vercel yavaşladığında ilan yayına alma da yavaşlardı —
-- pazarlama sitesinin derleme kuyruğu, satıcının ilan vermesini bekletmemeli.

create extension if not exists pg_net with schema extensions;

-- ============================ 1) Ayar tablosu ============================
--
-- Deploy hook URL'si bir yetki bağlantısıdır: eline geçen herkes derleme
-- tetikleyebilir. Tabloda RLS açık ve **hiç politika yok** — yani anon ve
-- authenticated hiçbir satır göremez. Yetkiler ayrıca açıkça geri alınıyor;
-- RLS'e güvenip grant bırakmak, ileride bir politika eklenirse kapıyı
-- sessizce açardı.

create table if not exists public.site_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;
revoke all on public.site_settings from public, anon, authenticated;

comment on table public.site_settings is
  'Sunucu tarafı ayarlar. İstemciye kapalı — deploy hook gibi yetki bağlantıları burada.';

-- Deploy hook URL'si BU DOSYAYA YAZILMAZ.
--
-- Bu repo herkese açık (github.com/blaixs-max/Takas-WebSite, public). URL bir
-- yetki bağlantısıdır: eline geçen herkes istediği kadar derleme tetikleyebilir.
-- Anon anahtarını repoda tutmak sorun değil — RLS koruyor ve zaten uygulama
-- paketine gömülü — ama bunu koruyan bir katman yok, URL'nin kendisi yetkinin
-- ta kendisi.
--
-- Değer canlıya elle yazıldı (2026-08-14). Sıfırdan kurulan bir veri tabanında
-- göç sessizce çalışır, `vitrin_tazele()` "deploy hook tanımlı değil" döner ve
-- hiçbir şey kırılmaz; değeri koymak kurulumun ayrı bir adımıdır:
--
--   insert into public.site_settings (key, value)
--   values ('vitrin_deploy_hook', '<Vercel > Settings > Git > Deploy Hooks>')
--   on conflict (key) do update set value = excluded.value, updated_at = now();
--
-- Sızarsa: Vercel'den Revoke, yenisini üret, yukarıdaki satırı yeni URL ile koş.

-- ============================ 2) Tazeleme çağrısı ============================
--
-- Trigger'dan ayrı bir fonksiyon: elle de çağrılabilsin. Kurulumu doğrulamanın
-- ve ileride "site takıldı" dendiğinde tek satırla tazelemenin yolu bu.

create or replace function public.vitrin_tazele(p_neden text default 'elle')
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  hook   text;
  son    timestamptz;
  gecen  numeric;
begin
  select value into hook from public.site_settings where key = 'vitrin_deploy_hook';
  if hook is null or btrim(hook) = '' then
    return 'atlandı: deploy hook tanımlı değil';
  end if;

  select updated_at into son from public.site_settings where key = 'vitrin_son_tetik';
  if son is not null then
    gecen := extract(epoch from (now() - son));
    if gecen < 60 then
      return format('atlandı: %s saniye önce tetiklendi', round(gecen));
    end if;
  end if;

  perform net.http_post(
    url     := hook,
    body    := jsonb_build_object('neden', p_neden),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  insert into public.site_settings (key, value, updated_at)
  values ('vitrin_son_tetik', p_neden, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();

  return format('tetiklendi: %s', p_neden);
end; $$;

revoke execute on function public.vitrin_tazele(text) from public, anon, authenticated;

-- ============================ 3) Trigger ============================
--
-- Yalnızca vitrinin gördüğü şey değiştiğinde ateşliyor. `products` tablosu
-- takas akışı boyunca çok kez güncelleniyor (rezervasyon damgaları, puan
-- kilidi, kapak anahtarı); hepsine derleme başlatmak anlamsız olurdu.

create or replace function public.products_vitrin_tetikle()
returns trigger
language plpgsql security definer set search_path = public as $$
declare eski text; yeni text;
begin
  eski := case when tg_op = 'INSERT' then null else old.status end;
  yeni := case when tg_op = 'DELETE' then null else new.status end;

  -- Vitrin ACTIVE listesini gösteriyor: listeye giren ya da listeden çıkan
  -- her geçiş tazeleme gerektirir. İkisi de ACTIVE değilse vitrin değişmedi.
  if eski is distinct from yeni and ('ACTIVE' in (coalesce(eski, ''), coalesce(yeni, ''))) then
    perform public.vitrin_tazele(
      format('%s: %s → %s', coalesce(new.id, old.id), coalesce(eski, '(yeni)'), coalesce(yeni, '(silindi)')));
    return coalesce(new, old);
  end if;

  -- Yayındaki bir ilanın vitrinde görünen alanı değiştiyse de tazelenir.
  if tg_op = 'UPDATE' and new.status = 'ACTIVE' and (
       new.title        is distinct from old.title or
       new.points       is distinct from old.points or
       new.category     is distinct from old.category or
       new.sub_category is distinct from old.sub_category or
       new.image_key    is distinct from old.image_key or
       new.location     is distinct from old.location) then
    perform public.vitrin_tazele(format('%s: alan değişti', new.id));
  end if;

  return coalesce(new, old);
end; $$;

revoke execute on function public.products_vitrin_tetikle() from public, anon, authenticated;

drop trigger if exists products_vitrin_tazele on public.products;

-- AFTER: tazeleme kararı, işlem gerçekten yazıldıktan sonra verilmeli.
-- BEFORE olsaydı geri alınan bir işlem de derleme başlatırdı.
create trigger products_vitrin_tazele
  after insert or update or delete on public.products
  for each row execute function public.products_vitrin_tetikle();
