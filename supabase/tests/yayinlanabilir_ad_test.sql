-- ELDENELE — E-posta türevi ad yayına çıkmıyor
--
-- Canlıda `kmerdem@gmail.com` ilanı uygulamada "kmerdem" gösterdi: kişinin
-- e-postasının yarısı, bütün kullanıcılara açık. `yayinlanabilir_ad` bunu
-- "Üye"ye çeviriyor; `create_listing` süzgeci uyguluyor.
--
-- (2026-09-08'e kadar `engel_uyari_test.sql`in 6/6b bölümüydü. O dosyanın
-- geri kalanı yapay zekâ denetiminin engel/uyarı ayrımını sınıyordu ve
-- denetim kalkınca anlamsızlaştı; bu iki bölüm konudan bağımsız.)

\echo ''
\echo '=== 1) E-POSTA TÜREVİ AD YAYINA ÇIKMIYOR ==='
select bekle_esit('e-posta türevi ad Üye olur', yayinlanabilir_ad('kmerdem'), 'Üye');
select bekle_esit('küçük harfli tek kelime Üye olur', yayinlanabilir_ad('ayşe'), 'Üye');
select bekle_esit('noktalı kullanıcı adı Üye olur', yayinlanabilir_ad('k.merdem'), 'Üye');
select bekle_esit('boş ad Üye olur', yayinlanabilir_ad(''), 'Üye');
select bekle_esit('gerçek tam ad korunur', yayinlanabilir_ad('Zeynep Demir'), 'Zeynep Demir');
select bekle_esit('büyük harfli tek ad korunur', yayinlanabilir_ad('Ayşe'), 'Ayşe');

\echo ''
\echo '=== 2) create_listing süzgeci uyguluyor ==='
-- Profilinde adı olmayan kullanıcı: ham ad e-postadan türerdi.
\set e 'ee55ee55-0000-0000-0000-00000000b002'
insert into auth.users (id, email, phone, phone_confirmed_at)
values (:'e', 'kmerdemtest@example.com', '+905558880002', now())
on conflict (id) do nothing;
set session role authenticated;
select set_config('test.uid', :'e', false);
select id from create_listing('Adsız kullanıcının ürünü', 'Oyun & Oyuncak', 'İyi durumda', 'M',
                              p_sub_category => 'Yapı & inşa') \gset a_
select bekle_esit('adsız kullanıcı Üye olarak yazılır',
                  (select seller_name from products where id = :'a_id'), 'Üye');
select bekle_esit('baş harfler yayınlanan addan türer',
                  (select seller_initials from products where id = :'a_id'), 'ÜÜ');
reset role;
