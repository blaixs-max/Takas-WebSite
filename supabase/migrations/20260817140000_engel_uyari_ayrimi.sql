/**
 * Denetim ikiye ayrıldı: engel ve uyarı. Metin denetimi eklendi.
 *
 * ## Neden
 *
 * Canlıdaki ilk gerçek kullanımda **sekiz reddin sekizi de kadraj yüzündendi**;
 * hiçbiri güvenlikle ilgili değildi. Denetimin var olma sebebi (çocuk yüzü,
 * uygunsuz içerik, dolandırıcılık) bir kez bile devreye girmedi. Onun yerine
 * insanlar bir fotoğrafçılık sınavına sokuldu.
 *
 * En açık örnek: bir Superman figüründe sol kareye "bu sağ profil", sağ kareye
 * "bu sol profil" dendi. İkisini takas etse yine reddedilebilirdi — çıkışı
 * olmayan bir döngü. Model sağı soldan güvenilir ayıramıyor; ayıramadığı bir
 * şeyi sorup cevabına göre insanı engellemek yanlış.
 *
 * ## Ayıran çizgi
 *
 * **Başkasına zarar veren şey engeller, yalnızca satıcıyı ilgilendiren şey
 * uyarır.**
 *
 *   ENGEL   çocuk yüzü · müstehcen/uygunsuz içerik · tanınabilir üçüncü kişi
 *           stok görsel · ekran fotoğrafı · başka ürün · uygunsuz metin
 *   UYARI   yanlış açı · bulanık/karanlık · aynı açı tekrarı
 *
 * Engeller alıcıyı ya da fotoğraftaki kişiyi korur. Uyarılar yalnızca ilanın
 * kalitesiyle ilgilidir ve ona karar vermek satıcının hakkı: kötü fotoğraf
 * kendi zararı, ilanı daha az ilgi görür.
 *
 * `ayni_aci` uyarıya indi ve bu tartışmalı — satıcı ürünün kırık yüzünü
 * gizleyip sağlam yüzünü dört kez çekebilir. İki gerekçeyle yine de uyarı:
 * (1) sağı soldan ayıramayan görüş "aynı açı"yı da güvenilir ayıramaz, aynı
 * zayıf yeteneği kullanıyor; (2) dört karenin dördü de aynı açıysa **alıcı
 * ilanı açtığında görüyor** — bu, kullanıcıdan gizlenebilen bir kusur değil.
 * `baska_urun` engel kaldı: "bu aynı ürün bile değil" bir kadraj tercihi değil,
 * aldatmadır.
 *
 * ## Metin hiç denetlenmiyordu
 *
 * Daha büyük boşluk buydu. `photo-check` yalnızca fotoğrafa bakıyor; başlık ve
 * açıklama **hiçbir denetimden geçmiyordu**. Küfür, hakaret, telefon numarası,
 * dışarı yönlendiren bağlantı, reklam, müstehcen metin — fotoğraflar temizse
 * hepsi yayına giriyordu.
 *
 * Denetim `listing-value` içine kondu, ayrı bir çağrıya değil: o fonksiyon
 * başlığı, açıklamayı, kategoriyi ve durum beyanını **zaten** modele
 * gönderiyor (fiyat bulmak için). Aynı çağrıya bir alan eklemek ek maliyet
 * getirmiyor. Ayrı bir çağrı, ilan başına bir model çağrısı daha demekti.
 */

-- ---------------------------------------------------------------------------
-- Kare uyarısı
-- ---------------------------------------------------------------------------

alter table public.product_photos
  add column if not exists uyari text;

comment on column public.product_photos.uyari is
  'Kare onaylandı ama satıcıya söylenecek bir kusuru var (yanlış açı, bulanık, '
  'aynı açı). `moderation_reason` ile karıştırılmamalı: o RET gerekçesi, bu '
  'GEÇEN bir karenin notu. Ayrı kolon, çünkü ikisi aynı anda anlamlı olamaz '
  'ama aynı alanda tutulursa "reddedildi mi geçti mi" sorusu metne bakmayı '
  'gerektirirdi.';

-- ---------------------------------------------------------------------------
-- Metin denetimi
-- ---------------------------------------------------------------------------

alter table public.products
  add column if not exists metin_uygun boolean,
  add column if not exists metin_gerekce text;

