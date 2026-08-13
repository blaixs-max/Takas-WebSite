-- KIDS TRADE — Ürün rezervasyonu testleri
--
-- En önemlisi 3 numaralı bölüm: aynı ürüne ikinci takas açılamamalı.

\set b1 '11111111-1111-1111-1111-111111111111'
\set b2 '44444444-4444-4444-4444-444444444444'
\set s  '22222222-2222-2222-2222-222222222222'

\echo ''
\echo '=== Hazırlık: iki alıcıya puan, satıcıya bir ilan ==='
select available_points from earn_points(:'b1', 1000, 'test:b1');
select available_points from earn_points(:'b2', 1000, 'test:b2');
insert into products (id, title, points, ai_suggested_points, condition, category,
                      location, image_key, seller_id, seller_name, seller_initials, size_class)
values ('rez-testi', 'Rezervasyon testi', 300, 300, 'İyi durumda', 'Oyun & Oyuncak',
        'Kadıköy', 'wooden-blocks', :'s', 'Satıcı', 'ST', 'S')
on conflict (id) do update set status = 'ACTIVE', points = 300;
select id, status from products where id = 'rez-testi';
\echo 'BEKLENEN: ACTIVE'

\echo ''
\echo '=== 1) Takas açılınca ilan REZERVE olur ve puan havuza girer ==='
select id, status, points from create_trade('rez-testi', :'b1') \gset t_
select status as ilan_durumu from products where id = 'rez-testi';
select available_points, held_points from wallets where user_id = :'b1';
\echo 'BEKLENEN: ilan RESERVED, alıcı 700 available / 300 held'

\echo ''
\echo '=== 2) İkinci alıcı AYNI ürüne takas açamaz ==='
do $$
begin
  perform create_trade('rez-testi', '44444444-4444-4444-4444-444444444444'::uuid);
  raise notice 'SONUÇ: HATA — ikinci takas açıldı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 3) Satıcı kendi ilanını alamaz (taze, ACTIVE bir ilanla) ==='
insert into products (id, title, points, ai_suggested_points, condition, category,
                      location, image_key, seller_id, seller_name, seller_initials, size_class)
values ('kendi-ilanim', 'Satıcının kendi ilanı', 100, 100, 'İyi durumda', 'Oyun & Oyuncak',
        'Kadıköy', 'wooden-blocks', :'s', 'Satıcı', 'ST', 'S')
on conflict (id) do update set status = 'ACTIVE';
do $$
begin
  perform create_trade('kendi-ilanim', '22222222-2222-2222-2222-222222222222'::uuid);
  raise notice 'SONUÇ: HATA — satıcı kendi ilanını aldı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 4) Var olmayan ürün ==='
do $$
begin
  perform create_trade('yok-boyle-bir-urun', '11111111-1111-1111-1111-111111111111'::uuid);
  raise notice 'SONUÇ: HATA — hayalet ürüne takas açıldı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 5) Takas tamamlanınca ilan SATILDI olur ==='
update trades set status = 'SHIPPED' where id = :'t_id';
select status from release_points(:'t_id');
select status as ilan_durumu from products where id = 'rez-testi';
\echo 'BEKLENEN: takas COMPLETED, ilan SOLD'

\echo ''
\echo '=== 6) İade edilen takasın ilanı vitrine döner ==='
insert into products (id, title, points, ai_suggested_points, condition, category,
                      location, image_key, seller_id, seller_name, seller_initials, size_class)
values ('iade-testi', 'İade testi', 200, 200, 'İyi durumda', 'Oyun & Oyuncak',
        'Kadıköy', 'wooden-blocks', :'s', 'Satıcı', 'ST', 'S')
on conflict (id) do update set status = 'ACTIVE', points = 200;
select id from create_trade('iade-testi', :'b2') \gset r_
select status as rezerve_mi from products where id = 'iade-testi';
select status from refund_points(:'r_id', 'test iadesi');
select status as iade_sonrasi from products where id = 'iade-testi';
\echo 'BEKLENEN: önce RESERVED, iadeden sonra ACTIVE'

\echo ''
\echo '=== 7) İade sonrası ürün yeniden satılabilir ==='
select id, status from create_trade('iade-testi', :'b1') \gset y_
\echo 'BEKLENEN: yeni takas açıldı (POINTS_HELD)'

\echo ''
\echo '=== 8) Yetersiz bakiyede hiçbir şey kalmaz ==='
insert into products (id, title, points, ai_suggested_points, condition, category,
                      location, image_key, seller_id, seller_name, seller_initials, size_class)
values ('pahali', 'Çok pahalı ürün', 99999, 99999, 'İyi durumda', 'Oyun & Oyuncak',
        'Kadıköy', 'wooden-blocks', :'s', 'Satıcı', 'ST', 'S')
on conflict (id) do update set status = 'ACTIVE', points = 99999;
do $$
begin
  perform create_trade('pahali', '11111111-1111-1111-1111-111111111111'::uuid);
  raise notice 'SONUÇ: HATA — bakiyesiz takas açıldı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
select status as ilan_durumu from products where id = 'pahali';
select count(*) as acilan_takas from trades where product_id = 'pahali';
\echo 'BEKLENEN: ilan ACTIVE kaldı, açılan takas 0 — işlem tümüyle geri sarıldı'

\echo ''
\echo '=== 9) Takası olan ilan silinemez ==='
do $$
begin
  delete from products where id = 'rez-testi';
  raise notice 'SONUÇ: HATA — takası olan ilan silindi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
