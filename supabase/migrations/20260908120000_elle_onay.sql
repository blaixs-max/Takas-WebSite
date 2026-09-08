/**
 * ELLE ONAY VE SATICI KARGOSU — 2026-09-08 kurgusu
 *
 * Plan: `docs/plan-elle-onay-2026-09.md`. Bu göç planın "Tur 1"i: arka ucun
 * tamamı. Üç kararı koda çeviriyor ve dördüncüsünü tersine döndürüyor:
 *
 *   1. İlan yayına **yönetici** alır, yapay zekâ değil. Yeni durum
 *      `IN_REVIEW`: satıcı "Onaya gönder" der, yönetici kareleri ve metni
 *      görür, sıfır fiyatını girer (formül puanı hesaplar, isterse elle
 *      yazar), onaylar ya da gerekçeyle reddeder.
 *   2. Alıcı TL ödemez, **satıcı kendi kargosunu öder.** Puan havuza girer,
 *      satıcı 4 gün içinde kargo firması + takip numarası girer, alıcı 7 gün
 *      içinde onaylar ya da itiraz eder. Süreler dolarsa otomatik: 4 gün →
 *      iade, 7 gün → aktarım.
 *   3. Satıcı alıcının **teslimat adresini** görür — bugüne kadar hiçbir
 *      kullanıcı başka birinin adresini görmüyordu. Adres takas anında
 *      kopyalanır (`trades.teslimat`), alıcı sonradan adres defterini
 *      değiştirse de gönderi doğru yere gider. Kargodan önce iptal olan
 *      takasta kopya silinir: satıcının hiç ihtiyaç duymadığı bir adresi
 *      tutmak için sebep yok.
 *   4. `photo-check`, `listing-value`, `avatar-check` ve kargo ödemesi
 *      **emekli.** Tetikleyicileri ve sunucu tarafı yardımcıları burada
 *      kalkıyor; Edge Function'lar Tur 3'te repodan silinip Supabase'den
 *      kaldırılıyor.
 *
 * ## Dokunulmayanlar
 *
 * Güvenli havuz defteri (`hold/release/refund_points`), itiraz akışı,
 * kampanya, sepet/rezervasyon, formül (`puan_orani`, `puan_hesapla`,
 * `valuation_settings`, 50 taban), RLS sınırları, yönetici yetkisi
 * (`admins` tablosu). Yayındaki 8 ilan olduğu gibi kalıyor
 * (`degerleme_kaynak = 'gemini'` tarihsel kayıt).
 *
 * ## Neden tek dosya
 *
 * Bu değişiklikler birbirine bağlı: `IN_REVIEW` olmadan onay RPC'si
 * anlamsız, onay RPC'si olmadan yayın kapısı kapalı kalır, kapı
 * sadeleşmeden eski tetikleyiciler yeni akışı bozar. Yarısı uygulanmış bir
 * hâli yok; ya hepsi ya hiçbiri.
 */

-- ============================================================================
-- 1) İLAN: IN_REVIEW DURUMU VE İNCELEME ALANLARI
-- ============================================================================

alter table public.products drop constraint if exists products_status_check;
alter table public.products add constraint products_status_check
  check (status in ('DRAFT','IN_REVIEW','ACTIVE','RESERVED','SOLD','REMOVED'));

alter table public.products
  add column if not exists submitted_at  timestamptz,
  /* Son inceleme mesajı. Ret gerekçesi burada; satıcı taslakta okur. */
  add column if not exists review_reason text,
  add column if not exists reviewed_by   uuid,
  add column if not exists reviewed_at   timestamptz;

/* Kuyruk sorgusu en eskiyi üste alıyor; kısmi indeks yalnızca bekleyenleri
   tutar. */
create index if not exists products_in_review_idx
  on public.products (submitted_at)
  where status = 'IN_REVIEW';

-- ============================================================================
-- 2) YAPAY ZEKÂ KANCALARI KALKIYOR
-- ============================================================================
-- Sıra önemli: önce tetikleyiciler, sonra fonksiyonlar. Tersi "function is
-- still referenced" ile düşer.

drop trigger if exists product_photos_karar_sonrasi on public.product_photos;
drop function if exists public.product_photos_karar_sonrasi();

drop trigger if exists products_degerleme_sonrasi on public.products;
drop function if exists public.products_degerleme_sonrasi();

drop function if exists public.ilan_otomatik_yayina_al(text);
drop function if exists public.puan_bandi_disinda(integer);
drop function if exists public.degerleme_yaz(text, numeric, text, numeric, text, numeric, boolean, text);
drop function if exists public.foto_denetim_kaydet(uuid, uuid, text, text, text, boolean, integer, integer, integer, text);

/* `publish_listing` satıcının kapısıydı. Artık satıcı yayına almaz; eski bir
   istemci çağırırsa ne yapacağını söyleyen bir cevap alır. Fonksiyon
   silinmiyor: adı istemcide geçiyor, "function does not exist" kullanıcıya
   hiçbir şey anlatmaz. */
create or replace function public.publish_listing(
  p_product_id text,
  p_cover_slot public.photo_slot default 'front'
)
returns products
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  raise exception 'ilanlar artık yönetici onayıyla yayına girer; submit_listing() ile onaya gönderin';
end; $function$;
revoke all on function public.publish_listing(text, public.photo_slot) from public, anon, authenticated;

/* Satıcı kendi puanını yazamaz: puanı yönetici belirliyor. Bu RPC modelin
   önerdiği puanın ALTINA inmek için vardı; öneri kalmadı. */
