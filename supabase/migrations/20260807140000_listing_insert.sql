-- KIDS TRADE — İlan eklemenin veri tabanı tarafı
--
-- products tablosu vitrini beslemek için yazılmıştı; içine gerçek bir ilan
-- yazmak için üç şey eksikti:
--
--   1. id'nin varsayılanı yoktu. Tohum veriye elle 'blocks', 'rings' gibi
--      anahtarlar yazılmıştı; istemcinin kimlik uydurması gerekiyordu.
--   2. image_key not null'dı. Gerçek fotoğraf akışı henüz yok (yedi kareli
--      çekim sıradaki iş), o yüzden bir ilan fotoğrafsız açılabilmeli.
--   3. size_class not null değildi ama fiyatlandırma ona bağlı. İlan formu
--      artık soruyor; kolon zorunlu hâle geliyor.

-- ============================ 1) KİMLİK ============================

alter table public.products
  alter column id set default gen_random_uuid()::text;

-- ============================ 2) FOTOĞRAF ============================
-- Paketli görsel anahtarı artık zorunlu değil. Yedi kareli çekim geldiğinde
-- gerçek dosya yolları ayrı bir tabloya yazılacak; o iş bu kolonu emekliye
-- ayıracak, şimdilik demo ilanları için duruyor.

alter table public.products
  alter column image_key drop not null;

-- ============================ 3) DESİ ZORUNLU ============================
-- Desisi olmayan bir ilan fiyatlandırılamaz (quote_trade_price hata verir),
-- yani vitrine çıkmamalı. Mevcut satırlar 20260807120000'de S'e çekilmişti.

update public.products set size_class = 'S' where size_class is null;
alter table public.products alter column size_class set not null;

-- ============================ 4) İLAN AÇMA ============================
-- Sahiplik zaten RLS'te: "kendi ilanını ekle" politikası seller_id = auth.uid()
-- şartını koyuyor, yani oturumlu bir kullanıcı sahipsiz ilan açamaz. Ek bir
-- CHECK gerekmiyor; tohum verideki sahipsiz demo satırları da bozulmuyor.
-- Doğrudan insert yerine RPC: puan, satıcı ve durum alanlarını istemcinin
-- serbestçe doldurmasını istemiyoruz. Değerleme sonucu ai_suggested_points'e
-- yazılır ve listelenen puan onu aşamaz (20260807110000'deki kısıt).

create or replace function public.create_listing(
  p_title       text,
  p_category    text,
  p_condition   text,
  p_size_class  text,
  p_points      integer,
  p_location    text default 'Belirtilmedi',
  p_description text default null
)
returns public.products
language plpgsql security definer set search_path = public as $$
declare
  p       public.products;
  satici  uuid := auth.uid();
  ad      text;
  bas     text;
begin
  if satici is null then
    raise exception 'ilan vermek için oturum açmalısınız';
  end if;
  if p_title is null or btrim(p_title) = '' then
    raise exception 'başlık zorunludur';
  end if;
  if p_points is null or p_points <= 0 then
    raise exception 'puan sıfırdan büyük olmalı';
  end if;
  if not exists (select 1 from public.shipping_rates where size_class = p_size_class) then
    raise exception 'geçersiz desi kademesi: %', p_size_class;
  end if;

  -- Görünen ad: profil tablosu yok, o yüzden oturumun meta verisinden
  -- türetilir. Gerçek profil geldiğinde burası oradan okuyacak.
  select coalesce(
           nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
           nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
           split_part(coalesce(u.email, 'Üye'), '@', 1))
    into ad
    from auth.users u where u.id = satici;
  ad := coalesce(ad, 'Üye');

  bas := upper(left(ad, 1)) ||
         upper(coalesce(nullif(left(split_part(ad, ' ', 2), 1), ''), left(ad, 1)));

  insert into public.products (
    title, points, ai_suggested_points, condition, category, size_class,
    location, description, seller_id, seller_name, seller_initials, status)
  values (
    btrim(p_title), p_points, p_points, p_condition, p_category, p_size_class,
    coalesce(nullif(btrim(p_location), ''), 'Belirtilmedi'), p_description,
    satici, ad, bas, 'ACTIVE')
  returning * into p;

  return p;
end; $$;

revoke all on function public.create_listing(text, text, text, text, integer, text, text) from public;
grant execute on function public.create_listing(text, text, text, text, integer, text, text) to authenticated;

-- ============================ 5) SATICI KENDİ İLANINI GÖRSÜN ============================
-- products'ın tek SELECT politikası "status = 'ACTIVE'" idi. Satıcı, ilanı
-- rezerve edildiği ya da satıldığı anda onu göremez oluyordu: "Yayınladığım
-- İlanlar" ekranı sattığı her ürünü listeden düşürürdü. Takas ekranında da
-- ürün adı boş kalırdı.
--
-- Vitrin kuralı aynı kalır (herkes yalnız ACTIVE görür); sahibine kendi
-- ilanlarının tamamı açılır.

drop policy if exists "kendi ilanlarını gör" on public.products;
create policy "kendi ilanlarını gör"
  on public.products for select
  to authenticated
  using (seller_id = auth.uid());

-- Takasın karşı tarafı da ürünü görebilmeli: alıcı, rezerve edilmiş ilanın
-- adını ve fotoğrafını takas ekranında görecek.
drop policy if exists "taraf olduğun takasın ürününü gör" on public.products;
create policy "taraf olduğun takasın ürününü gör"
  on public.products for select
  to authenticated
  using (exists (
    select 1 from public.trades t
     where t.product_id = products.id
       and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
  ));
