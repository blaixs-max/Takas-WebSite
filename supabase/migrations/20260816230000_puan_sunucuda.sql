-- Puan artık istemciden gelmiyor.
--
-- ## Neden bu göç, değerleme motorundan ayrı
--
-- Bir önceki göç `puan_hesapla()`yı kurdu ama kimse çağırmıyordu:
-- `create_listing` puanı hâlâ parametre olarak alıyor ve ne gelirse yazıyordu.
-- En doğru formül bile, yanından geçilebildiği sürece süs. Bu göç yolu kapatır.
--
-- ## Sıra neden böyle
--
-- Değerleme kareleri görmek zorunda, kareler de ilan oluşturulduktan sonra
-- yükleniyor. Yani puan **oluşturma anında bilinemez**:
--
--   create_listing (DRAFT, puan yok) → kareler → degerleme_yaz → publish
--
-- Bu yüzden `points` artık boş olabiliyor ve yayın kapısı değerleme
-- yapılmadan geçmiyor. Alternatif, oluşturma anında geçici bir puan yazıp
-- sonra düzeltmekti; o da "bir süre yanlış puan taşıyan ilan" demek olurdu ve
-- o süre içinde biri onu okuyabilir.
--
-- ## Eski imza siliniyor, üstüne yazılmıyor
--
-- PostgreSQL aşırı yükleme yapıyor: `p_points`li sürümü bırakıp yenisini
-- eklersek ikisi de çağrılabilir kalır ve istemci eskisini çağırmaya devam
-- eder — yani hiçbir şey değişmez. Eski imza **düşürülüyor**; bu, güncel
-- olmayan istemcinin ilan oluşturmasını kırar ve kırması gerekir.

alter table public.products alter column points drop not null;
alter table public.products alter column ai_suggested_points drop not null;

drop function if exists public.create_listing(text, text, text, text, integer, text, text, boolean, boolean, text);

create or replace function public.create_listing(
  p_title        text,
  p_category     text,
  p_condition    text,
  p_size_class   text,
  p_location     text default 'Belirtilmedi',
  p_description  text default null,
  p_has_damage   boolean default false,
  p_is_set       boolean default false,
  p_sub_category text default null
)
returns products
language plpgsql
security definer
set search_path to 'public'
as $function$
declare p public.products; satici uuid := auth.uid(); ad text; bas text;
begin
  if satici is null then raise exception 'ilan vermek için oturum açmalısınız'; end if;
  if p_title is null or btrim(p_title) = '' then raise exception 'başlık zorunludur'; end if;
  if not exists (select 1 from public.shipping_rates where size_class = p_size_class) then
    raise exception 'geçersiz desi kademesi: %', p_size_class;
  end if;
  if not exists (select 1 from public.product_categories where name = p_category) then
    raise exception 'geçersiz kategori: %', p_category;
  end if;
  if p_sub_category is not null
     and not exists (select 1 from public.product_sub_categories
                      where category = p_category and name = p_sub_category) then
    raise exception 'alt kategori "%" bu kategoriye ait değil: %', p_sub_category, p_category;
  end if;

  select coalesce(
           nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
           nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
           split_part(coalesce(u.email, 'Üye'), '@', 1))
    into ad from auth.users u where u.id = satici;
  ad := coalesce(ad, 'Üye');
  bas := upper(left(ad, 1)) ||
         upper(coalesce(nullif(left(split_part(ad, ' ', 2), 1), ''), left(ad, 1)));

  /* points ve ai_suggested_points bilerek boş: değerleme kareleri gördükten
     sonra yazacak. */
  insert into public.products (
    title, condition, category, sub_category, size_class,
    location, description, seller_id, seller_name, seller_initials,
    has_damage, is_set, status)
  values (
    btrim(p_title), p_condition, p_category, p_sub_category, p_size_class,
    coalesce(nullif(btrim(p_location), ''), 'Belirtilmedi'), p_description,
    satici, ad, bas, coalesce(p_has_damage, false), coalesce(p_is_set, false), 'DRAFT')
  returning * into p;

  return p;
end; $function$;

revoke all on function public.create_listing(text, text, text, text, text, text, boolean, boolean, text)
  from public, anon;
grant execute on function public.create_listing(text, text, text, text, text, text, boolean, boolean, text)
  to authenticated;

/**
 * Değerlemeyi yazar — yalnızca `service_role`, yani `listing-value` fonksiyonu.
 *
 * Puanı burada **biz** hesaplıyoruz, model değil: modelin döndürdüğü tek şey
 * sıfır fiyatı ve güveni. Model doğrudan puan verseydi, ekonominin katsayıları
 * modelin ağırlıklarına gömülmüş olurdu ve bir oranı değiştirmek istem yazmak
 * demeye gelirdi.
 *
 * Kaynak ve güven ilanla birlikte saklanıyor: "bu puan nereden çıktı"
 * sorusunun cevabı olmadan hiçbir itiraz çözülemez.
 */
