-- KIDS TRADE — Kapak karesi vitrine bağlanır
--
-- Cihazdaki ilk gerçek ilanda çıktı. `publish_listing()` kapak karesini
-- `product_photos.is_cover` ile işaretliyordu ama `products.image_key`
-- alanına hiçbir şey yazmıyordu; alan null kalıyordu.
--
-- Uygulamada `resolveImage(null)` paketli demo görsellerden birine düşüyor.
-- Sonuç: "Kızılay" başlıklı gerçek bir ilan, vitrinde ahşap blok fotoğrafıyla
-- görünüyordu. Bu bir eksik görsel değil, YANLIŞ görsel — kullanıcı satıcının
-- çektiği kareyi gördüğünü sanıyor, oysa başka bir ürünün stok fotoğrafına
-- bakıyor. Boş bırakmak bundan iyidir.
--
-- Artık kapak karesinin depolama yolu image_key'e yazılır. Uygulama tarafı
-- yolu imzalı bağlantıya çevirir (kova özel).
--
-- Fonksiyonun geri kalanı 20260807150000'deki hâliyle AYNI bırakıldı —
-- özellikle `kt.bypass_product_guard` muafiyeti (onsuz trigger yayınlamayı
-- reddeder) ve reddedilen/bekleyen kare için ayrı hata mesajları.

create or replace function public.publish_listing(
  p_product_id text,
  p_cover_slot public.photo_slot default 'front'
)
returns public.products
language plpgsql security definer set search_path = public as $$
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

  -- Kapak seçimi: yalnızca hangi karenin vitrinde görüneceğini belirler.
  -- Ürünün durumu kapağın üzerinde rozet olarak her hâlükârda görünür, yani
  -- hasar karesini kapak yapmamak kusuru gizlemeye yaramaz.
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
end; $$;

-- Bu kusurdan etkilenmiş ilanlar: yayında ama kapağı bağlanmamış.
update public.products p
   set image_key = ph.storage_path
  from public.product_photos ph
 where ph.product_id = p.id
   and ph.is_cover
   and p.image_key is null;

-- Fonksiyon yeniden oluşturulduğu için yetkiler yeniden kuruluyor
-- (bkz. 20260809100000: PostgreSQL yeni fonksiyonu PUBLIC'e açar).
revoke execute on function public.publish_listing(text, public.photo_slot) from public;
revoke execute on function public.publish_listing(text, public.photo_slot) from anon;
grant execute on function public.publish_listing(text, public.photo_slot) to authenticated;
grant execute on function public.publish_listing(text, public.photo_slot) to service_role;
