/**
 * Yayındaki ilan da düzenlenebiliyor — ama üç alanı.
 *
 * `update_listing` bugüne kadar yalnızca `DRAFT` kabul ediyordu. Kullanıcının
 * yayındaki bir ilanında yazım hatası varsa tek çaresi ilanı kaldırıp
 * yenisini açmaktı: yedi kare yeniden çekilecek, yeniden denetlenecek,
 * yeniden değerlenecek. Bir harf için.
 *
 * ## Neden hepsi değil
 *
 * Yayındaki ilanın puanı **kilitli**. Alıcı o puanı görüp karar veriyor ve
 * kimi zaman sepetine koyup bekletiyor. Puanı besleyen bir alanı değiştirip
 * puanı sabit bırakmak, ilanı olduğundan başka bir şey gibi göstermek olurdu;
 * puanı yeniden hesaplamak ise alıcının gördüğü fiyatı altından çekmek.
 * İkisi de kötü, o yüzden o alanlar kilitli.
 *
 * | Alan | Yayında | Sebep |
 * |---|---|---|
 * | Başlık, açıklama, konum | **açık** | Puanı değiştirmiyor, kareleri geçersiz kılmıyor |
 * | Kondisyon, hasar | kilitli | Alıcının ana güven sinyali **ve** puanı besliyor |
 * | Kategori, alt kategori | kilitli | Puanı besliyor; ayrıca ilan başka bir rafa taşınırdı |
 * | Desi (boyut) | kilitli | Kargo bedelini belirliyor — alıcının ödeyeceği tutar |
 * | Set beyanı | kilitli | Zorunlu kare kümesini değiştiriyor |
 *
 * Bunları değiştirmek isteyen kullanıcı ilanı kaldırıp yenisini açıyor ve bu
 * doğru: gerçekten başka bir ilan.
 *
 * ## Değerleme bilerek YENİLENMİYOR
 *
 * Taslakta başlık ya da açıklama değişince puan siliniyor (`bayatla`) ve ilan
 * yeniden değerleniyor. Yayında bu yol kapalı: değerlemeyi silmek ilanı
 * puansız bırakırdı ve puansız bir `ACTIVE` ilan, yayın kapısının hiçbir
 * zaman geçirmeyeceği bir durum — kapı yalnızca girişte bakıyor, sonrasında
 * bakmıyor.
 *
 * Bunun bir bedeli var ve kabul ediliyor: satıcı açıklamayı değiştirip ürünü
 * olduğundan başka anlatabilir. Ama puan sabit kaldığı için **ekonomik bir
 * kazanç yok**, ve kareler değişmediği için alıcı ürünü hâlâ görüyor. Kalan
 * risk yanlış beyan ve onun yeri şikâyet mekanizması, fiyat mekanizması değil.
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
  /* Sahibi değilse de "bulunamadı": "senin değil" demek geçerli bir ilan
     kimliğini doğrulamak olurdu. */
  if eski.id is null or eski.seller_id is distinct from satici then
    raise exception 'ilan bulunamadı';
  end if;

  if eski.status not in ('DRAFT', 'ACTIVE') then
    /* RESERVED: alıcının puanı havuzda, takas yürüyor.
       SOLD/REMOVED: ilan bitmiş. */
    raise exception 'bu ilan düzenlenemez (durum: %)', eski.status;
  end if;

  if p_title is null or btrim(p_title) = '' then raise exception 'başlık zorunludur'; end if;

  hasar := coalesce(p_has_damage, false) or p_condition = 'Hasarlı';

  /* ---------------------------------------------------------------------
     YAYINDAKİ İLAN — yalnızca üç alan.

     Kilitli alanların değişip değişmediğine bakıp reddediyoruz; sessizce
     yok saymak daha kolay olurdu ama kullanıcı kondisyonu değiştirdiğini
     sanıp kaydeder ve ekran ona doğruyu söylemezdi.
     --------------------------------------------------------------------- */
  if eski.status = 'ACTIVE' then
    if p_condition is distinct from eski.condition
       or hasar is distinct from eski.has_damage then
      raise exception 'yayındaki ilanın durumu değiştirilemez';
    end if;
    if p_category is distinct from eski.category
       or p_sub_category is distinct from eski.sub_category then
      raise exception 'yayındaki ilanın kategorisi değiştirilemez';
    end if;
    if p_size_class is distinct from eski.size_class then
      raise exception 'yayındaki ilanın boyutu değiştirilemez';
    end if;
    if coalesce(p_is_set, false) is distinct from eski.is_set then
      raise exception 'yayındaki ilanın set beyanı değiştirilemez';
    end if;

    perform set_config('kt.bypass_product_guard', 'on', true);
    update public.products set
      title       = btrim(p_title),
      location    = coalesce(nullif(btrim(p_location), ''), 'Belirtilmedi'),
      description = p_description
     where id = p_product_id
    returning * into p;
    perform set_config('kt.bypass_product_guard', 'off', true);

    return p;
  end if;

  /* ---------------------------------------------------------------------
     TASLAK — her şey açık, davranış değişmedi.
     --------------------------------------------------------------------- */
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

  /* `is distinct from` şart: `<>` iki null'da null döner ve koşul sessizce
     atlanırdı — açıklaması boş olan iki ilan "değişmedi" sayılmazdı. */
  bayatla :=
       btrim(p_title)  is distinct from eski.title
    or p_description   is distinct from eski.description
    or p_category      is distinct from eski.category
    or p_sub_category  is distinct from eski.sub_category
    or p_condition     is distinct from eski.condition
    or hasar           is distinct from eski.has_damage;

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
    /* Değerlemeyi besleyen bir alan değiştiyse puan siliniyor: eski beyanın
       puanıyla yayına girilemesin. */
    points              = case when bayatla then null else points end,
    ai_suggested_points = case when bayatla then null else ai_suggested_points end,
    sifir_fiyat         = case when bayatla then null else sifir_fiyat end,
    degerleme_at        = case when bayatla then null else degerleme_at end,
    degerleme_kaynak    = case when bayatla then null else degerleme_kaynak end,
    degerleme_guven     = case when bayatla then null else degerleme_guven end,
    degerleme_model     = case when bayatla then null else degerleme_model end,
    taban_uygulandi     = case when bayatla then false else taban_uygulandi end
   where id = p_product_id
  returning * into p;

  perform set_config('kt.bypass_product_guard', 'off', true);

  return p;
end; $function$;

revoke all on function public.update_listing(text, text, text, text, text, text, text, boolean, boolean, text)
  from public, anon;
grant execute on function public.update_listing(text, text, text, text, text, text, text, boolean, boolean, text)
  to authenticated;
