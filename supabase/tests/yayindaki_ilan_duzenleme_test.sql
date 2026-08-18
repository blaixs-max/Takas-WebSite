-- ELDENELE — Yayındaki ilan düzenleme
--
-- Tamamı `bekle`/`bekle_esit` ile: iddia tutmazsa test düşer.
--
-- Kritik iddialar: 2 (PUAN DEĞİŞMİYOR — yayındaki ilanın fiyatı alıcının
-- altından çekilemez) ve 3-6 (kilitli alanlar gerçekten kilitli). Taslak
-- davranışının bozulmadığını 7 kolluyor: orada her şey açık ve değerleme
-- hâlâ bayatlıyor.

\set s 'aa88aa88-0000-0000-0000-000000030001'
\set y 'aa88aa88-0000-0000-0000-000000030002'

\echo ''
\echo '=== Hazırlık: yayında bir ilan ==='
insert into auth.users (id, email, phone, phone_confirmed_at, raw_user_meta_data)
values (:'s', 'duzenle@example.com', '+905559300001', now(), '{"full_name":"Ece Yıldız"}'::jsonb),
       (:'y', 'duzenle-yabanci@example.com', '+905559300002', now(), '{}'::jsonb)
on conflict (id) do nothing;

set session role authenticated;
select set_config('test.uid', :'s', false);

select id from create_listing('Yayındaki ürün', 'Oyun & Oyuncak', 'İyi durumda', 'M',
                              p_sub_category => 'Yapı & inşa') \gset a_
insert into product_photos (product_id, slot, storage_path)
select :'a_id', s, :'s' || '/' || :'a_id' || '/' || s || '.jpg'
  from unnest(array['front','back','left','right']::photo_slot[]) s;
reset role;
update product_photos set moderation_status = 'approved' where product_id = :'a_id';
select test_degerle(:'a_id', 900);
set session role authenticated;
select set_config('test.uid', :'s', false);
select publish_listing(:'a_id', 'front');
select set_config('test.pid', :'a_id', false);
select bekle_esit('ilan yayında', (select status from products where id = :'a_id'), 'ACTIVE');

\echo ''
\echo '=== 1) Başlık, açıklama ve konum düzenlenebiliyor ==='
select update_listing(:'a_id', 'Yeni başlık', 'Oyun & Oyuncak', 'İyi durumda', 'M',
                      'Kadıköy, İstanbul', 'Yeni açıklama', false, false, 'Yapı & inşa');
select bekle_esit('başlık değişti',
                  (select title from products where id = :'a_id'), 'Yeni başlık');
select bekle_esit('açıklama değişti',
                  (select description from products where id = :'a_id'), 'Yeni açıklama');
select bekle_esit('konum değişti',
                  (select location from products where id = :'a_id'), 'Kadıköy, İstanbul');
select bekle_esit('ilan hâlâ yayında',
                  (select status from products where id = :'a_id'), 'ACTIVE');

\echo ''
\echo '=== 2) PUAN VE DEĞERLEME DEĞİŞMİYOR ==='
-- Bu dosyanın varlık sebebi. Taslakta başlık değişince değerleme bayatlıyor
-- ve puan siliniyor; yayında bu yol kapalı olmalı. Açık olsaydı ilan puansız
-- bir ACTIVE'e düşerdi — yayın kapısının hiçbir zaman geçirmeyeceği durum,
-- çünkü kapı yalnızca girişte bakıyor.
select bekle_esit('puan korundu', (select points from products where id = :'a_id'), 900);
select bekle('değerleme damgası duruyor',
             (select degerleme_at is not null from products where id = :'a_id'));
select bekle('sıfır fiyat duruyor',
             (select sifir_fiyat is not null from products where id = :'a_id'));

