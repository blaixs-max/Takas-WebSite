-- ELDENELE — İlan puan kilidi
--
-- Puanı yönetici belirliyor (2026-09-08). Satıcının puana dokunabildiği hiçbir
-- yol kalmamalı: ne doğrudan güncelleme, ne RPC. Satıcı oturumu taklit edilir
-- ve her yol denenir.

\set seller '22222222-2222-2222-2222-222222222222'

\echo ''
\echo '=== Hazırlık: satıcıya ait yayında bir ilan ==='
insert into products (id, title, points, ai_suggested_points, condition, category,
                      location, image_key, seller_id, seller_name, seller_initials, size_class)
values ('test-urun', 'Test ürünü', 260, 260, 'İyi durumda', 'Oyun & Oyuncak',
        'Kadıköy', 'wooden-blocks', :'seller', 'Test Satıcı', 'TS', 'S')
on conflict (id) do update set points = 260, ai_suggested_points = 260, status = 'ACTIVE';

set session role authenticated;
select set_config('test.uid', :'seller', false);

\echo ''
\echo '=== 1) Satıcı puanı doğrudan YÜKSELTEMEZ ==='
do $$
begin
  update products set points = 999999 where id = 'test-urun';
  raise notice 'SONUÇ: HATA — puan yükseltildi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 1b) ...ve DÜŞÜREMEZ de ==='
-- Eskiden `set_product_points` ile modelin önerisinin altına inilebiliyordu.
-- Puanı yönetici belirlediği için o yol da kapandı: satıcı fiyatı beğenmezse
-- ilanı geri çekip yöneticiye not düşer.
do $$
begin
  update products set points = 100 where id = 'test-urun';
  raise notice 'SONUÇ: HATA — puan düşürüldü';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 2) Satıcı durumu doğrudan değiştiremez ==='
do $$
begin
  update products set status = 'REMOVED' where id = 'test-urun';
  raise notice 'SONUÇ: HATA — durum değiştirildi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 3) PUAN RPC''Sİ İSTEMCİYE KAPALI ==='
select bekle('set_product_points authenticated''a kapalı',
             not has_function_privilege('authenticated',
               'public.set_product_points(text, integer)', 'execute'));
do $$
begin
  perform set_product_points('test-urun', 200);
  raise notice 'SONUÇ: HATA — RPC ile puan değişti';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

reset role;
\echo ''
\echo '=== 4) Son durum: hiçbir şey değişmedi ==='
select bekle_esit('puan 260 kaldı',
                  (select points from products where id = 'test-urun'), 260);
select bekle_esit('durum ACTIVE kaldı',
                  (select status from products where id = 'test-urun'), 'ACTIVE');