revoke all on function public.set_product_points(text, integer) from public, anon, authenticated;

-- ============================================================================
-- 3) YAYIN KAPISI SADELEŞİYOR
-- ============================================================================
-- Kalanlar fiziksel gerçekler: alt kategori, zorunlu kareler, reddedilen ya da
-- bekleyen kare olmaması, kapak. Kalkanlar modelin kararlarıydı:
-- `degerleme_at`, `metin_uygun`, `puan_bandi_disinda`. Puanın varlığı kalıyor
-- — yönetici puan yazmadan onaylayamaz, kapı bunu ikinci kez doğruluyor.

create or replace function public.ilan_yayina_al(
  p_product_id text,
  p_cover_slot public.photo_slot default 'front'
)
returns products
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  p          public.products;
  gerekli    public.photo_slot[];
  eksik      public.photo_slot[];
  bekleyen   int;
  reddedilen int;
  kapak      text;
begin
  select * into p from public.products where id = p_product_id for update;
  if not found then raise exception 'ilan % bulunamadı', p_product_id; end if;
  if p.status <> 'IN_REVIEW' then
    raise exception 'yalnızca incelemedeki ilan yayına alınır (mevcut: %)', p.status;
  end if;
  if p.sub_category is null then
    raise exception 'alt kategori seçilmeden ilan yayına alınamaz';
  end if;

  gerekli := public.required_slots(p_product_id);
  select array_agg(s) into eksik
    from unnest(gerekli) s
   where not exists (select 1 from public.product_photos ph
                      where ph.product_id = p_product_id and ph.slot = s);
  if eksik is not null then
    raise exception 'eksik kare: %', array_to_string(eksik, ', ');
  end if;

  /* Zorunsuz slottaki reddedilen kare yayını durdurmaz, silinir. */
  delete from public.product_photos ph
   where ph.product_id = p_product_id
     and ph.moderation_status = 'rejected'
     and not (ph.slot = any (gerekli));

  select count(*) filter (where moderation_status = 'rejected'),
         count(*) filter (where moderation_status = 'pending')
    into reddedilen, bekleyen
    from public.product_photos where product_id = p_product_id;
  if reddedilen > 0 then
    raise exception 'reddedilen kare var; ilanı onaylamak yerine reddedin ki satıcı yeniden çeksin';
  end if;
  if bekleyen > 0 then
    raise exception 'bekleyen kare var; onay akışı kareleri onaylamadan buraya gelmemeli';
  end if;

  if p.points is null then
    raise exception 'puanı belirlenmemiş ilan yayına alınamaz';
  end if;

  select ph.storage_path into kapak
    from public.product_photos ph
   where ph.product_id = p_product_id and ph.slot = p_cover_slot;
  if kapak is null then
    raise exception 'kapak olarak seçilen kare yok: %', p_cover_slot;
  end if;

  update public.product_photos set is_cover = false where product_id = p_product_id;
  update public.product_photos set is_cover = true
   where product_id = p_product_id and slot = p_cover_slot;

  perform set_config('kt.bypass_product_guard', 'on', true);
  update public.products
     set status    = 'ACTIVE',
         image_key = kapak
   where id = p_product_id
  returning * into p;
  perform set_config('kt.bypass_product_guard', 'off', true);

  return p;
end; $function$;
revoke all on function public.ilan_yayina_al(text, public.photo_slot) from public, anon, authenticated;

-- ============================================================================
-- 4) SATICI: ONAYA GÖNDER / GERİ ÇEK
-- ============================================================================

/**
 * Satıcı ilanı incelemeye gönderir.
 *
 * Kontroller fiziksel: sahiplik, taslak, alt kategori, zorunlu karelerin
 * yüklü olması, reddedilmiş zorunlu kare olmaması. Kalitesine karar vermek
 * yöneticinin işi; burada kalite kontrolü yok.
 *
 * Gönderilen ilan düzenlenemez ve kareleri değiştirilemez — RLS politikaları
 * `status = 'DRAFT'` şartını taşıyor, `update_listing` de yalnızca DRAFT/ACTIVE
 * kabul ediyor. Satıcı bir şey değiştirmek isterse önce geri çeker.
 */
create or replace function public.submit_listing(p_product_id text)
returns products
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  p        public.products;
  gerekli  public.photo_slot[];
  eksik    public.photo_slot[];
  reddedilen public.photo_slot[];
begin
  if auth.uid() is null then raise exception 'oturum açmalısınız'; end if;

  select * into p from public.products where id = p_product_id for update;
  if not found then raise exception 'ilan bulunamadı'; end if;
  if p.seller_id is distinct from auth.uid() then
    raise exception 'yalnızca ilan sahibi onaya gönderebilir';
  end if;
  if p.status = 'IN_REVIEW' then
    return p;                                  -- idempotent: çift dokunuş
  end if;
  if p.status <> 'DRAFT' then
    raise exception 'yalnızca taslak ilan onaya gönderilir (mevcut: %)', p.status;
  end if;
  if p.sub_category is null then
    raise exception 'alt kategori seçilmeden ilan onaya gönderilemez';
  end if;

  gerekli := public.required_slots(p_product_id);
  select array_agg(s) into eksik
    from unnest(gerekli) s
   where not exists (select 1 from public.product_photos ph
                      where ph.product_id = p_product_id and ph.slot = s);
  if eksik is not null then
    raise exception 'eksik kare: %', array_to_string(eksik, ', ');
  end if;

  select array_agg(ph.slot) into reddedilen
    from public.product_photos ph
   where ph.product_id = p_product_id
     and ph.moderation_status = 'rejected'
     and ph.slot = any (gerekli);
  if reddedilen is not null then
    raise exception 'reddedilen kare yeniden çekilmeli: %', array_to_string(reddedilen, ', ');
  end if;

  perform set_config('kt.bypass_product_guard', 'on', true);
  update public.products
     set status        = 'IN_REVIEW',
         submitted_at  = now(),
         review_reason = null
   where id = p_product_id
  returning * into p;
  perform set_config('kt.bypass_product_guard', 'off', true);

  perform public.audit('listing.submit', 'product:' || p_product_id, '{}'::jsonb);
  return p;
