-- ELDENELE — Engel / uyarı ayrımı, metin denetimi, e-posta türevi ad
--
-- Tamamı `bekle`/`bekle_esit` ile: iddia tutmazsa test düşer.
--
-- Kritik iddialar: 2 (uyarılı kare yayını DURDURMUYOR — bu ayrımın tamamı),
-- 3 (uygunsuz metin yayını durduruyor) ve 6 (e-postadan türeyen ad yayına
-- çıkmıyor).

\set s 'ee55ee55-0000-0000-0000-00000000b001'

\echo ''
\echo '=== Hazırlık ==='
insert into auth.users (id, email, phone, phone_confirmed_at, raw_user_meta_data)
values (:'s', 'engeluyari@example.com', '+905558880001', now(),
        '{"full_name":"Selin Kaya"}'::jsonb)
on conflict (id) do nothing;

set session role authenticated;
select set_config('test.uid', :'s', false);

\echo ''
\echo '=== 1) Uyarı kolonu ret gerekçesinden ayrı ==='
-- İkisi aynı alanda tutulsaydı "reddedildi mi geçti mi" sorusu metne bakmayı
-- gerektirirdi. Ayrı kolon, ayrı anlam.
select bekle('product_photos.uyari kolonu var',
             exists (select 1 from information_schema.columns
                      where table_name = 'product_photos' and column_name = 'uyari'));

\echo ''
\echo '=== 2) UYARILI KARE YAYINI DURDURMUYOR ==='
-- Bu dosyanın varlık sebebi. Kare `approved` ama bir notu var; ilan yayına
-- girmeli. Durdursaydı "uyarı" demenin bir anlamı kalmazdı.
select id from create_listing('Uyarılı ürün', 'Oyun & Oyuncak', 'İyi durumda', 'M',
                              p_sub_category => 'Yapı & inşa') \gset u_
insert into product_photos (product_id, slot, storage_path)
select :'u_id', s, :'s' || '/' || :'u_id' || '/' || s || '.jpg'
  from unnest(array['front','back','left','right']::photo_slot[]) s;
reset role;
update product_photos set moderation_status = 'approved' where product_id = :'u_id';
update product_photos set uyari = 'Görsel beklenen sol profili göstermiyor.'
 where product_id = :'u_id' and slot = 'left';
set session role authenticated;
select set_config('test.uid', :'s', false);
select test_degerle(:'u_id', 400);
select publish_listing(:'u_id', 'front');
select bekle_esit('uyarılı kare yayını engellemez',
                  (select status from products where id = :'u_id'), 'ACTIVE');
select bekle('uyarı metni korunuyor',
             (select uyari is not null from product_photos
               where product_id = :'u_id' and slot = 'left'));

\echo ''
\echo '=== 3) UYGUNSUZ METİN YAYINI DURDURUYOR ==='
-- Metin bir tur boyunca hiç denetlenmiyordu: küfür, telefon numarası, dış
-- bağlantı — fotoğraflar temizse hepsi yayına giriyordu.
select id from create_listing('Metni kötü ürün', 'Oyun & Oyuncak', 'İyi durumda', 'M',
                              p_sub_category => 'Yapı & inşa') \gset m_
insert into product_photos (product_id, slot, storage_path)
select :'m_id', s, :'s' || '/' || :'m_id' || '/' || s || '.jpg'
  from unnest(array['front','back','left','right']::photo_slot[]) s;
reset role;
update product_photos set moderation_status = 'approved' where product_id = :'m_id';
select degerleme_yaz(:'m_id', 1000, 'test', 0.9, 'test', 1.0,
                     false, 'Açıklamada telefon numarası var.');
set session role authenticated;
select set_config('test.uid', :'s', false);
select set_config('test.pid', :'m_id', false);
do $$
declare pid text := current_setting('test.pid');
begin
  perform publish_listing(pid, 'front');
  raise notice 'SONUÇ: HATA — uygunsuz metinle yayına girdi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
select bekle_esit('uygunsuz metinli ilan taslakta kalır',
                  (select status from products where id = :'m_id'), 'DRAFT');

\echo ''
\echo '=== 4) Metin denetlenmemişse (null) yayın durmuyor ==='
-- `null` "denetlenmedi" demek. Değerleme hiç çalışmadıysa zaten degerleme_at
-- kontrolüne takılır; aynı şeyi iki kez söylemek gereksiz.
select id from create_listing('Metni denetlenmemiş', 'Oyun & Oyuncak', 'İyi durumda', 'M',
                              p_sub_category => 'Yapı & inşa') \gset n_
insert into product_photos (product_id, slot, storage_path)
select :'n_id', s, :'s' || '/' || :'n_id' || '/' || s || '.jpg'
  from unnest(array['front','back','left','right']::photo_slot[]) s;
reset role;
update product_photos set moderation_status = 'approved' where product_id = :'n_id';
set session role authenticated;
select set_config('test.uid', :'s', false);
select test_degerle(:'n_id', 400);
select bekle('metin kararı null',
             (select metin_uygun is null from products where id = :'n_id'));
select publish_listing(:'n_id', 'front');
select bekle_esit('denetlenmemiş metin yayını engellemez',
                  (select status from products where id = :'n_id'), 'ACTIVE');

\echo ''
\echo '=== 5) Metin kararı sonraki değerlemede silinmiyor ==='
-- `coalesce` ile korunuyor: model o alanı vermezse önceki karar durmalı.
-- Sessizce null'a düşmek "denetlenmedi" demek olurdu ve kapı geçirirdi.
reset role;
select degerleme_yaz(:'m_id', 1200, 'test', 0.9, 'test', 1.0, null, null);
set session role authenticated;
select set_config('test.uid', :'s', false);
select bekle_esit('metin kararı korunur',
                  (select metin_uygun from products where id = :'m_id'), false);

\echo ''
\echo '=== 6) E-POSTA TÜREVİ AD YAYINA ÇIKMIYOR ==='
-- Canlıda `kmerdem@gmail.com` ilanı uygulamada "kmerdem" gösterdi: kişinin
-- e-postasının yarısı, bütün kullanıcılara açık.
select bekle_esit('e-posta türevi ad Üye olur', yayinlanabilir_ad('kmerdem'), 'Üye');
select bekle_esit('küçük harfli tek kelime Üye olur', yayinlanabilir_ad('ayşe'), 'Üye');
select bekle_esit('noktalı kullanıcı adı Üye olur', yayinlanabilir_ad('k.merdem'), 'Üye');
select bekle_esit('boş ad Üye olur', yayinlanabilir_ad(''), 'Üye');
select bekle_esit('gerçek tam ad korunur', yayinlanabilir_ad('Zeynep Demir'), 'Zeynep Demir');
select bekle_esit('büyük harfli tek ad korunur', yayinlanabilir_ad('Ayşe'), 'Ayşe');

\echo ''
\echo '=== 6b) create_listing süzgeci uyguluyor ==='
-- Profilinde adı olmayan kullanıcı: ham ad e-postadan türerdi.
\set e 'ee55ee55-0000-0000-0000-00000000b002'
-- `auth.users`'a yazmak yönetici işi; test bu noktada `authenticated` rolünde.
reset role;
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
