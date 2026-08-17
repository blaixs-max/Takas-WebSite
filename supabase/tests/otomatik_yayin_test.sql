-- ELDENELE — Bekleyen kare onaylanınca ilan kendiliğinden yayına girer
--
-- Bu dosyanın tamamı `bekle`/`bekle_esit` ile yazıldı: iddia tutmazsa test
-- düşer. Ekrana basıp göze bırakan eski biçim bu pakette bir güvenlik
-- kontrolünün hiç çalışmadığını gizlemişti.
--
-- Kritik iddialar: 2 (onay ilanı yayına alıyor — yoksa kullanıcı fotoğraf
-- ekranında beklemeye mahkûm), 4 (başka bekleyen kare varken yayına
-- ALINMIYOR) ve 5 (değerlemesiz ilan onayla yayına giremiyor — onay
-- "yayına hazır" demek değil).

\set s 'dd44dd44-0000-0000-0000-00000000a001'

\echo ''
\echo '=== Hazırlık ==='
insert into auth.users (id, email, phone, phone_confirmed_at, raw_user_meta_data)
values (:'s', 'otomatik@example.com', '+905557770001', now(),
        '{"full_name":"Deniz Yılmaz"}'::jsonb)
on conflict (id) do nothing;

set session role authenticated;
select set_config('test.uid', :'s', false);

select id from create_listing('Otomatik yayın ürünü', 'Oyun & Oyuncak', 'İyi durumda', 'M',
                              p_sub_category => 'Yapı & inşa') \gset a_
insert into product_photos (product_id, slot, storage_path)
select :'a_id', s, :'s' || '/' || :'a_id' || '/' || s || '.jpg'
  from unnest(array['front','back','left','right']::photo_slot[]) s;
select test_degerle(:'a_id', 400);

\echo ''
\echo '=== 1) Üçü onaylı, biri bekliyor: ilan TASLAK kalır ==='
-- Kullanıcının ekrandan çıktığı an. İlan yayına girmemeli ama kaybolmamalı da.
reset role;
update product_photos set moderation_status = 'approved'
 where product_id = :'a_id' and slot in ('front','back','left');
set session role authenticated;
select set_config('test.uid', :'s', false);
select bekle_esit('bekleyen kare varken ilan taslakta kalır',
                  (select status from products where id = :'a_id'), 'DRAFT');
select bekle_esit('bir kare hâlâ bekliyor',
                  (select count(*) from product_photos
                    where product_id = :'a_id' and moderation_status = 'pending'), 1::bigint);

\echo ''
\echo '=== 2) SON KARE ONAYLANINCA İLAN KENDİLİĞİNDEN YAYINA GİRER ==='
-- Bu dosyanın varlık sebebi. Yönetici son kareyi onaylıyor; kullanıcı ortada
-- yok, hiçbir şeye basmıyor. İlan yine de vitrine çıkmalı.
reset role;
update product_photos set moderation_status = 'approved'
 where product_id = :'a_id' and slot = 'right';
set session role authenticated;
select set_config('test.uid', :'s', false);
select bekle_esit('son onay ilanı yayına alır',
                  (select status from products where id = :'a_id'), 'ACTIVE');
select bekle('kapak işaretlendi',
             exists (select 1 from product_photos
                      where product_id = :'a_id' and is_cover and slot = 'front'));

\echo ''
\echo '=== 3) Kullanıcıya bildirim gider ==='
-- Kullanıcı ekrandan çıktığı için sonucu başka türlü öğrenemez. Bildirim
-- gitmezse ilan yayına girer ve sahibi bunu bilmez.
select bekle_esit('yayın bildirimi oluşur',
                  (select count(*) from notifications
                    where user_id = :'s' and kind = 'listing.published'
                      and data->>'productId' = :'a_id'), 1::bigint);

\echo ''
\echo '=== 4) Başka bekleyen kare varsa onay yayına ALMAZ ==='
-- Otomatik yol sahiplik dışındaki hiçbir kapıyı atlamıyor. Atlasaydı
-- "bir kare onaylandı" ile "ilan yayına hazır" aynı şey sanılırdı.
select id from create_listing('İki bekleyenli', 'Oyun & Oyuncak', 'İyi durumda', 'M',
                              p_sub_category => 'Yapı & inşa') \gset i_
