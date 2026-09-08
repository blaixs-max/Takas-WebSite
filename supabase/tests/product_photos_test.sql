-- ELDENELE — Yedi kare ve yayın kapısı
--
-- Kapı iki parça (2026-09-08): satıcı `submit_listing` ile onaya gönderir,
-- yönetici `ilan_onayla` ile yayına alır. İkisi de fiziksel gerçeklere bakar:
-- zorunlu kare eksikse ya da reddedilmiş zorunlu kare varsa ilan ne onaya
-- gider ne vitrine çıkar. En kritik iddialar 5 (onaya gönderilen ilan vitrine
-- ÇIKMAZ — inceleme bir ara durak, kapı değil) ve 6c (kullanıcı kendi karesini
-- onaylayamaz).

\set s '22222222-2222-2222-2222-222222222222'
\set b '11111111-1111-1111-1111-111111111111'

\echo ''
\echo '=== Hazırlık ==='
insert into auth.users (id, email, raw_user_meta_data)
values (:'s', 'zeynep@example.com', '{"full_name":"Zeynep Demir"}'::jsonb),
       (:'b', 'alici@example.com', '{}'::jsonb)
on conflict (id) do nothing;

set session role authenticated;
select set_config('test.uid', :'s', false);

\echo ''
\echo '=== 1) Yeni ilan TASLAK açılır, vitrine çıkmaz ==='
select id, status from create_listing('Ahşap tren', 'Oyun & Oyuncak', 'Az kullanılmış', 'M', p_sub_category => 'Yapı & inşa') \gset p_
select bekle_esit('yeni ilan DRAFT açılır',
                  (select status from products where id = :'p_id'), 'DRAFT');
select set_config('test.pid', :'p_id', false);

\echo ''
\echo '=== 2) Dört zorunlu kare — hasarsız, set değil ==='
reset role;
select bekle_esit('beyansız ilanda zorunlu slotlar',
                  array_to_string(required_slots(:'p_id'), ', '),
                  'front, back, left, right');
set session role authenticated;

\echo ''
\echo '=== 3) Kare eksikken onaya gönderilemez ==='
do $$
declare pid text := current_setting('test.pid');
begin
  perform submit_listing(pid);
  raise notice 'SONUÇ: HATA — karesiz ilan onaya gitti';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
select bekle_esit('ilan taslakta kaldı', (select status from products where id = :'p_id'), 'DRAFT');

\echo ''
\echo '=== 4) Kareler yüklendi, hepsi incelemeyi bekliyor ==='
insert into product_photos (product_id, slot, storage_path) values
  (:'p_id', 'front', :'s' || '/' || :'p_id' || '/front.jpg'),
  (:'p_id', 'back',  :'s' || '/' || :'p_id' || '/back.jpg'),
  (:'p_id', 'left',  :'s' || '/' || :'p_id' || '/left.jpg'),
  (:'p_id', 'right', :'s' || '/' || :'p_id' || '/right.jpg'),
  (:'p_id', 'label', :'s' || '/' || :'p_id' || '/label.jpg');
select bekle_esit('beş kare yüklendi',
                  (select count(*) from product_photos where product_id = :'p_id'), 5::bigint);
select bekle_esit('hepsi incelemeyi bekliyor',
                  (select count(*) from product_photos
                    where product_id = :'p_id' and moderation_status = 'pending'), 5::bigint);

\echo ''
\echo '=== 5) ONAYA GÖNDERİLEN İLAN VİTRİNE ÇIKMAZ ==='
-- Bekleyen kareyle onaya gidilebilir — kararı yönetici verecek — ama bu bir
-- yayın değil. Vitrin yalnızca ACTIVE'i gösterir; incelemedeki ilan orada yok.
select status from submit_listing(:'p_id');
select bekle_esit('ilan incelemede', (select status from products where id = :'p_id'), 'IN_REVIEW');
select bekle('gönderim damgası var', (select submitted_at is not null from products where id = :'p_id'));
select bekle_esit('kareler hâlâ pending — onaya gitmek onay değil',
                  (select count(*) from product_photos
                    where product_id = :'p_id' and moderation_status = 'pending'), 5::bigint);
-- Yabancı bir alıcı vitrine bakıyor: ilan yok.
select set_config('test.uid', :'b', false);
select bekle_esit('incelemedeki ilan başkasına görünmez',
                  (select count(*) from products where id = :'p_id'), 0::bigint);
select set_config('test.uid', :'s', false);
-- Satıcı incelemedeki ilanı düzenleyemez.
do $$
declare pid text := current_setting('test.pid');
begin
  perform update_listing(pid, 'Değişti', 'Oyun & Oyuncak', 'Az kullanılmış', 'M',
                         p_sub_category => 'Yapı & inşa');
  raise notice 'SONUÇ: HATA — incelemedeki ilan düzenlendi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
-- Geri çekince taslağa döner.
select status from withdraw_listing(:'p_id');
select bekle_esit('geri çekilen ilan taslak', (select status from products where id = :'p_id'), 'DRAFT');

\echo ''
\echo '=== 6) Reddedilen ZORUNLU kare onaya gitmeyi de engeller ==='
reset role;
update product_photos set moderation_status = 'approved' where product_id = :'p_id';
update product_photos set moderation_status = 'rejected', moderation_reason = 'bulanık'
 where product_id = :'p_id' and slot = 'back';