end; $function$;
revoke all on function public.submit_listing(text) from public, anon;
grant execute on function public.submit_listing(text) to authenticated;

/** Satıcı incelemedeki ilanı taslağa geri çeker. */
create or replace function public.withdraw_listing(p_product_id text)
returns products
language plpgsql
security definer
set search_path to 'public'
as $function$
declare p public.products;
begin
  if auth.uid() is null then raise exception 'oturum açmalısınız'; end if;

  select * into p from public.products where id = p_product_id for update;
  if not found then raise exception 'ilan bulunamadı'; end if;
  if p.seller_id is distinct from auth.uid() then
    raise exception 'yalnızca ilan sahibi geri çekebilir';
  end if;
  if p.status = 'DRAFT' then
    return p;
  end if;
  if p.status <> 'IN_REVIEW' then
    raise exception 'yalnızca incelemedeki ilan geri çekilir (mevcut: %)', p.status;
  end if;

  perform set_config('kt.bypass_product_guard', 'on', true);
  update public.products
     set status = 'DRAFT', submitted_at = null
   where id = p_product_id
  returning * into p;
  perform set_config('kt.bypass_product_guard', 'off', true);

  perform public.audit('listing.withdraw', 'product:' || p_product_id, '{}'::jsonb);
  return p;
end; $function$;
revoke all on function public.withdraw_listing(text) from public, anon;
grant execute on function public.withdraw_listing(text) to authenticated;

-- ============================================================================
-- 5) YÖNETİCİ: KUYRUK, PUAN ÖNİZLEME, ONAY, RET
-- ============================================================================

/**
 * İnceleme kuyruğu — en eski en üstte.
 *
 * Kareler tek bir jsonb dizisinde geliyor: panel her ilan için ayrı sorgu
 * atmasın. Yol dönüyor, bağlantı değil; imzalı bağlantıyı istemci üretir ve
 * depolama politikası ("yönetici ilan kovasını okur") zaten izin veriyor.
 */
create or replace function public.admin_review_queue(p_limit integer default 50)
returns table (
  product_id     text,
  title          text,
  description    text,
  category       text,
  sub_category   text,
  condition      text,
  has_damage     boolean,
  is_set         boolean,
  size_class     text,
  location       text,
  seller_id      uuid,
  seller_name    text,
  submitted_at   timestamptz,
  bekleme_saati  numeric,
  sifir_fiyat    numeric,
  points         integer,
  kareler        jsonb
)
language sql stable security definer set search_path = public as $$
  select p.id, p.title, p.description, p.category, p.sub_category, p.condition,
         p.has_damage, p.is_set, p.size_class, p.location,
         p.seller_id, p.seller_name, p.submitted_at,
         round(extract(epoch from (now() - coalesce(p.submitted_at, p.created_at))) / 3600.0, 1),
         p.sifir_fiyat, p.points,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'photo_id', f.id, 'slot', f.slot, 'path', f.storage_path,
                    'status', f.moderation_status)
                  order by f.slot)
             from public.product_photos f where f.product_id = p.id
         ), '[]'::jsonb)
    from public.products p
   where public.is_admin()
     and p.status = 'IN_REVIEW'
   order by p.submitted_at nulls last, p.created_at
   limit greatest(p_limit, 1);
$$;
revoke all on function public.admin_review_queue(integer) from public, anon;
grant execute on function public.admin_review_queue(integer) to authenticated;

/** Panelin canlı önizlemesi: sıfır fiyatı → puan, sunucudaki formülle. */
create or replace function public.admin_puan_hesapla(
  p_sifir_fiyat numeric,
  p_condition   text,
  p_has_damage  boolean default false
)
returns integer
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'bu işlem için yönetici yetkisi gerekir';
  end if;
  return public.puan_hesapla(p_sifir_fiyat, p_condition, p_has_damage, 1.0);
end; $$;
revoke all on function public.admin_puan_hesapla(numeric, text, boolean) from public, anon;
grant execute on function public.admin_puan_hesapla(numeric, text, boolean) to authenticated;

/**
 * Onayın iç gövdesi — yetki kontrolü YOK, o yüzden kimseye açık değil.
 *
 * Ayrı durmasının sebebi test iskelesi: testler ilanı yayına almak için
 * bu yolu kullanıyor ve yönetici kimliği kurmaları gerekmiyor.
 * `admin_approve_listing` yetkiyi doğrulayıp buraya iniyor.
 *
 * Puan: `p_puan` verilmişse o (yönetici elle yazdı); yoksa
 * `puan_hesapla(sıfır fiyat, kondisyon, hasar)` — model çağının formülü,
 * katsayıları ve 50 tabanıyla aynen. İkisi de yoksa onay yok: puansız ilan
 * vitrine çıkamaz.
 *
 * `ai_suggested_points` sıfırlanıyor: `products_points_le_suggested` kısıtı
 * puanı modelin önerisinin altında tutuyordu. Öneri artık yok; eski bir
 * taslağın öneri değeri yöneticinin kararını kesmemeli.
 */