insert into product_photos (product_id, slot, storage_path)
select :'i_id', s, :'s' || '/' || :'i_id' || '/' || s || '.jpg'
  from unnest(array['front','back','left','right']::photo_slot[]) s;
select test_degerle(:'i_id', 400);
reset role;
update product_photos set moderation_status = 'approved'
 where product_id = :'i_id' and slot in ('front','back');
set session role authenticated;
select set_config('test.uid', :'s', false);
select bekle_esit('iki kare beklerken yayına girmez',
                  (select status from products where id = :'i_id'), 'DRAFT');

\echo ''
\echo '=== 5) DEĞERLEMESİZ İLAN ONAYLA YAYINA GİREMEZ ==='
-- Onay "yayına hazır" demek değil. Puanı olmayan ilan yayına girseydi
-- vitrinde fiyatsız bir kart dururdu ve takas hesabı yapılamazdı.
select id from create_listing('Değerlemesiz', 'Oyun & Oyuncak', 'İyi durumda', 'M',
                              p_sub_category => 'Yapı & inşa') \gset d_
insert into product_photos (product_id, slot, storage_path)
select :'d_id', s, :'s' || '/' || :'d_id' || '/' || s || '.jpg'
  from unnest(array['front','back','left','right']::photo_slot[]) s;
reset role;
update product_photos set moderation_status = 'approved' where product_id = :'d_id';
set session role authenticated;
select set_config('test.uid', :'s', false);
select bekle_esit('değerlemesiz ilan onayla yayına girmez',
                  (select status from products where id = :'d_id'), 'DRAFT');

\echo ''
\echo '=== 6) Zorunlu kare reddedilince kullanıcıya haber gider ==='
-- Kullanıcı artık ekranda beklemiyor, yani reddi başka türlü öğrenemez.
select id from create_listing('Reddedilecek', 'Oyun & Oyuncak', 'İyi durumda', 'M',
                              p_sub_category => 'Yapı & inşa') \gset r_
insert into product_photos (product_id, slot, storage_path)
select :'r_id', s, :'s' || '/' || :'r_id' || '/' || s || '.jpg'
  from unnest(array['front','back','left','right']::photo_slot[]) s;
reset role;
update product_photos set moderation_status = 'rejected', moderation_reason = 'bulanık'
 where product_id = :'r_id' and slot = 'back';
set session role authenticated;
select set_config('test.uid', :'s', false);
select bekle_esit('zorunlu kare reddi bildirilir',
                  (select count(*) from notifications
                    where user_id = :'s' and kind = 'photo.rejected'
                      and data->>'productId' = :'r_id'), 1::bigint);

\echo ''
\echo '=== 7) Zorunsuz kare reddi bildirim ÜRETMEZ ==='
-- Zorunsuz karenin reddi yayını durdurmuyor; kullanıcıdan istenecek bir şey
-- yok. Bildirim göndermek onu boşuna geri çağırmak olurdu.
insert into product_photos (product_id, slot, storage_path)
values (:'r_id', 'label', :'s' || '/' || :'r_id' || '/label.jpg');
reset role;
update product_photos set moderation_status = 'rejected', moderation_reason = 'okunmuyor'
 where product_id = :'r_id' and slot = 'label';
set session role authenticated;
select set_config('test.uid', :'s', false);
select bekle_esit('zorunsuz ret sessiz kalır',
                  (select count(*) from notifications
                    where user_id = :'s' and kind = 'photo.rejected'
                      and data->>'productId' = :'r_id'), 1::bigint);

\echo ''
\echo '=== 8) Ortak gövde doğrudan çağrılamaz ==='
-- `ilan_yayina_al` sahiplik doğrulamıyor. Kullanıcıya açık olsaydı herkes
-- herkesin taslağını yayına alabilirdi.
select bekle('ilan_yayina_al authenticated rolüne kapalı',
             not has_function_privilege('authenticated',
               'public.ilan_yayina_al(text, public.photo_slot)', 'execute'));
select bekle('ilan_otomatik_yayina_al authenticated rolüne kapalı',
             not has_function_privilege('authenticated',
               'public.ilan_otomatik_yayina_al(text)', 'execute'));