comment on column public.products.metin_uygun is
  'Başlık ve açıklama denetimden geçti mi. NULL = henüz denetlenmedi '
  '(değerleme çalışmamış). false ise yayın kapısı geçirmez. Fotoğraf '
  'denetiminden ayrı: metni kullanıcı kolayca düzeltir, yeniden çekim gerekmez.';

-- ---------------------------------------------------------------------------
-- Yayın kapısı: uygunsuz metin de engeller
-- ---------------------------------------------------------------------------

/**
 * `ilan_yayina_al` — metin denetimi eklendi.
 *
 * Gövdenin geri kalanı değişmedi; yalnızca `metin_uygun = false` durumu
 * eklendi. `null` geçiyor: değerleme hiç çalışmadıysa zaten `degerleme_at`
 * kontrolüne takılır, aynı şeyi iki kez söylemeye gerek yok.
 */
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

  if p.metin_uygun is false then
    raise exception 'ilan metni denetimden geçmedi: %',
      coalesce(p.metin_gerekce, 'başlık veya açıklama uygun değil');
  end if;

  gerekli := public.required_slots(p_product_id);

  select array_agg(s) into eksik
    from unnest(gerekli) s
   where not exists (select 1 from public.product_photos ph
                      where ph.product_id = p_product_id and ph.slot = s);
  if eksik is not null then
    raise exception 'eksik kare: %', array_to_string(eksik, ', ');
  end if;

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

-- ---------------------------------------------------------------------------
-- `degerleme_yaz` metin kararını da yazar
-- ---------------------------------------------------------------------------

/**
 * Metin kararı değerlemeyle **aynı yazmada** kaydediliyor.
 *
 * Ayrı bir RPC olabilirdi ama iki yazma iki tur demek ve ikisi arasında ilan
 * "değerlendi ama metni denetlenmedi" gibi tutarsız bir ara durumda kalırdı.
 * Tek çağrı, tek satır, tutarlı durum.
 */
/* Eski altı parametreli imza düşürülüyor. `create or replace` yeni
   varsayılanlı parametre eklemeye izin veriyor ama ortaya **iki** aşırı yükleme
   çıkıyor ve beş argümanlı çağrı ikisine de uyduğu için Postgres
   "is not unique" diyor.
   Düşürmek çağıranları kırmıyor: `listing-value` adlandırılmış parametreyle
   çağırıyor ve yeni imza aynı adları taşıyor, eksik ikisi varsayılandan
   doluyor. */
drop function if exists public.degerleme_yaz(text, numeric, text, numeric, text, numeric);

create or replace function public.degerleme_yaz(
  p_product_id   text,
  p_sifir_fiyat  numeric,
  p_kaynak       text default null,
  p_guven        numeric default null,
  p_model        text default null,
  p_hasar_siddeti numeric default 1.0,
  p_metin_uygun  boolean default null,
  p_metin_gerekce text default null
)
returns products
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  p          public.products;
  yeni_puan  integer;
  taban      integer;
  ham        numeric;
  yukseltildi boolean;
begin
  select * into p from public.products where id = p_product_id for update;
  if not found then raise exception 'ilan % bulunamadı', p_product_id; end if;

  yeni_puan := public.puan_hesapla(p_sifir_fiyat, p.condition, p.has_damage, p_hasar_siddeti);

  select vs.taban_puan into taban from public.valuation_settings vs where vs.id = 1;

  ham := round((p_sifir_fiyat * public.puan_orani(p.condition, p.has_damage, p_hasar_siddeti)
                * (select puan_per_try from public.valuation_settings where id = 1)) / 10) * 10;
  yukseltildi := p_sifir_fiyat is not null and p_sifir_fiyat > 0
                 and taban is not null and ham < taban;

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
         degerleme_at       = now(),
         taban_uygulandi    = coalesce(yukseltildi, false),
         /* `coalesce` ile eski karar korunuyor: metin denetimi gelmezse
            (eski istemci, ya da model o alanı vermezse) önceki karar
            silinmemeli. Sessizce `null`a düşmek "denetlenmedi" demek olurdu
            ve kapı onu geçirir. */
         metin_uygun        = coalesce(p_metin_uygun, metin_uygun),
         metin_gerekce      = case when p_metin_uygun is null then metin_gerekce
                                   else p_metin_gerekce end
   where id = p_product_id
  returning * into p;

  perform set_config('kt.bypass_product_guard', 'off', true);

  return p;
end; $function$;

revoke all on function public.degerleme_yaz(text, numeric, text, numeric, text, numeric, boolean, text)
  from public, anon, authenticated;