create or replace function public.ilan_onayla(
  p_product_id  text,
  p_sifir_fiyat numeric,
  p_puan        integer,
  p_cover_slot  public.photo_slot,
  p_reviewer    uuid
)
returns products
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  p     public.products;
  puan  integer;
  taban integer;
begin
  select * into p from public.products where id = p_product_id for update;
  if not found then raise exception 'ilan bulunamadı'; end if;
  if p.status <> 'IN_REVIEW' then
    raise exception 'yalnızca incelemedeki ilan onaylanır (mevcut: %)', p.status;
  end if;

  if p_puan is not null then
    if p_puan <= 0 then raise exception 'puan sıfırdan büyük olmalı'; end if;
    puan := p_puan;
  elsif p_sifir_fiyat is not null and p_sifir_fiyat > 0 then
    puan := public.puan_hesapla(p_sifir_fiyat, p.condition, p.has_damage, 1.0);
  else
    raise exception 'onay için sıfır fiyatı ya da puan gerekir';
  end if;

  select vs.taban_puan into taban from public.valuation_settings vs where vs.id = 1;

  /* Yönetici bakıp onayladı: bekleyen kareler onaylı sayılır. Reddedilen
     kare varsa kapı aşağıda durdurur — yönetici o durumda ilanı reddetmeli. */
  update public.product_photos
     set moderation_status = 'approved', moderation_reason = null
   where product_id = p_product_id and moderation_status = 'pending';

  perform set_config('kt.bypass_product_guard', 'on', true);
  update public.products
     set points              = puan,
         ai_suggested_points = null,
         sifir_fiyat         = p_sifir_fiyat,
         market_value        = case when p_sifir_fiyat is null then market_value
                                    else round(p_sifir_fiyat)::text end,
         degerleme_kaynak    = 'admin',
         degerleme_guven     = null,
         degerleme_model     = null,
         degerleme_at        = now(),
         taban_uygulandi     = (p_puan is null and taban is not null and puan = taban
                                and p_sifir_fiyat * public.puan_orani(p.condition, p.has_damage, 1.0) < taban),
         review_reason       = null,
         reviewed_by         = p_reviewer,
         reviewed_at         = now()
   where id = p_product_id;
  perform set_config('kt.bypass_product_guard', 'off', true);

  p := public.ilan_yayina_al(p_product_id, p_cover_slot);

  perform public.audit('listing.approve', 'product:' || p_product_id,
    jsonb_build_object('sifir_fiyat', p_sifir_fiyat, 'puan', puan, 'elle', p_puan is not null));
  return p;
end; $function$;
revoke all on function public.ilan_onayla(text, numeric, integer, public.photo_slot, uuid) from public, anon, authenticated;

/** Yönetici onayı: yetkiyi doğrular, iç gövdeye iner. */
create or replace function public.admin_approve_listing(
  p_product_id  text,
  p_sifir_fiyat numeric default null,
  p_puan        integer default null,
  p_cover_slot  public.photo_slot default 'front'
)
returns products
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'bu işlem için yönetici yetkisi gerekir';
  end if;
  return public.ilan_onayla(p_product_id, p_sifir_fiyat, p_puan, p_cover_slot, auth.uid());
end; $function$;
revoke all on function public.admin_approve_listing(text, numeric, integer, public.photo_slot) from public, anon;
grant execute on function public.admin_approve_listing(text, numeric, integer, public.photo_slot) to authenticated;

/**
 * Yönetici reddi: gerekçe zorunlu, ilan taslağa döner, satıcıya bildirim.
 *
 * Kareler silinmiyor. "Arka kare bulanık" denmişse satıcı yalnızca onu
 * yeniden çeker; yedisini birden silmek dürüst satıcıyı cezalandırır.
 * Güvenlik gerektiren bir kare (çocuk yüzü, müstehcen) için yönetici ayrıca
 * `admin_moderate_photo(id, false, gerekçe)` kullanır — o yol dosyayı siler.
 */
create or replace function public.admin_reject_listing(
  p_product_id text,
  p_gerekce    text
)
returns products
language plpgsql
security definer
set search_path to 'public'
as $function$
declare p public.products;
begin
  if not public.is_admin() then
    raise exception 'bu işlem için yönetici yetkisi gerekir';
  end if;
  if p_gerekce is null or btrim(p_gerekce) = '' then
    raise exception 'ret gerekçesi zorunludur';
  end if;

  select * into p from public.products where id = p_product_id for update;
  if not found then raise exception 'ilan bulunamadı'; end if;
  if p.status <> 'IN_REVIEW' then
    raise exception 'yalnızca incelemedeki ilan reddedilir (mevcut: %)', p.status;
  end if;

  perform set_config('kt.bypass_product_guard', 'on', true);
  update public.products
     set status        = 'DRAFT',
         submitted_at  = null,
         review_reason = btrim(p_gerekce),
         reviewed_by   = auth.uid(),
         reviewed_at   = now()
   where id = p_product_id
  returning * into p;
  perform set_config('kt.bypass_product_guard', 'off', true);

  perform public.notify(
    p.seller_id,
    'listing.rejected',
    'İlanın düzeltme istiyor',
    p.title || ' — ' || btrim(p_gerekce) || ' Düzeltip yeniden onaya gönderebilirsin.',
    jsonb_build_object('product', p.id, 'draft', true)
  );
  perform public.audit('listing.reject', 'product:' || p_product_id,
    jsonb_build_object('gerekce', btrim(p_gerekce)));
  return p;
