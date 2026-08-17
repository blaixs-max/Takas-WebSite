/**
 * Bekleyen kare kullanıcıyı ekranda tutmasın — onay gelince ilan kendiliğinden
 * yayına girsin.
 *
 * ## Sorun
 *
 * Model bir kareye karar veremediğinde kare `pending` kalıyor ve yönetim
 * kuyruğuna düşüyor. Yayın kapısı ise `bekleyen > 0` görünce
 * "kareler hâlâ inceleniyor, birazdan tekrar deneyin" diyordu. Kullanıcının
 * elinde yapacak bir şey yok: kareyi çekmiş, beklemek dışında seçeneği yok, ve
 * "birazdan tekrar dene" onu fotoğraf ekranına geri çağırıyor. İnsan onayı
 * dakikalar değil saatler sürebilir.
 *
 * Bu, kullanıcının hatası olmayan bir gecikmeyi kullanıcının işi hâline
 * getiriyordu.
 *
 * ## Çözüm
 *
 * İlan taslakta kalır, kullanıcı ekrandan çıkar. Bekleyen kare onaylandığı an
 * **sunucu ilanı kendisi yayına alır** ve kullanıcıya bildirim gider. Kullanıcı
 * bir daha o ekrana dönmek zorunda değil.
 *
 * ## Neden ortak gövde
 *
 * Yayın kapısında yedi kontrol var (eksik kare, ret, bekleyen, değerleme,
 * puan, bant, kapak). İki ayrı yerde iki kopya tutmak, ilk kural
 * değişikliğinde ikisinin ayrışmasını garanti ederdi — ve ayrışan taraf
 * **kontrolsüz yayın** olurdu. Gövde `ilan_yayina_al` içinde tek yerde:
 *
 *   - `publish_listing`      → sahiplik doğrular, sonra gövdeyi çağırır
 *   - `ilan_otomatik_yayina_al` → sahiplik doğrulamaz (kullanıcı orada değil),
 *                                 gövdeyi çağırır, hata olursa yutar
 *
 * Otomatik yol sahiplik doğrulamıyor ama **diğer altı kontrolün hiçbirini
 * atlamıyor**. Atlasaydı "yönetici bir kareyi onayladı" ile "ilan yayına
 * hazır" aynı şey sanılırdı; değil — değerlemesi düşmüş ya da başka karesi
 * reddedilmiş bir ilan da onaydan geçebilir.
 */

-- ---------------------------------------------------------------------------
-- 1) Ortak gövde: sahiplik dışındaki bütün kapılar
-- ---------------------------------------------------------------------------

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

revoke all on function public.ilan_yayina_al(text, public.photo_slot)
  from public, anon, authenticated;

comment on function public.ilan_yayina_al(text, public.photo_slot) is
  'Yayın kapısının ortak gövdesi — sahiplik DOĞRULAMAZ. Doğrudan çağrılmaz; '
  'publish_listing (sahiplikle) ve ilan_otomatik_yayina_al (onay sonrası) '
  'bunu kullanır. Yetkisi kimseye verilmez.';

-- ---------------------------------------------------------------------------
-- 2) Kullanıcının çağırdığı yol: sahiplik + ortak gövde
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
declare sahip uuid;
begin
  select seller_id into sahip from public.products where id = p_product_id;
  if not found then raise exception 'ilan % bulunamadı', p_product_id; end if;
  if sahip is distinct from auth.uid() then
    raise exception 'yalnızca ilan sahibi yayına alabilir';
  end if;
  return public.ilan_yayina_al(p_product_id, p_cover_slot);
end; $function$;

-- ---------------------------------------------------------------------------
-- 3) Onay sonrası otomatik yayın
-- ---------------------------------------------------------------------------

/**
 * İlanı yayına almayı **dener**; hazır değilse sessizce vazgeçer.
 *
 * Hata yutuluyor ve bu doğru: tetikleyiciden çağrılıyor, yani hatası
 * yöneticinin onay işlemini geri alırdı. "Bu kare onaylandı ama ilanın
 * değerlemesi yok" bir çökme değil, beklenen bir durum — ilan taslakta kalır,
 * eksik tamamlanınca bir sonraki onayda yayına girer.
 */
create or replace function public.ilan_otomatik_yayina_al(p_product_id text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare p public.products;
begin
  begin
    p := public.ilan_yayina_al(p_product_id, 'front');
  exception when others then
    return false;
  end;

  perform public.notify(
    p.seller_id,
    'listing.published',
    'İlanın yayında',
    p.title || ' incelemeden geçti ve vitrine çıktı.',
    jsonb_build_object('productId', p.id)
  );
  return true;
end; $function$;

revoke all on function public.ilan_otomatik_yayina_al(text) from public, anon, authenticated;

/**
 * Kare kararı değişince kullanıcıyı haberdar et, mümkünse ilanı yayına al.
 *
 * `after update`, çünkü karar satıra yazılmış olmalı: yayın kapısı bekleyen
 * kare sayar ve `before` tetikleyicide bu satır hâlâ eski hâliyle görünürdü.
 *
 * Yeniden giriş kilidi şart: otomatik yayın `is_cover` güncelliyor, o da bu
 * tetikleyiciyi yeniden ateşler ve sonsuz döngü olurdu.
 */
create or replace function public.product_photos_karar_sonrasi()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  gerekli public.photo_slot[];
  satici  uuid;
  baslik  text;
begin
  if new.moderation_status is not distinct from old.moderation_status then
    return null;
  end if;
  if coalesce(current_setting('kt.otomatik_yayin', true), 'off') = 'on' then
    return null;
  end if;

  select p.seller_id, p.title into satici, baslik
    from public.products p where p.id = new.product_id;

  if new.moderation_status = 'rejected' then
    gerekli := public.required_slots(new.product_id);
    /* Yalnızca zorunlu slotta haber veriyoruz. Zorunsuz karenin reddi yayını
       durdurmuyor (kapı onu siliyor), yani kullanıcıdan istenecek bir şey
       yok — bildirim göndermek onu boşuna geri çağırmak olurdu. */
    if new.slot = any (gerekli) then
      perform public.notify(
        satici,
        'photo.rejected',
        'Bir fotoğrafın geçmedi',
        coalesce(baslik, 'İlanın') || ' için ' || new.slot::text ||
          ' karesi yeniden çekilmeli' ||
          case when new.moderation_reason is not null
               then ': ' || new.moderation_reason else '.' end,
        jsonb_build_object('productId', new.product_id, 'slot', new.slot)
      );
    end if;
    return null;
  end if;

  if new.moderation_status = 'approved' then
    perform set_config('kt.otomatik_yayin', 'on', true);
    perform public.ilan_otomatik_yayina_al(new.product_id);
    perform set_config('kt.otomatik_yayin', 'off', true);
  end if;

  return null;
end; $function$;

drop trigger if exists product_photos_karar_sonrasi on public.product_photos;
create trigger product_photos_karar_sonrasi
  after update on public.product_photos
  for each row execute function public.product_photos_karar_sonrasi();