\echo ''
\echo '=== 3) KONDİSYON KİLİTLİ ==='
-- Alıcının ana güven sinyali ve puanı besliyor. Değiştirip puanı sabit
-- bırakmak ilanı olduğundan başka göstermek olurdu.
do $$
begin
  perform update_listing(current_setting('test.pid'), 'Yeni başlık', 'Oyun & Oyuncak',
                         'Yeni gibi', 'M', 'Kadıköy, İstanbul', 'Yeni açıklama',
                         false, false, 'Yapı & inşa');
  raise notice 'SONUÇ: HATA — yayındaki ilanın kondisyonu değişti';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
select bekle_esit('kondisyon değişmedi',
                  (select condition from products where id = :'a_id'), 'İyi durumda');

\echo ''
\echo '=== 4) KATEGORİ KİLİTLİ ==='
do $$
begin
  perform update_listing(current_setting('test.pid'), 'Yeni başlık', 'Bakım & Güvenlik',
                         'İyi durumda', 'M', 'Kadıköy, İstanbul', 'Yeni açıklama',
                         false, false, 'Ev güvenliği');
  raise notice 'SONUÇ: HATA — yayındaki ilanın kategorisi değişti';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
select bekle_esit('kategori değişmedi',
                  (select category from products where id = :'a_id'), 'Oyun & Oyuncak');

\echo ''
\echo '=== 5) DESİ KİLİTLİ — kargo bedelini o belirliyor ==='
do $$
begin
  perform update_listing(current_setting('test.pid'), 'Yeni başlık', 'Oyun & Oyuncak',
                         'İyi durumda', 'L', 'Kadıköy, İstanbul', 'Yeni açıklama',
                         false, false, 'Yapı & inşa');
  raise notice 'SONUÇ: HATA — yayındaki ilanın desisi değişti';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
select bekle_esit('desi değişmedi',
                  (select size_class from products where id = :'a_id'), 'M');

\echo ''
\echo '=== 6) Yabancı düzenleyemiyor ==='
-- "Senin değil" değil "bulunamadı": ikincisi geçerli bir ilan kimliğini
-- doğrulamak olurdu.
select set_config('test.uid', :'y', false);
do $$
begin
  perform update_listing(current_setting('test.pid'), 'Ele geçirildi', 'Oyun & Oyuncak',
                         'İyi durumda', 'M', 'Kadıköy, İstanbul', null,
                         false, false, 'Yapı & inşa');
  raise notice 'SONUÇ: HATA — yabancı düzenledi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
select set_config('test.uid', :'s', false);
select bekle_esit('başlık yabancıdan korundu',
                  (select title from products where id = :'a_id'), 'Yeni başlık');

\echo ''
\echo '=== 7) TASLAK DAVRANIŞI BOZULMADI ==='
-- Taslakta her şey açık ve değerlemeyi besleyen alan değişince puan
-- siliniyor. Yayın kuralı eklenirken bu yolun kırılmamış olması gerekiyor.
select id from create_listing('Taslak ürün', 'Oyun & Oyuncak', 'İyi durumda', 'M',
                              p_sub_category => 'Yapı & inşa') \gset t_
reset role;
select test_degerle(:'t_id', 700);
set session role authenticated;
select set_config('test.uid', :'s', false);
select bekle_esit('taslak değerlendi', (select points from products where id = :'t_id'), 700);

select update_listing(:'t_id', 'Taslak ürün', 'Oyun & Oyuncak', 'Yeni gibi', 'L',
                      'İzmit, Kocaeli', 'başka açıklama', false, false, 'Yapı & inşa');
select bekle_esit('taslakta kondisyon değişebiliyor',
                  (select condition from products where id = :'t_id'), 'Yeni gibi');
select bekle_esit('taslakta desi değişebiliyor',
                  (select size_class from products where id = :'t_id'), 'L');
select bekle('değerleme bayatladı — puan silindi',
             (select points is null from products where id = :'t_id'));
select bekle('değerleme damgası silindi',
             (select degerleme_at is null from products where id = :'t_id'));