end; $function$;
revoke all on function public.admin_reject_listing(text, text) from public, anon;
grant execute on function public.admin_reject_listing(text, text) to authenticated;

/* Yayın bildirimi ve kampanya hakkı IN_REVIEW → ACTIVE geçişinde doğar.
   İkisi de `old.status = 'DRAFT'` bekliyordu; o geçiş artık yok. */
create or replace function public.products_notify()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status = 'ACTIVE' and old.status in ('DRAFT','IN_REVIEW') then
    perform public.notify(new.seller_id, 'listing.published',
      'İlanın yayında',
      new.title || ' onaylandı, ' || new.points || ' puanla vitrinde görünüyor.',
      jsonb_build_object('product', new.id));
  end if;
  return new;
end; $function$;

create or replace function public.products_campaign_on_publish()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'ACTIVE' and old.status in ('DRAFT','IN_REVIEW') and new.seller_id is not null then
    -- Buraya yalnızca yönetici onayından geçen ilan gelir.
    perform public.grant_campaign_points(new.seller_id, 'FIRST_LISTING');
  end if;
  return new;
end; $$;

-- ============================================================================
-- 6) AVATAR: ELLE
-- ============================================================================

/** Bekleyen profil fotoğrafları. */
create or replace function public.admin_avatar_queue(p_limit integer default 50)
returns table (
  user_id      uuid,
  full_name    text,
  avatar_path  text,
  bekleme_saati numeric
)
language sql stable security definer set search_path = public as $$
  select pr.user_id, pr.full_name, pr.avatar_path,
         round(extract(epoch from (now() - pr.updated_at)) / 3600.0, 1)
    from public.profiles pr
   where public.is_admin()
     and pr.avatar_status = 'pending'
     and pr.avatar_path is not null
   order by pr.updated_at
   limit greatest(p_limit, 1);
$$;
revoke all on function public.admin_avatar_queue(integer) from public, anon;
grant execute on function public.admin_avatar_queue(integer) to authenticated;

/**
 * Avatar kararı. Reddedilenin dosyasını istemci siler; bu yüzden eski yol
 * dönüyor (`avatar_karar` ret anında yolu boşaltıyor, sonradan öğrenilemez).
 */
create or replace function public.admin_avatar_karar(
  p_user_id uuid,
  p_uygun   boolean,
  p_gerekce text default null
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare eski text;
begin
  if not public.is_admin() then
    raise exception 'bu işlem için yönetici yetkisi gerekir';
  end if;
  if not p_uygun and (p_gerekce is null or btrim(p_gerekce) = '') then
    raise exception 'ret gerekçesi zorunludur';
  end if;

  select pr.avatar_path into eski from public.profiles pr where pr.user_id = p_user_id;
  if eski is null then
    raise exception 'bekleyen avatar yok';
  end if;

  perform public.avatar_karar(p_user_id,
    case when p_uygun then 'approved' else 'rejected' end,
    case when p_uygun then null else btrim(p_gerekce) end);

  perform public.audit(
    case when p_uygun then 'avatar.approve' else 'avatar.reject' end,
    'user:' || p_user_id::text,
    jsonb_build_object('gerekce', p_gerekce));

  return eski;
end; $function$;
revoke all on function public.admin_avatar_karar(uuid, boolean, text) from public, anon;
grant execute on function public.admin_avatar_karar(uuid, boolean, text) to authenticated;

/* Yönetici bekleyen avatarı görebilmeli ve reddedilenin dosyasını
   silebilmeli. Okuma politikası `approved` şartı taşıyordu — yönetici için
   o şart anlamsız, kararı verecek olan o. */
drop policy if exists "yönetici avatar kovasını okur" on storage.objects;
create policy "yönetici avatar kovasını okur" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and public.is_admin());

drop policy if exists "yönetici avatar kovasından siler" on storage.objects;
create policy "yönetici avatar kovasından siler" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and public.is_admin());

-- ============================================================================
-- 7) TAKAS: TESLİMAT ADRESİ, KARGO BİLGİSİ, SÜRELER
-- ============================================================================

alter table public.trades
  add column if not exists kargo_firmasi text,
  add column if not exists takip_no      text,
  /* Alıcının adresinin takas anındaki kopyası. Adres defteri sonradan
     değişse de gönderi buraya gider. */
  add column if not exists teslimat      jsonb;

/* Ödeme penceresi gitti: alıcı TL ödemiyor. Kalan iki sürenin anlamı
   değişti ve adları buna göre yorumlanmalı:
     dropoff_window  → satıcının kargo numarası girmesi için süre (4 gün)
     confirm_window  → kargo numarasından sonra alıcının onay süresi (7 gün)
   Adları korunuyor: `open_dispute` ve itiraz zamanlayıcıları onlara bağlı. */
alter table public.trade_timings drop column if exists payment_window;
update public.trade_timings
   set dropoff_window = interval '4 days',
       confirm_window = interval '7 days',
       updated_at     = now()
 where id;