set session role authenticated;
select set_config('test.uid', :'s', false);
do $$
declare pid text := current_setting('test.pid');
begin
  perform submit_listing(pid);
  raise notice 'SONUÇ: HATA — reddedilen zorunlu kareyle onaya gitti';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
select bekle_esit('ilan taslakta', (select status from products where id = :'p_id'), 'DRAFT');

\echo ''
\echo '=== 6b) ZORUNLU OLMAYAN slottaki ret yayını kilitlemez ==='
-- Canlıda çıkan çıkmaz (2026-08-17): etiket karesi reddedilince ilan kalıcı
-- olarak yayına alınamıyordu. Etiket zorunlu değil; kapı reddedilmiş zorunsuz
-- kareyi siliyor — yok sayıp bırakmak, galeriyi silinmiş bir dosyaya
-- baktırırdı.
reset role;
update product_photos set moderation_status = 'approved' where product_id = :'p_id';
update product_photos set moderation_status = 'rejected', moderation_reason = 'sigara paketi'
 where product_id = :'p_id' and slot = 'label';
set session role authenticated;
select set_config('test.uid', :'s', false);
select test_yayinla(:'p_id');
select bekle_esit('zorunsuz slottaki ret yayını kilitlemez',
                  (select status from products where id = :'p_id'), 'ACTIVE');
select bekle_esit('reddedilen zorunsuz kare satırı silinir',
                  (select count(*) from product_photos
                    where product_id = :'p_id' and slot = 'label'), 0::bigint);

\echo ''
\echo '=== 6c) Kullanıcı kendi karesini onaylayamaz ==='
-- UPDATE politikası satırı açıyor ama hangi kolonun değişebileceğini
-- söyleyemiyor; sınır tetikleyicide. Bu iddia düşerse denetimin tamamı süs olur.
select id from create_listing('Onay denemesi', 'Oyun & Oyuncak', 'İyi durumda', 'S',
                              p_sub_category => 'Yapı & inşa') \gset o_
insert into product_photos (product_id, slot, storage_path)
values (:'o_id', 'front', :'s' || '/' || :'o_id' || '/front.jpg');
update product_photos set moderation_status = 'approved'
 where product_id = :'o_id' and slot = 'front';
select bekle_esit('kullanıcı kendi karesini onaylayamaz',
                  (select moderation_status from product_photos
                    where product_id = :'o_id' and slot = 'front'), 'pending');

\echo ''
\echo '=== 7) Onaylanan ilan yayına girer, kareleri onaylanır, kapak işaretlenir ==='
select id from create_listing('Kapak denemesi', 'Oyun & Oyuncak', 'İyi durumda', 'S',
                              p_sub_category => 'Yapı & inşa') \gset kap_
insert into product_photos (product_id, slot, storage_path)
select :'kap_id', s, :'s' || '/' || :'kap_id' || '/' || s || '.jpg'
  from unnest(array['front','back','left','right']::photo_slot[]) s;
select test_yayinla(:'kap_id');
select bekle_esit('onaylanan ilan yayına girer',
                  (select status from products where id = :'kap_id'), 'ACTIVE');
select bekle_esit('onay bekleyen kareleri onaylı yapar',
                  (select count(*) from product_photos
                    where product_id = :'kap_id' and moderation_status = 'approved'), 4::bigint);
select bekle_esit('kapak front işaretlenir',
                  (select slot::text from product_photos
                    where product_id = :'kap_id' and is_cover), 'front');

\echo ''
\echo '=== 8) Hasar beyanı beşinci kareyi zorunlu yapar ==='
select id from create_listing('Hasarlı ürün', 'Oyun & Oyuncak', 'İyi durumda', 'S',
                              'Kadıköy', null, true, false, p_sub_category => 'Yapı & inşa') \gset h_
create temp table if not exists t_ids (ad text primary key, deger text);
insert into t_ids values ('hasarli', :'h_id') on conflict (ad) do update set deger = excluded.deger;
reset role;
select bekle_esit('hasar beyanı damage karesini zorunlu yapar',
                  array_to_string(required_slots(:'h_id'), ', '),
                  'front, back, left, right, damage');
set session role authenticated;

\echo ''
\echo '=== 9) Set beyanı parça karesini zorunlu yapar ==='
select id from create_listing('Set ürün', 'Oyun & Oyuncak', 'İyi durumda', 'S',
                              'Kadıköy', null, false, true, p_sub_category => 'Yapı & inşa') \gset k_
reset role;
select bekle_esit('set beyanı parts karesini zorunlu yapar',
                  array_to_string(required_slots(:'k_id'), ', '),
                  'front, back, left, right, parts');
set session role authenticated;

\echo ''
\echo '=== 10) Başkasının ilanı onaya gönderilemez ==='
select set_config('test.uid', :'b', false);
do $$
declare pid text;
begin
  select deger into pid from t_ids where ad = 'hasarli';
  perform submit_listing(pid);
  raise notice 'SONUÇ: HATA — yabancı ilanı onaya gönderdi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 11) Taslak ilan vitrinde görünmez ==='
select set_config('test.uid', :'s', false);
select id from create_listing('Vitrin dışı taslak', 'Oyun & Oyuncak', 'İyi durumda', 'S',
                              p_sub_category => 'Yapı & inşa') \gset v_
select bekle('yeni taslak vitrinde görünmez',
             not exists (select 1 from products
                          where id = :'v_id' and status = 'ACTIVE'));
select bekle('yayına alınan ilan vitrinde görünür',
             exists (select 1 from products
                      where id = :'kap_id' and status = 'ACTIVE'));

reset role;
