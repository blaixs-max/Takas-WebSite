-- ELDENELE — Değerleme sonrası otomatik yayın
--
-- Tamamı `bekle`/`bekle_esit` ile: iddia tutmazsa test düşer.
--
-- Kritik iddia 1: **kareler önce, değerleme sonra** sırasında ilan yayına
-- giriyor. Canlıda üç ilan tam bu sırada taslakta mahsur kaldı ve biri üç
-- dakika arayla iki kez açıldı — kullanıcı "olmadı" deyip yeniden denemişti.
--
-- 2 ve 3 kapının gevşemediğini kolluyor: değerleme geldi diye eksik kareli ya
-- da uygunsuz metinli bir ilan geçmemeli. Tetikleyici kapıyı ÇALIYOR,
-- açmıyor — bu ayrım bozulursa değerleme tek başına yayın bileti olur.

\set s 'dd44dd44-0000-0000-0000-00000000f001'

\echo ''
\echo '=== Hazırlık ==='
insert into auth.users (id, email, phone, phone_confirmed_at, raw_user_meta_data)
values (:'s', 'degerlemeyayin@example.com', '+905558920001', now(),
        '{"full_name":"Kaya Deniz"}'::jsonb)
on conflict (id) do nothing;

set session role authenticated;
select set_config('test.uid', :'s', false);

\echo ''
\echo '=== 1) KARELER ÖNCE, DEĞERLEME SONRA → İLAN YAYINA GİRER ==='
-- Bu dosyanın varlık sebebi. Kareler onaylandığında değerleme henüz yok, kapı
-- haklı olarak geçirmiyor. Değerleme sonradan geliyor ve ESKİDEN kimse kapıyı
-- bir daha çalmıyordu.
select id from create_listing('Sonradan değerlenen', 'Oyun & Oyuncak', 'İyi durumda', 'M',
                              p_sub_category => 'Yapı & inşa') \gset a_
insert into product_photos (product_id, slot, storage_path)
select :'a_id', s, :'s' || '/' || :'a_id' || '/' || s || '.jpg'
  from unnest(array['front','back','left','right']::photo_slot[]) s;

reset role;
-- Kareler onaylanıyor: tetikleyici ateşlenir ama değerleme yok, geçmemeli.
update product_photos set moderation_status = 'approved' where product_id = :'a_id';
select bekle_esit('değerleme yokken taslakta kalır',
                  (select status from products where id = :'a_id'), 'DRAFT');

-- Şimdi değerleme geliyor. Yeni tetikleyici kapıyı çalmalı.
select degerleme_yaz(:'a_id', 1000, 'test', 0.9, 'test');
select bekle_esit('DEĞERLEME GELİNCE İLAN KENDİLİĞİNDEN YAYINA GİRER',
                  (select status from products where id = :'a_id'), 'ACTIVE');

\echo ''
\echo '=== 2) KAPI GEVŞEMİYOR — eksik kare değerlemeyle geçmez ==='
-- Tetikleyici kapıyı ÇALIYOR, açmıyor. Bu ayrım bozulursa değerleme tek
-- başına yayın bileti hâline gelir.
set session role authenticated;
select set_config('test.uid', :'s', false);
select id from create_listing('Eksik kareli', 'Oyun & Oyuncak', 'İyi durumda', 'M',
                              p_sub_category => 'Yapı & inşa') \gset b_
insert into product_photos (product_id, slot, storage_path)
select :'b_id', s, :'s' || '/' || :'b_id' || '/' || s || '.jpg'
  from unnest(array['front','back']::photo_slot[]) s;   -- dördü değil ikisi
reset role;
update product_photos set moderation_status = 'approved' where product_id = :'b_id';
select degerleme_yaz(:'b_id', 1000, 'test', 0.9, 'test');
select bekle_esit('eksik kareli ilan değerlemeye rağmen taslakta kalır',
                  (select status from products where id = :'b_id'), 'DRAFT');

\echo ''
\echo '=== 3) KAPI GEVŞEMİYOR — uygunsuz metin değerlemeyle geçmez ==='
set session role authenticated;
select set_config('test.uid', :'s', false);
select id from create_listing('Metni kötü', 'Oyun & Oyuncak', 'İyi durumda', 'M',
                              p_sub_category => 'Yapı & inşa') \gset c_
insert into product_photos (product_id, slot, storage_path)
select :'c_id', s, :'s' || '/' || :'c_id' || '/' || s || '.jpg'
  from unnest(array['front','back','left','right']::photo_slot[]) s;
reset role;
update product_photos set moderation_status = 'approved' where product_id = :'c_id';
select degerleme_yaz(:'c_id', 1000, 'test', 0.9, 'test', 1.0,
                     false, 'Açıklamada telefon numarası var.');
select bekle_esit('uygunsuz metinli ilan değerlemeye rağmen taslakta kalır',
                  (select status from products where id = :'c_id'), 'DRAFT');

\echo ''
\echo '=== 4) Yayındaki ilanın yeniden değerlenmesi bir şey bozmuyor ==='
-- Tetikleyici yalnızca DRAFT'a bakıyor. Bakmasaydı, yayındaki bir ilanın
-- puanı güncellendiğinde yayın akışı boşuna yeniden koşardı.
select degerleme_yaz(:'a_id', 1200, 'test', 0.9, 'test');
select bekle_esit('yayındaki ilan yayında kalır',
                  (select status from products where id = :'a_id'), 'ACTIVE');
select bekle_esit('yeni puan işlendi',
                  (select points from products where id = :'a_id'),
                  (round(1200 * puan_orani('İyi durumda', false, null) / 10) * 10)::integer);

\echo ''
\echo '=== 5) Sonsuz döngü yok ==='
-- Yayın akışı `products` satırını da güncelliyor; kilitsiz bırakılsaydı
-- tetikleyici kendini yeniden ateşlerdi. Buraya kadar gelebilmek zaten
-- döngü olmadığının kanıtı, ama iddiayı yazılı tutuyoruz.
select bekle('ilan tek kez yayına girdi ve durum tutarlı',
             (select status from products where id = :'a_id') = 'ACTIVE');