/**
 * Takas açılır: rezervasyon + puan havuza + teslimat adresi kopyası.
 *
 * Adres zorunlu. Satıcı ürünü bir yere göndermek zorunda ve o yer takas
 * açılırken belli olmalı; "sonra sorarız" satıcıyı adres beklerken 4 günlük
 * sayacın altında bırakırdı. `p_address_id` verilmezse alıcının varsayılan
 * adresi; o da yoksa tek adresi; hiç yoksa hata — istemci bu hatayı yakalayıp
 * adres eklettirir.
 *
 * Eski imza `(text, uuid)` düşürülüyor: parametre eklemek yeni bir yükleme
 * yaratır ve iki argümanlı çağrı eskisine gider — yani yeni kural sessizce
 * atlanırdı.
 */
drop function if exists public.create_trade(text, uuid);
create or replace function public.create_trade(
  p_product_id text,
  p_buyer_id   uuid default null,
  p_address_id uuid default null
)
returns public.trades
language plpgsql security definer set search_path = public as $$
declare p public.products; t public.trades; alici uuid; a public.addresses;
begin
  alici := coalesce(p_buyer_id, auth.uid());
  if alici is null then
    raise exception 'alıcı belirlenemedi';
  end if;

  select * into p from public.products where id = p_product_id for update;
  if not found then
    raise exception 'ilan % bulunamadı', p_product_id;
  end if;
  if p.status <> 'ACTIVE' then
    raise exception 'ilan satın alınabilir durumda değil (mevcut: %)', p.status;
  end if;
  if p.seller_id is null then
    raise exception 'ilanın satıcısı yok';
  end if;
  if p.seller_id = alici then
    raise exception 'kendi ilanınızı satın alamazsınız';
  end if;

  if p_address_id is not null then
    select * into a from public.addresses ad
     where ad.id = p_address_id and ad.user_id = alici;
    if not found then raise exception 'adres bulunamadı'; end if;
  else
    select * into a from public.addresses ad
     where ad.user_id = alici
     order by ad.varsayilan desc, ad.updated_at desc
     limit 1;
    if not found then
      raise exception 'teslimat adresi gerekli: takastan önce bir adres ekleyin';
    end if;
  end if;

  insert into public.trades (buyer_id, seller_id, product_id, points, teslimat)
  values (alici, p.seller_id, p.id, p.points,
          jsonb_build_object(
            'ad_soyad',   a.ad_soyad,
            'telefon',    a.telefon,
            'il',         a.il,
            'ilce',       a.ilce,
            'acik_adres', a.acik_adres))
  returning * into t;

  perform set_config('kt.bypass_product_guard', 'on', true);
  update public.products set status = 'RESERVED' where id = p.id;
  perform set_config('kt.bypass_product_guard', 'off', true);

  -- Bakiye yetmezse burada patlar ve her şey geri sarılır.
  t := public.hold_points(t.id);
  return t;
end; $$;
revoke all on function public.create_trade(text, uuid, uuid) from public, anon;
grant execute on function public.create_trade(text, uuid, uuid) to authenticated, service_role;

/**
 * Satıcı kargoya verdi: firma + takip numarası → SHIPPED.
 *
 * Yalnızca satıcı, yalnızca POINTS_HELD. Takip numarası boş olamaz —
 * "kargoya verdim" demek yetmez, alıcının takip edebileceği bir şey olmalı.
 * Firmayı doğrulamıyoruz: liste istemcide, "Diğer" serbest.
 */
create or replace function public.mark_shipped(
  p_trade_id      uuid,
  p_kargo_firmasi text,
  p_takip_no      text
)
returns public.trades
language plpgsql security definer set search_path = public as $$
declare t public.trades;
begin
  if auth.uid() is null then raise exception 'oturum bulunamadı'; end if;
  if p_kargo_firmasi is null or btrim(p_kargo_firmasi) = '' then
    raise exception 'kargo firması zorunludur';
  end if;
  if p_takip_no is null or length(btrim(p_takip_no)) < 4 or length(btrim(p_takip_no)) > 64 then
    raise exception 'takip numarası 4–64 karakter olmalı';
  end if;

  select * into t from public.trades where id = p_trade_id for update;
  if not found then raise exception 'takas bulunamadı'; end if;
  if t.seller_id <> auth.uid() then
    raise exception 'kargo bilgisini yalnızca satıcı girer';
  end if;
  if t.status <> 'POINTS_HELD' then
    raise exception 'bu durumda kargoya verilemez (mevcut: %)', t.status;
  end if;

  update public.trades
     set kargo_firmasi = btrim(p_kargo_firmasi),
         takip_no      = btrim(p_takip_no),
         status        = 'SHIPPED',
         updated_at    = now()
   where id = t.id
  returning * into t;
  return t;
end; $$;
revoke all on function public.mark_shipped(uuid, text, text) from public, anon;
grant execute on function public.mark_shipped(uuid, text, text) to authenticated;

/* İptal: kargo öncesi, alıcı. Kart ödemesi kontrolleri kalktı — ödeme yok. */
create or replace function public.cancel_trade(p_trade_id uuid)
returns public.trades
language plpgsql security definer set search_path = public as $$
declare t public.trades;
begin
  if auth.uid() is null then raise exception 'oturum bulunamadı'; end if;

  select * into t from public.trades where id = p_trade_id for update;
  if not found then raise exception 'takas bulunamadı'; end if;
  if t.buyer_id <> auth.uid() then
    raise exception 'bu takası yalnızca alıcı iptal edebilir';
  end if;
  if t.status not in ('CREATED','POINTS_HELD') then
    raise exception 'ürün kargoya verildikten sonra iptal edilemez (mevcut: %)', t.status;
  end if;

  return public.refund_points(t.id, 'Alıcı kargo öncesi iptal etti');
end; $$;

