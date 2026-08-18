/**
 * E-postadan türetilmiş satıcı adı yayınlanmaz.
 *
 * `create_listing` profilde ad yoksa `split_part(email, '@', 1)` ile ad
 * üretiyordu. Canlıda `kmerdem@gmail.com` ile açılan ilan uygulamada satıcı
 * adı olarak **"kmerdem"** gösterdi — kişinin e-postasının yarısı, bütün
 * kullanıcılara açık.
 *
 * Bu tuzak `CLAUDE.md`de zaten adıyla anılıyordu (`emrahatabek` vakası) ve
 * **siteye** çözüm yazılmıştı: `vitrin-cek.mjs` içindeki `adiKisalt` böyle bir
 * adı "Üye"ye çeviriyor. Ama çözüm yalnızca oradaydı; veri tabanı ham değeri
 * saklamaya, uygulama da ham göstermeye devam etti.
 *
 * ## Neden kaynakta
 *
 * Uygulamaya ikinci bir kısaltma yazmak da işi görürdü ama sitede zaten bir
 * kopyası var ve **iki kopya ilk değişiklikte ayrışır** — bugün bunun iki
 * örneğini yaşadık (gizlilik metni ve taslak listesi). Değer veri tabanına
 * hiç girmezse hiçbir yüzeyin ondan haberi olmasına gerek kalmıyor.
 *
 * ## Kural
 *
 * Ad ya boşluk içerir ("Zeynep Demir") ya da büyük harfle başlayan saf
 * harflerden oluşur ("Ayşe"); ikisi de değilse **"Üye"**. Site tarafındaki
 * `adiKisalt` ile aynı ölçüt — orada da aynı üç koşula bakılıyor.
 *
 * Emin olunamayan durumda ismi göstermemek, yanlışını göstermekten iyidir:
 * "Üye" kimseyi yanıltmaz, "kmerdem" bir e-posta sızdırır.
 *
 * ## Kısaltma neden burada değil
 *
 * Site "Emrah Atabek"i "Emrah A."ya kısaltıyor, uygulama tam gösteriyor. Bu
 * kasıtlı: site açık web ve indeksleniyor, uygulama üyeler arası ve takas
 * yapacak iki kişinin birbirini tanıması gerekiyor. Burada yalnızca
 * **e-posta türevi** durum ele alınıyor, kısaltma değil.
 */

/**
 * Yayınlanabilir satıcı adı. E-postadan türemişse "Üye".
 */
create or replace function public.yayinlanabilir_ad(p_ad text)
returns text
language sql
immutable
as $function$
  select case
    when p_ad is null or btrim(p_ad) = '' then 'Üye'
    -- Boşluk içeriyorsa gerçek ad kabul ediliyor: "Zeynep Demir".
    when btrim(p_ad) like '% %' then btrim(p_ad)
    -- Tek kelimeyse: büyük harfle başlayan saf harf dizisi olmalı ("Ayşe").
    when btrim(p_ad) ~ '^[[:upper:]][[:alpha:]]*$' and length(btrim(p_ad)) <= 20
      then btrim(p_ad)
    else 'Üye'
  end;
$function$;

comment on function public.yayinlanabilir_ad(text) is
  'E-postadan türemiş görünen adı "Üye"ye çevirir. Site tarafındaki '
  'adiKisalt ile aynı ölçüt; oradaki kısaltmayı YAPMAZ çünkü uygulama tam ad '
  'gösteriyor (üyeler arası) ve site kısaltıyor (açık web).';

/**
 * `create_listing` — ad artık süzgeçten geçiyor.
 *
 * Baş harfler de **yayınlanan addan** türetiliyor. Ham addan türetilseydi
 * kart "Üye" derken rozet "KK" gösterirdi; site tarafında bu çelişki bir kez
 * yaşandı ve orada da aynı şekilde çözüldü.
 */
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
declare p public.products; satici uuid := auth.uid(); ham text; ad text; bas text; hasar boolean;
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

  hasar := coalesce(p_has_damage, false) or p_condition = 'Hasarlı';

  /* Ham ad hâlâ e-postadan türeyebiliyor — `yayinlanabilir_ad` onu süzüyor.
     Türetmeyi tamamen kaldırmak istemiyoruz: profilinde adı olan kullanıcı
     için `full_name`/`name` doğru kaynak ve o yol değişmemeli. */
  select coalesce(
           nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
           nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
           split_part(coalesce(u.email, ''), '@', 1))
    into ham from auth.users u where u.id = satici;

  ad := public.yayinlanabilir_ad(ham);
  bas := upper(left(ad, 1)) ||
         upper(coalesce(nullif(left(split_part(ad, ' ', 2), 1), ''), left(ad, 1)));

  insert into public.products (
    title, condition, category, sub_category, size_class,
    location, description, seller_id, seller_name, seller_initials,
    has_damage, is_set, status)
  values (
    btrim(p_title), p_condition, p_category, p_sub_category, p_size_class,
    coalesce(nullif(btrim(p_location), ''), 'Belirtilmedi'), p_description,
    satici, ad, bas, hasar, coalesce(p_is_set, false), 'DRAFT')
  returning * into p;

  return p;
end; $function$;

revoke all on function public.create_listing(text, text, text, text, text, text, boolean, boolean, text)
  from public, anon;
grant execute on function public.create_listing(text, text, text, text, text, text, boolean, boolean, text)
  to authenticated;

/**
 * Mevcut kayıtlar düzeltiliyor.
 *
 * Zaten yayında olan ilanlar da var; süzgeç yalnızca yeni ilanlara uygulansa
 * "kmerdem" vitrinde kalmaya devam ederdi. Baş harfler de yeni addan yeniden
 * türetiliyor, yoksa kart "Üye" derken rozet eski harfleri gösterirdi.
 *
 * Profiline sonradan gerçek adını yazan kullanıcının **eski** ilanları "Üye"
 * kalır ve bu kabul edildi: geriye dönük düzeltmek, satıcı adını ilan
 * ömrü boyunca değişebilir bir alan hâline getirmek olurdu.
 */
do $$
begin
  perform set_config('kt.bypass_product_guard', 'on', true);
  update public.products
     set seller_name = public.yayinlanabilir_ad(seller_name),
         seller_initials =
           upper(left(public.yayinlanabilir_ad(seller_name), 1)) ||
           upper(coalesce(
             nullif(left(split_part(public.yayinlanabilir_ad(seller_name), ' ', 2), 1), ''),
             left(public.yayinlanabilir_ad(seller_name), 1)))
   where seller_name is distinct from public.yayinlanabilir_ad(seller_name);
  perform set_config('kt.bypass_product_guard', 'off', true);
end $$;
