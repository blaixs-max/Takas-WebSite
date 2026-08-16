-- Etiket karesi zorunlu olmaktan çıkıyor.
--
-- ## Neden
--
-- İlk gerçek ilanda düşen tek ret etiket karesindendi: "ürünün tabanındaki
-- marka, model veya CE yazıları net ve okunabilir şekilde görünmüyor". Model
-- doğru çalışıyordu — kare gerçekten okunmuyordu. Sorun kuralın kendisinde:
-- ikinci el bir üründe etiket çoğu zaman **yok**. Sökülmüş, solmuş ya da hiç
-- olmamış. Olmayan bir şeyi zorunlu tutmak dürüst satıcıyı kapıda durdurur ve
-- arzı öldürür.
--
-- Etiketin varlık sebebi değerlemeydi: "marka, model ve yaş grubu değerlemeyi
-- doğrudan etkiler". O iş yapay zekâya geçiyor — değerleme dört açı
-- karesinden ürünü tanıyıp piyasa fiyatını bulacak. Etiket varsa tanımayı
-- kolaylaştırır, yoksa süreç durmaz.
--
-- ## Bu fonksiyon arayüzle birlikte değişir
--
-- `mobile/data/photoSlots.ts` bu kuralın aynası. İkisi ayrışırsa arayüz
-- "atlayabilirsin" der, yayın kapısı reddeder ve kullanıcı sebebini hiç
-- anlamaz — hata mesajı bile çıkmaz, düğme sessizce kapalı kalır.
--
-- Dört açı karesi zorunlu kalıyor ve bu **kıyaslamalı denetimin koşulu**:
-- `photo-check` yeni kareyi diğer açı kareleriyle karşılaştırıyor, o yüzden
-- dördü birden olmalı. Etiket zaten kıyasa girmiyordu (yakın çekim).

create or replace function public.required_slots(p_product_id text)
returns photo_slot[]
language sql
stable
security definer
set search_path to 'public'
as $function$
  select array_remove(array[
    'front'::public.photo_slot,
    'back'::public.photo_slot,
    'left'::public.photo_slot,
    'right'::public.photo_slot,
    case when p.has_damage then 'damage'::public.photo_slot end,
    case when p.is_set     then 'parts'::public.photo_slot end
  ], null)
  from public.products p where p.id = p_product_id;
$function$;