/**
 * Takvim damgaları.
 *
 *   INSERT / POINTS_HELD → satıcının kargo süresi (dropoff_window)
 *   SHIPPED              → alıcının onay süresi (confirm_window); itirazdan
 *                          dönüşte kaldığı yerden
 *   DELIVERED            → kalıyor (yol kapalı ama eski satırlar için doğru)
 *   DISPUTED             → sayaç durur, kalan saklanır
 *   REFUNDED             → kargodan önce iptalse teslimat kopyası silinir
 */
create or replace function public.trades_stamp_timeline()
returns trigger language plpgsql set search_path = public as $$
declare s public.trade_timings;
begin
  select * into s from public.trade_timings where id;

  if tg_op = 'INSERT' then
    if new.status in ('CREATED','POINTS_HELD') then
      new.deadline_at := now() + s.dropoff_window;
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  case new.status
    when 'POINTS_HELD' then
      new.deadline_at := now() + s.dropoff_window;

    when 'SHIPPED' then
      new.shipped_at := coalesce(new.shipped_at, now());
      if old.status = 'DISPUTED' then
        new.deadline_at        := now() + coalesce(old.deadline_remaining, s.confirm_window);
        new.deadline_remaining := null;
      else
        new.deadline_at := now() + s.confirm_window;
      end if;

    when 'DELIVERED' then
      new.delivered_at := coalesce(new.delivered_at, now());
      if old.status = 'DISPUTED' then
        new.deadline_at        := now() + coalesce(old.deadline_remaining, s.confirm_window);
        new.deadline_remaining := null;
      else
        new.deadline_at := now() + s.confirm_window;
      end if;

    when 'DISPUTED' then
      new.deadline_remaining := greatest(coalesce(old.deadline_at, now()) - now(), interval '0');
      new.deadline_at        := null;

    when 'COMPLETED' then
      new.completed_at       := coalesce(new.completed_at, now());
      new.deadline_at        := null;
      new.deadline_remaining := null;

    when 'REFUNDED' then
      new.deadline_at        := null;
      new.deadline_remaining := null;
      if new.shipped_at is null then
        new.teslimat := null;
      end if;

    else
      null;
  end case;

  return new;
end; $$;

/**
 * Süresi dolanlar. İki dal kaldı:
 *   POINTS_HELD → satıcı 4 günde kargo numarası girmedi → iade, ilan vitrine
 *   SHIPPED/DELIVERED → alıcı 7 günde onay ya da itiraz vermedi → aktarım
 * Kart ödemesi dalı kalktı: ödeme yok, "parası alınmış takas" yok.
 */
drop function if exists public.expire_stale_trades();
create or replace function public.expire_stale_trades()
returns table (kargolanmadi integer, otomatik_onay integer)
language plpgsql security definer set search_path = public as $$
declare t public.trades;
begin
  kargolanmadi := 0; otomatik_onay := 0;

  for t in
    select * from public.trades
     where deadline_at is not null and deadline_at <= now()
     order by deadline_at
     for update
  loop
    if t.status in ('CREATED','POINTS_HELD') then
      perform public.refund_points(t.id, 'Satıcı ürünü süresinde kargoya vermedi');
      kargolanmadi := kargolanmadi + 1;

    elsif t.status in ('SHIPPED','DELIVERED') then
      perform public.release_points(t.id);
      otomatik_onay := otomatik_onay + 1;

    else
      update public.trades set deadline_at = null where id = t.id;
    end if;
  end loop;

  return next;
end; $$;
revoke all on function public.expire_stale_trades() from public, anon, authenticated;

/* İtiraz reddedilince takas itiraz öncesi durumuna döner. İki yer
   `'DELIVERED'` yazıyordu; itiraz artık SHIPPED'den açılıyor ve
   DELIVERED'a "dönmek" alıcının hiç görmediği bir teslimi kayda geçirirdi. */
create or replace function public.itiraz_oncesi_durum(t public.trades)
returns text language sql immutable as $$
  select case when t.delivered_at is not null then 'DELIVERED' else 'SHIPPED' end
$$;
revoke all on function public.itiraz_oncesi_durum(public.trades) from public, anon, authenticated;

create or replace function public.resolve_dispute(
  p_dispute_id uuid, p_kabul boolean, p_not text default null,
  p_kargo_hasari boolean default false, p_iade_kargo_tl numeric default null,
  p_karar_veren uuid default null
)
returns disputes
language plpgsql security definer set search_path = public as $$
declare d public.disputes; t public.trades; esik integer; sonuc text;
begin
  select return_threshold_points into esik from public.dispute_policy where id;

  select * into d from public.disputes where id = p_dispute_id for update;
  if not found then raise exception 'itiraz bulunamadı'; end if;
  if d.status not in ('OPEN','NEEDS_EVIDENCE') then
    raise exception 'itiraz zaten sonuçlanmış (%)', d.status;
  end if;

  select * into t from public.trades where id = d.trade_id for update;

  if not p_kabul then
    update public.trades set status = public.itiraz_oncesi_durum(t), updated_at = now()
     where id = t.id;
    update public.disputes
       set status = 'REJECTED', resolution = 'REJECTED', decision_note = p_not,
           decided_by = p_karar_veren, decided_at = now(), deadline_at = null
     where id = d.id
    returning * into d;
    return d;
  end if;

  sonuc := case when t.points >= esik then 'REFUND_RETURN' else 'REFUND_KEEP' end;

  perform public.refund_points(
    t.id,
    case when sonuc = 'REFUND_RETURN'
         then 'İade kabul edildi — ürün satıcıya geri gönderiliyor'
         else 'İade kabul edildi — ürün alıcıda kalıyor' end);

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

