-- KIDS TRADE — İlan fiyat kilidi testleri
--
-- Satıcı oturumu taklit edilir (test.uid ayarlanır, rol authenticated yapılır),
-- sonra fiyatı yükseltmeye çalışılır. Her bölüm beklenen sonucu yazdırır.

\set seller '22222222-2222-2222-2222-222222222222'

\echo ''
\echo '=== Hazırlık: satıcıya ait bir ilan ==='
insert into products (id, title, points, ai_suggested_points, condition, category,
                      location, image_key, seller_id, seller_name, seller_initials, size_class)
values ('test-urun', 'Test ürünü', 260, 260, 'İyi durumda', 'Oyun & Oyuncak',
        'Kadıköy', 'wooden-blocks', :'seller', 'Test Satıcı', 'TS', 'S')
on conflict (id) do update set points = 260, ai_suggested_points = 260, status = 'ACTIVE';
select id, points, status from products where id = 'test-urun';

-- Bundan sonrası satıcının kendi oturumu
set session role authenticated;
select set_config('test.uid', :'seller', false);

\echo ''
\echo '=== 1) Satıcı fiyatı doğrudan YÜKSELTEMEZ ==='
do $$
begin
  update products set points = 999999 where id = 'test-urun';
  raise notice 'SONUÇ: HATA — fiyat yükseltildi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 2) Satıcı durumu doğrudan değiştiremez ==='
do $$
begin
  update products set status = 'ACTIVE' , title = 'x' where id = 'test-urun';
  raise notice 'SONUÇ: başlık değişti, durum aynı kaldı — beklenen';
exception when others then
  raise notice 'SONUÇ: % ', sqlerrm;
end $$;
do $$
begin
  update products set status = 'REMOVED' where id = 'test-urun';
  raise notice 'SONUÇ: HATA — durum değiştirildi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 3) RPC ile fiyat AŞAĞI çekilebilir ==='
select points as yeni_puan from set_product_points('test-urun', 200);
\echo 'BEKLENEN: 200'

\echo ''
\echo '=== 4) RPC ile fiyat YUKARI çekilemez ==='
do $$
begin
  perform set_product_points('test-urun', 500);
  raise notice 'SONUÇ: HATA — yukarı çekildi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 5) Başkasının ilanına dokunulamaz ==='
select set_config('test.uid', '33333333-3333-3333-3333-333333333333', false);
do $$
begin
  perform set_product_points('test-urun', 100);
  raise notice 'SONUÇ: HATA — yabancı fiyat değiştirdi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

reset role;
\echo ''
\echo '=== 6) Son durum ==='
select id, points, ai_suggested_points, status from products where id = 'test-urun';
\echo 'BEKLENEN: points 200, ai_suggested_points 260, status ACTIVE'
