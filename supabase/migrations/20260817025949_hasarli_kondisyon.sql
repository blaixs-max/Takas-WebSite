-- Dördüncü kondisyon: "Hasarlı".
--
-- ## Neden ayrı bir kondisyon, bir onay kutusu değil
--
-- Hasar bugün `has_damage` adında bağımsız bir anahtar: kullanıcı "İyi
-- durumda" seçip yanında hasar kutusunu işaretleyebiliyor. İki sorun:
--
--  1. **Çelişkili beyan mümkün.** "Yeni gibi ama hasarlı" anlamsız bir cümle
--     ama form onu kabul ediyor.
--  2. **Kutu görünmez.** Kondisyon büyük çipler hâlinde seçiliyor, hasar ise
--     aşağıda küçük bir anahtar. Satıcı hasarı beyan etmemeyi seçmiyor,
--     çoğu zaman fark etmiyor bile — ve beyan edilmeyen hasar, alıcının
--     itirazı ve havuzdan ödediğimiz iade demek.
--
-- Dört seçenekli tek bir liste bu ikisini birden çözüyor: seçim tek, çelişki
-- imkânsız, hasar diğerleriyle aynı boyutta görünür.
--
-- `has_condition` artık türetiliyor: 'Hasarlı' ⇒ `has_damage = true` ⇒
-- `required_slots()` hasar karesini istiyor. Yani "hasarlı seçildiyse hasar
-- fotoğrafı zorunlu" kuralı yeni bir kod gerektirmiyor, var olan zincir
-- kendiliğinden çalışıyor.

alter table public.products drop constraint if exists products_condition_check;
alter table public.products add constraint products_condition_check
  check (condition = any (array['İyi durumda'::text, 'Az kullanılmış'::text,
                                'Yeni gibi'::text, 'Hasarlı'::text]));

alter table public.valuation_settings
  add column if not exists oran_hasarli numeric(4,3) not null default 0.45;

/**
 * Sıfır fiyatından puan — 'Hasarlı' kondisyonu eklendi.
 *
 * ## Hasarda oran neden sabit değil
 *
 * 'Hasarlı' tek bir şey değil: köşesi çizilmiş bir kutu ile tekerleği kırık
 * bir araba aynı kelimeyle beyan ediliyor. Sabit bir oran ikisinden birine
 * haksızlık ederdi — hafif hasarlıyı cezalandırır, ağır hasarlıya prim verir.
 *
 * Bu yüzden oran, modelin karelerden okuduğu şiddete göre **iyi durumda** ile
 * **hasarlı** bandı arasında geziniyor:
 *
 *     oran = oran_iyi_durumda − (oran_iyi_durumda − oran_hasarli) × şiddet
 *
 * Şiddet 0 → neredeyse iyi durumda; şiddet 1 → tam hasarlı bandı. Şiddet
 * bilinmiyorsa 1 alınıyor: bilinmeyeni satıcının lehine yorumlamak, hasarı
 * küçük göstermeyi kârlı kılardı.
 *
 * Ek `hasar_indirimi` bu yolda **uygulanmıyor** — oran zaten hasarı fiyatlıyor,
 * ikisini birden uygulamak aynı kusuru iki kez cezalandırmak olurdu. İndirim
 * yalnızca eski satırlar için duruyor: kondisyonu 'Hasarlı' olmadığı hâlde
 * `has_damage` işaretli olanlar.
 */
create or replace function public.puan_hesapla(
  p_sifir_fiyat   numeric,
  p_condition     text,
  p_has_damage    boolean default false,
  p_hasar_siddeti numeric default 1.0
)
returns integer
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  a         public.valuation_settings;
  oran      numeric;
  siddet    numeric;
  ikinci_el numeric;
  puan      numeric;
begin
  if p_sifir_fiyat is null or p_sifir_fiyat <= 0 then
    return null;
  end if;

  select * into a from public.valuation_settings where id = 1;
  siddet := greatest(0, least(1, coalesce(p_hasar_siddeti, 1)));

  if p_condition = 'Hasarlı' then
    oran := a.oran_iyi_durumda - (a.oran_iyi_durumda - a.oran_hasarli) * siddet;
    ikinci_el := p_sifir_fiyat * oran;
  else
    oran := case p_condition
              when 'Yeni gibi'      then a.oran_yeni_gibi
              when 'Az kullanılmış' then a.oran_az_kullanilmis
              when 'İyi durumda'    then a.oran_iyi_durumda
              else a.oran_iyi_durumda
            end;
    ikinci_el := p_sifir_fiyat * oran;
    /* Eski satırlar: kondisyon 'Hasarlı' değil ama `has_damage` işaretli. */
    if p_has_damage then
      ikinci_el := ikinci_el * (1 - a.hasar_indirimi * siddet);
    end if;
  end if;

  puan := ikinci_el * a.puan_per_try;

  return greatest(a.taban_puan, round(puan / 10) * 10)::integer;
end;
$function$;

revoke all on function public.puan_hesapla(numeric, text, boolean, numeric) from public, anon, authenticated;

/**
 * `create_listing` — 'Hasarlı' seçilirse `has_damage` zorla true.
 *
 * İstemciye bırakılmıyor: kondisyon 'Hasarlı' gelip `p_has_damage` false
 * gelseydi, hasar karesi istenmez ve hasarlı ürün fotoğrafsız yayına girerdi.
 * Türetilen bir değeri istemciden almak, onu isteğe bağlı yapmaktır.
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
declare p public.products; satici uuid := auth.uid(); ad text; bas text; hasar boolean;
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

  select coalesce(
           nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
           nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
           split_part(coalesce(u.email, 'Üye'), '@', 1))
    into ad from auth.users u where u.id = satici;
  ad := coalesce(ad, 'Üye');
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