create or replace function public.expire_stale_disputes()
returns table (kanit_gelmedi integer, karar_gecikti integer)
language plpgsql security definer set search_path = public as $$
declare d public.disputes; t public.trades;
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
      select * into t from public.trades where id = d.trade_id for update;
      update public.trades set status = public.itiraz_oncesi_durum(t), updated_at = now()
       where id = d.trade_id;
      update public.disputes
         set status = 'REJECTED', resolution = 'REJECTED', deadline_at = null,
             decision_note = 'Kanıt süresinde yüklenmedi', decided_at = now()
       where id = d.id;
      kanit_gelmedi := kanit_gelmedi + 1;
    else
      update public.disputes set deadline_at = now() + interval '6 hours'
       where id = d.id;
      karar_gecikti := karar_gecikti + 1;
      raise warning '[expire_stale_disputes] karar süresi aşıldı: %', d.id;
    end if;
  end loop;

  return next;
end; $$;

/* Bildirim metinleri yeni akışa göre. Süreler tablodan okunuyor — "4 gün"
   sabit yazılsaydı ayar değişince metin yalan söylerdi. */
create or replace function public.trades_notify()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare urun text; s public.trade_timings; kargo_gun int; onay_gun int;
begin
  select p.title into urun from public.products p where p.id = new.product_id;
  urun := coalesce(urun, 'ürününüz');
  select * into s from public.trade_timings where id;
  kargo_gun := (extract(epoch from s.dropoff_window) / 86400)::int;
  onay_gun  := (extract(epoch from s.confirm_window) / 86400)::int;

  if tg_op = 'INSERT' then
    perform public.notify(new.seller_id, 'trade.created',
      'Ürününüz alındı',
      urun || ' için takas başladı; alıcının puanı güvenli havuzda. Ürünü ' ||
        kargo_gun || ' gün içinde kargoya verip takip numarasını girin. Kargo ücreti size ait.',
      jsonb_build_object('trade', new.id));
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  case new.status
    when 'SHIPPED' then
      perform public.notify(new.buyer_id, 'trade.shipped',
        'Ürününüz yolda',
        urun || ' kargoya verildi: ' || coalesce(new.kargo_firmasi, 'kargo') || ' · ' ||
          coalesce(new.takip_no, '') || '. Elinize ulaşınca onaylayın; ' || onay_gun ||
          ' gün içinde onay ya da itiraz gelmezse puan satıcıya geçer.',
        jsonb_build_object('trade', new.id));
      perform public.notify(new.seller_id, 'trade.shipped',
        'Kargo bilgisi kaydedildi',
        urun || ' için takip numarası alıcıya iletildi. Alıcı onaylayınca puan hesabınıza geçer.',
        jsonb_build_object('trade', new.id));

    when 'DELIVERED' then
      perform public.notify(new.buyer_id, 'trade.delivered',
        'Teslim edildi — onayınızı bekliyoruz',
        urun || ' elinize ulaştıysa onaylayın. Süre dolunca puan satıcıya otomatik geçer.',
        jsonb_build_object('trade', new.id));

    when 'COMPLETED' then
      perform public.notify(new.seller_id, 'trade.completed',
        'Puanınız hesabınızda',
        new.points || ' puan cüzdanınıza geçti.',
        jsonb_build_object('trade', new.id));
      perform public.notify(new.buyer_id, 'trade.completed',
        'Takas tamamlandı',
        urun || ' için takas kapandı. İyi günlerde kullanın.',
        jsonb_build_object('trade', new.id));

    when 'REFUNDED' then
      perform public.notify(new.buyer_id, 'trade.refunded',
        'Puanınız iade edildi',
        new.points || ' puan hesabınıza geri döndü.',
        jsonb_build_object('trade', new.id));
      perform public.notify(new.seller_id, 'trade.refunded',
        'Takas iptal edildi',
        urun || ' için açılan takas kapandı, ilan yeniden vitrinde.',
        jsonb_build_object('trade', new.id));

    else
      null;
  end case;

  return new;
end; $function$;

-- ============================================================================
-- 8) EMEKLİ ÖDEME YÜZEYİ
-- ============================================================================
-- Tablolar kalıyor (`cargo_payments`, `fee_settings`: geçmiş ve puan satışına
-- yuva). İstemciye açık RPC'ler kapanıyor.
revoke all on function public.my_trade_quote(uuid) from public, anon, authenticated;

-- ============================================================================
-- 9) CANLIDAKİ AÇIK TAKASLAR
-- ============================================================================
-- Ödeme sayacıyla açılmış takas varsa yeni kurala göre satıcının 4 günü
-- şimdi başlıyor. Teslimat kopyası yoksa alıcının varsayılan adresinden
-- doldurulur; alıcının adresi hiç yoksa satıcı ekranda "adres bekleniyor"
-- görür — Tur 2 bunu ele alır.
update public.trades t
   set deadline_at = now() + (select dropoff_window from public.trade_timings where id),
       teslimat = coalesce(t.teslimat, (
         select jsonb_build_object('ad_soyad', a.ad_soyad, 'telefon', a.telefon,
                                   'il', a.il, 'ilce', a.ilce, 'acik_adres', a.acik_adres)
           from public.addresses a
          where a.user_id = t.buyer_id
          order by a.varsayilan desc, a.updated_at desc
          limit 1)),
       updated_at = now()
 where t.status in ('CREATED','POINTS_HELD');
