/**
 * Taslak ilanı düzenleme — `update_listing`.
 *
 * ## Neden gerekliydi
 *
 * `create_listing` ilanı DRAFT açıyor ve kullanıcı doğrudan kare çekimine
 * gidiyordu. Yarım bırakıp sonra `drafts` ekranından dönen kullanıcı yine
 * kare çekimine düşüyordu: başlığını yanlış yazmışsa, kategoriyi karıştırmışsa
 * ya da kondisyonu değiştirmek istiyorsa **hiçbir yolu yoktu**. Tek çare ilanı
 * bırakıp yenisini açmaktı; eski taslak veri tabanında sonsuza kadar kalıyordu.
 *
 * ## Neden yalnızca DRAFT
 *
 * Yayındaki bir ilanın kondisyonunu değiştirmek puanını değiştirir; o puanla
 * birinin sepetinde ya da açık bir takasında olabilir. Yayındaki ilanı
 * düzenlemek ayrı bir karar — yeniden değerleme mi, yeniden onay mı, açık
 * takaslara ne olacak. Burada kapı kapalı ve sebebi hata metninde yazıyor.
 *
 * ## Değerleme neden sıfırlanıyor
 *
 * Bu fonksiyonun asıl işi bu. `listing-value` ilan başına **bir kez** çalışıyor
 * ve `degerleme_at` damgasına bakıp ikinci kez çalışmıyor. Düzenleme bunu
 * bozar: 'Hasarlı' seçip değerlenen, sonra 'Yeni gibi'ye çeviren kullanıcının
 * ilanı eski düşük puanla kalırdı — ya da tersi, ki o yönü **bedava puan**
 * demek. Kapalı devrede yanlış puan basılmış paradır.
 *
 * O yüzden değerlemeyi besleyen alanlardan biri değişirse (başlık, açıklama,
 * kategori, alt kategori, kondisyon) damga ve puan siliniyor; ilan yayın
 * kapısından geçmek için yeniden değerlenmek zorunda kalıyor. Konum ve desi
 * kademesi bu listede yok: ikisi de modele hiç gitmiyor, fiyatı etkilemiyor.
 *
 * Karşılaştırma `is distinct from` ile: `<>` null'da null döner ve açıklamayı
 * boş bırakıp sonra dolduran kullanıcının değerlemesi sıfırlanmazdı.
 */
create or replace function public.update_listing(
  p_product_id   text,
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
declare
  p       public.products;
  eski    public.products;
  satici  uuid := auth.uid();
  hasar   boolean;
  bayatla boolean;
begin
  if satici is null then raise exception 'ilan vermek için oturum açmalısınız'; end if;

  select * into eski from public.products where id = p_product_id;
  /* Sahibi değilse de "bulunamadı" diyoruz, "senin değil" değil: ikincisi
     geçerli bir ilan kimliğini doğrulamak olurdu. `photo-check`teki 404 ile
     aynı gerekçe. */
  if eski.id is null or eski.seller_id is distinct from satici then
    raise exception 'ilan bulunamadı';
  end if;
  if eski.status <> 'DRAFT' then
    raise exception 'yayındaki ilan düzenlenemez';
  end if;

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

  -- `create_listing` ile aynı kural: türetilen değer istemciden alınmaz.
  hasar := coalesce(p_has_damage, false) or p_condition = 'Hasarlı';

  bayatla :=
       btrim(p_title)  is distinct from eski.title
    or p_description   is distinct from eski.description
    or p_category      is distinct from eski.category
    or p_sub_category  is distinct from eski.sub_category
    or p_condition     is distinct from eski.condition
    or hasar           is distinct from eski.has_damage;

  /* Trigger istemci oturumunda `points` değişimini reddediyor ve bu fonksiyon
     security definer olduğu için `auth.uid()` dolu kalıyor; muafiyet açıkça
     veriliyor. `degerleme_yaz` da aynı yolu izliyor — orada "auth.uid() null
     olur" varsayımına güvenmek bir tur boyunca sessizce çalışmıştı. */
  perform set_config('kt.bypass_product_guard', 'on', true);

  update public.products set
    title        = btrim(p_title),
    condition    = p_condition,
    category     = p_category,
    sub_category = p_sub_category,
    size_class   = p_size_class,
    location     = coalesce(nullif(btrim(p_location), ''), 'Belirtilmedi'),
    description  = p_description,
    has_damage   = hasar,
    is_set       = coalesce(p_is_set, false),
    points          = case when bayatla then null else points end,
    sifir_fiyat     = case when bayatla then null else sifir_fiyat end,
    degerleme_at    = case when bayatla then null else degerleme_at end,
    degerleme_kaynak = case when bayatla then null else degerleme_kaynak end,
    degerleme_guven  = case when bayatla then null else degerleme_guven end,
    degerleme_model  = case when bayatla then null else degerleme_model end
  where id = p_product_id
  returning * into p;

  perform set_config('kt.bypass_product_guard', 'off', true);

  return p;
end; $function$;

revoke all on function public.update_listing(text, text, text, text, text, text, text, boolean, boolean, text)
  from public, anon;
grant execute on function public.update_listing(text, text, text, text, text, text, text, boolean, boolean, text)
  to authenticated;

comment on function public.update_listing(text, text, text, text, text, text, text, boolean, boolean, text) is
  'Taslak ilanı günceller. Yalnızca sahibi, yalnızca DRAFT. Değerlemeyi '
  'besleyen bir alan değişirse puan ve değerleme damgası silinir, ilan '
  'yeniden değerlenmek zorunda kalır.';