create or replace function public.degerleme_yaz(
  p_product_id    text,
  p_sifir_fiyat   numeric,
  p_kaynak        text default null,
  p_guven         numeric default null,
  p_model         text default null,
  p_hasar_siddeti numeric default 1.0
)
returns products
language plpgsql
security definer
set search_path to 'public'
as $function$
declare p public.products; yeni_puan integer;
begin
  select * into p from public.products where id = p_product_id for update;
  if not found then raise exception 'ilan % bulunamadı', p_product_id; end if;

  yeni_puan := public.puan_hesapla(p_sifir_fiyat, p.condition, p.has_damage, p_hasar_siddeti);

  /* `products_guard_client_update` puanın ve `ai_suggested_points`in doğrudan
     değiştirilmesini engelliyor. Bayrağı **açıkça** açıyoruz.

     Kendiliğinden de geçerdi: tetikleyici `auth.uid() is null` durumunda
     çekiliyor ve Edge Function service_role ile, oturumsuz çağırıyor. Ama o
     zaman koruma "bu kod doğru olduğu için" değil "çağıranın oturumu olmadığı
     için" aşılmış olurdu — bağlam değişince sessizce kırılan cinsten. Testi
     yazarken tam olarak bu oldu: `test.uid` hâlâ ayarlıyken çağrıldı ve
     tetikleyici çarptı.

     `set_product_points()` bu iş için değil: o, satıcının yayındaki bir
     ilanın fiyatını **aşağı** çekmesi için ve `status = 'ACTIVE'` istiyor.
     Değerleme taslak ilanda çalışıyor ve fiyatı ilk kez koyuyor. */
  perform set_config('kt.bypass_product_guard', 'on', true);

  update public.products
     set sifir_fiyat        = p_sifir_fiyat,
         points             = yeni_puan,
         ai_suggested_points = yeni_puan,
         market_value       = case when p_sifir_fiyat is null then null
                                   else round(p_sifir_fiyat)::text end,
         degerleme_kaynak   = p_kaynak,
         degerleme_guven    = p_guven,
         degerleme_model    = p_model,
         degerleme_at       = now()
   where id = p_product_id
  returning * into p;

  perform set_config('kt.bypass_product_guard', 'off', true);

  return p;
end; $function$;

revoke all on function public.degerleme_yaz(text, numeric, text, numeric, text, numeric)
  from public, anon, authenticated;

/**
 * Yayın kapısına değerleme koşulu.
 *
 * Üç ret sebebi eklendi ve üçü de ayrı ayrı gerekli:
 *  - değerleme hiç yapılmadıysa (model ürünü bulamadı ya da uç çağrılmadı),
 *  - puan hesaplanamadıysa (fiyat yok — `puan_hesapla` null döndü),
 *  - puan güvenlik bandının dışındaysa.
 *
 * Üçünde de ilan taslakta kalıyor ve insana düşüyor. Puanı olmayan bir ilanı
 * yayına almak, değeri belirsiz bir şeyi rafa koymak olurdu; kapalı devrede
 * bunun karşılığı, alıcının belirsiz miktarda puan ödemesi.
 */
create or replace function public.publish_listing(
  p_product_id text,
  p_cover_slot photo_slot default 'front'::photo_slot
)
returns products
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  p        public.products;
  gerekli  public.photo_slot[];
  eksik    public.photo_slot[];
  bekleyen int;
  reddedilen int;
  kapak    text;
begin
  select * into p from public.products where id = p_product_id for update;
  if not found then raise exception 'ilan % bulunamadı', p_product_id; end if;
  if p.seller_id is distinct from auth.uid() then
    raise exception 'yalnızca ilan sahibi yayına alabilir';
  end if;
  if p.status <> 'DRAFT' then
    raise exception 'yalnızca taslak ilan yayına alınır (mevcut: %)', p.status;
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

  select count(*) filter (where moderation_status = 'rejected'),
         count(*) filter (where moderation_status = 'pending')
    into reddedilen, bekleyen
    from public.product_photos where product_id = p_product_id;

  if reddedilen > 0 then
    raise exception 'moderasyondan geçmeyen kare var; yeniden çekin';
  end if;
  if bekleyen > 0 then
    raise exception 'kareler hâlâ inceleniyor, birazdan tekrar deneyin';
  end if;

  if p.degerleme_at is null then
    raise exception 'ilan henüz değerlenmedi';
  end if;
  if p.points is null then
    raise exception 'ürünün piyasa değeri bulunamadı; ilan incelemeye alındı';
  end if;
  if public.puan_bandi_disinda(p.points) then
    raise exception 'hesaplanan puan olağandışı yüksek; ilan incelemeye alındı';
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
     set status = 'ACTIVE',
         image_key = kapak
   where id = p_product_id
  returning * into p;
  perform set_config('kt.bypass_product_guard', 'off', true);

  return p;
end; $function$;

revoke all on function public.publish_listing(text, photo_slot) from public, anon;
grant execute on function public.publish_listing(text, photo_slot) to authenticated;
