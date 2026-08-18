/**
 * İlanı satıcı kendisi kaldırabilir.
 *
 * Bugüne kadar bir ilanı yalnızca **hesabını silerek** kaldırabiliyordunuz.
 * Taslak listesinde dokuz yarım ilan birikmişti ve hiçbirinin çıkış kapısı
 * yoktu: yayına alınamıyor (kare reddedilmiş), silinemiyor, düzenlense bile
 * aynı yerde duruyor. Yayındaki ilan için durum daha ağır — satıcı ürünü
 * elden çıkardığında ilanı vitrinde kalmaya devam ediyor ve gelen her takas
 * talebini elle reddetmesi gerekiyor.
 *
 * ## Neden silinmiyor, `REMOVED`'a çekiliyor
 *
 * `trades.product_id` üzerinde `on delete restrict` var ve olmalı: tamamlanmış
 * bir takasın hangi ürün için yapıldığı, ürün silinince kaybolamaz. Gerçek
 * `delete` bu yüzden yalnızca hiç takas görmemiş ilanlarda çalışırdı ve
 * kullanıcıya "bazı ilanlar silinebilir, bazıları silinemez" gibi keyfî bir
 * ayrım olarak yansırdı.
 *
 * `REMOVED` zaten var ve hesap silme akışı da onu kullanıyor
 * (`20260816135038_hesap_silme.sql`). Vitrin sorgusu yalnızca `ACTIVE`
 * okuyor, taslak listesi yalnızca `DRAFT`; ilan iki listeden de düşüyor.
 *
 * ## Süren takas silmeyi durduruyor
 *
 * Alıcının puanı Güvenli Havuz'da beklerken satıcının ilanı kaldırması,
 * takası askıda bırakırdı. Kısmi indeks `trades_tek_canli_takas_uidx` canlı
 * takas durumlarını zaten tanımlıyor; aynı liste burada da kullanılıyor.
 * `SOLD` ilan da silinmiyor: satılmış ürünün kaydı takas geçmişinin parçası.
 *
 * ## Sepet ve favoriler temizleniyor
 *
 * `on delete cascade` yalnızca gerçek silmede çalışır; burada satır duruyor.
 * Temizlenmezse ilan başkasının sepetinde görünmeye devam eder ve ödeme
 * adımında "ilan satın alınabilir durumda değil" hatasıyla karşılaşır —
 * alıcının anlayamayacağı bir hata, çünkü sepetine koyduğunda ilan oradaydı.
 */

create or replace function public.delete_listing(p_product_id text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare p public.products; sahip uuid := auth.uid();
begin
  if sahip is null then
    raise exception 'oturum açmalısınız';
  end if;

  /* Sahiplik `where`de, ayrı bir kontrolde değil: başkasının ilanı için
     "bu ilan senin değil" demek, o kimlikte bir ilan olduğunu doğrular.
     `update_listing` ile aynı gerekçe ve aynı mesaj. */
  select * into p from public.products
   where id = p_product_id and seller_id = sahip
   for update;

  if p.id is null then
    raise exception 'ilan bulunamadı';
  end if;

  if p.status = 'REMOVED' then
    return; -- Çift dokunuş hata değil; sonuç zaten istenen durum.
  end if;

  if p.status = 'SOLD' then
    raise exception 'satılmış ilan kaldırılamaz';
  end if;

  if exists (
    select 1 from public.trades t
     where t.product_id = p.id
       and t.status in ('CREATED','POINTS_HELD','SHIPPED','DELIVERED','DISPUTED')
  ) then
    raise exception 'süren takası olan ilan kaldırılamaz';
  end if;

  delete from public.cart_items where product_id = p.id;
  delete from public.favorites  where product_id = p.id;

  /* Durum kolonu istemci oturumunda kilitli (`products_guard_client_update`);
     muafiyet bu fonksiyon `security definer` olduğu için gerekli — auth.uid()
     dolu kalıyor, trigger istemci sanıyor. */
  perform set_config('kt.bypass_product_guard', 'on', true);
  update public.products set status = 'REMOVED' where id = p.id;
  perform set_config('kt.bypass_product_guard', 'off', true);
end; $function$;

comment on function public.delete_listing(text) is
  'Satıcının kendi ilanını kaldırması. Gerçek silme değil REMOVED: '
  'trades.product_id on delete restrict taşıyor ve takas geçmişi ürünsüz '
  'kalamaz. Süren takası ya da SOLD durumu olan ilan kaldırılamaz.';

revoke all on function public.delete_listing(text) from public, anon;
grant execute on function public.delete_listing(text) to authenticated;
