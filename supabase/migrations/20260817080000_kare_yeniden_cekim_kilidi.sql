/**
 * Reddedilen kare kilidi — iki kusur, tek çıkmaz.
 *
 * Canlıda bulundu (2026-08-17). Kullanıcı termos ilanı açtı, dört zorunlu
 * kareyi çekti, etiket karesinde arka planda sigara paketi göründüğü için
 * kare reddedildi. Sonrası çıkışsızdı:
 *
 *   07:51:10  publish_listing        → 400  (reddedilen kare var)
 *   07:51:21  product_photos upsert  → 403  (yeniden çekim RLS'e takıldı)
 *   07:51:28  publish_listing        → 400
 *   07:51:43  publish_listing        → 400
 *   07:54:14  publish_listing        → 400
 *
 * ## A) `product_photos`'ta UPDATE politikası yoktu
 *
 * Tabloda DELETE, INSERT ve SELECT politikaları vardı, UPDATE yoktu. Yeniden
 * çekim `upsert(onConflict: product_id,slot)` yapıyor; çakışmada UPDATE'e
 * düşüyor ve RLS onu reddediyor. Yani **reddedilen hiçbir kare hiçbir zaman
 * yeniden çekilemiyordu** — istemcideki "yeniden çek" akışı en baştan ölüydü,
 * kimse denemediği için görülmemişti.
 *
 * Politika eklerken asıl mesele izin vermek değil, **neyin
 * güncellenebileceğini sınırlamak**: `moderation_status` kullanıcıya açık
 * olsaydı herkes kendi karesini `approved` yapardı ve bütün denetim
 * anlamsızlaşırdı. RLS kolon bazında yazmıyor, o yüzden sınır bir tetikleyicide:
 * kullanıcı bir kareyi güncellediğinde durum **zorla** `pending`e düşüyor ve
 * gerekçe siliniyor. Yeni dosya yeni karardır — eski onay da eski ret de
 * taşınmaz.
 *
 * Tetikleyici yönetici ve sunucu yazmalarını atlıyor: `photo-check` servis
 * anahtarıyla yazıyor (`auth.uid()` null), `admin_moderate_photo` ise
 * yöneticinin oturumunda çalışıyor (`is_admin()` true). İkisi de kararı
 * vermeye yetkili olan taraf.
 *
 * ## B) Yayın kapısı zorunlu olmayan slotta reddi de sayıyordu
 *
 * `publish_listing` reddedilen kareleri **bütün** slotlarda sayıyordu. Etiket
 * karesi zorunlu değil; kullanıcı "etiketim yok, atla" dediğinde bile satır
 * tabloda duruyor ve sayıma giriyordu. Zorunlu olmayan bir karenin ilanı
 * kalıcı olarak kilitlemesi, "zorunlu değil" sözünün karşılığı olamaz.
 *
 * Yok sayıp geçmek yetmez: reddedilen karenin dosyası silinmiş oluyor, satır
 * kalırsa yayındaki ilanın galerisi kırık bir görsele bakar. O yüzden kapı
 * zorunlu olmayan reddedilmiş kareleri **siliyor** ve yalnızca kalanları
 * sayıyor. Zorunlu slottaki ret hâlâ yayını durduruyor — orada kare
 * gerçekten gerekli.
 */

-- ---------------------------------------------------------------------------
-- A) Kendi taslağının karelerini güncelleyebilme + durum koruması
-- ---------------------------------------------------------------------------

create policy "kendi karelerini güncelle"
  on public.product_photos
  for update
  using (
    exists (select 1 from public.products p
             where p.id = product_photos.product_id
               and p.seller_id = auth.uid()
               and p.status = 'DRAFT')
  )
  with check (
    exists (select 1 from public.products p
             where p.id = product_photos.product_id
               and p.seller_id = auth.uid()
               and p.status = 'DRAFT')
  );

/**
 * Kullanıcının yazdığı her güncelleme kareyi yeniden incelemeye düşürür.
 *
 * RLS kolon bazında sınır koyamıyor: yukarıdaki politika satırı
 * güncellenebilir yapıyor, hangi kolonun değişebileceğini söyleyemiyor.
 * `moderation_status` kullanıcıya açık kalsaydı `approved` yazmak bir istek
 * kadar uzaktaydı ve `photo-check` süs olurdu.
 *
 * `is_cover` de korunuyor: kapak seçimi `publish_listing` içinde yapılıyor ve
 * oradan geçmesi gerekiyor, yoksa reddedilmiş bir kare kapak olabilirdi.
 */
/* **`security invoker`** (varsayılan) — ve bu şart.
   İlk hâli `security definer`dı ve kontrol sessizce hiç çalışmadı: definer
   fonksiyonun içinde `current_user` fonksiyon **sahibine** düşer, yani asla
   'authenticated' olmaz, yani her güncelleme erken dönüşten geçerdi.
   Testte `approved` yazılabildiği görülünce çıktı; kosu.sh yalnızca çıkış
   kodunu görüyor, iddiayı gözle okumak gerekti.
   Fonksiyon hiçbir tabloya dokunmuyor, yalnızca NEW'i düzenliyor — yükseltilmiş
   yetkiye ihtiyacı yok. */
create or replace function public.product_photos_guard_client_update()
returns trigger language plpgsql set search_path = public as $$
begin
  /* Ayraç rol, `auth.uid()` değil.
     İlk hâli `auth.uid() is null` diye bakıyordu ve iki yerde yanlış çalıştı:
     `publish_listing` kapak seçerken `is_cover` güncelliyor ve o güncelleme
     kullanıcının oturumunda oluyor — bütün kareler yayının tam ortasında
     `pending`e düşüyordu.

     Rol doğru ayraç: istemci bağlantısı PostgREST'te `authenticated` (ya da
     `anon`) rolünde kalır; `security definer` fonksiyonların içinde
     `current_user` fonksiyon sahibine düşer ve `photo-check` servis
     anahtarıyla `service_role` olur. Yani "kararı vermeye yetkili olan taraf"
     ile "kareyi yeniden çeken kullanıcı" rolle zaten ayrılmış. */
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  new.moderation_status := 'pending';
  new.moderation_reason := null;
  new.is_cover          := old.is_cover;

  return new;
end; $$;

drop trigger if exists product_photos_guard_client_update on public.product_photos;
create trigger product_photos_guard_client_update
  before update on public.product_photos
  for each row execute function public.product_photos_guard_client_update();

-- ---------------------------------------------------------------------------
-- B) Yayın kapısı: zorunlu olmayan reddi kilitleyici saymaz
-- ---------------------------------------------------------------------------

create or replace function public.publish_listing(
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

  /* Zorunlu olmayan slottaki reddedilmiş kare siliniyor, yayını durdurmuyor.
     Yok sayıp bırakmak olmazdı: reddedilen karenin dosyası zaten silinmiş,
     satır kalsaydı yayındaki ilanın galerisi kırık bir görsele bakardı. */
  delete from public.product_photos ph
   where ph.product_id = p_product_id
     and ph.moderation_status = 'rejected'
     and not (ph.slot = any (gerekli));

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

comment on function public.product_photos_guard_client_update() is
  'Kullanıcının kare güncellemesi denetim durumunu sıfırlar. RLS kolon bazında '
  'sınır koyamadığı için burada: moderation_status açık kalsaydı herkes kendi '
  'karesini approved yapabilirdi.';
