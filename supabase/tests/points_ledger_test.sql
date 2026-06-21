\set b '11111111-1111-1111-1111-111111111111'
\set s '22222222-2222-2222-2222-222222222222'

\echo '=== 1) Alıcı 500 puan kazanır ==='
select available_points, held_points from earn_points(:'b', 500);

\echo '=== 2) Takas oluştur (340 puan) ve havuza al (HOLD) ==='
insert into trades(id, buyer_id, seller_id, product_id, points)
  values ('aaaaaaaa-0000-0000-0000-000000000001', :'b', :'s', 'rings', 340);
select status from hold_points('aaaaaaaa-0000-0000-0000-000000000001');
\echo 'Alıcı cüzdanı (available 160 / held 340 bekleniyor):'
select available_points, held_points from wallets where user_id = :'b';

\echo '=== 3) Kargo ödendi: SHIPPED, sonra teslim onayı (RELEASE) ==='
update trades set status='SHIPPED' where id='aaaaaaaa-0000-0000-0000-000000000001';
select status from release_points('aaaaaaaa-0000-0000-0000-000000000001');
\echo 'Alıcı (available 160 / held 0) ve Satıcı (available 340) bekleniyor:'
select 'buyer' as kim, available_points, held_points from wallets where user_id=:'b'
union all select 'seller', available_points, held_points from wallets where user_id=:'s';

\echo '=== 4) İkinci takas + REFUND (iade) ==='
insert into trades(id, buyer_id, seller_id, product_id, points)
  values ('aaaaaaaa-0000-0000-0000-000000000002', :'b', :'s', 'blocks', 100);
select status from hold_points('aaaaaaaa-0000-0000-0000-000000000002');
select status from refund_points('aaaaaaaa-0000-0000-0000-000000000002', 'Ürün beyana uymadı');
\echo 'Alıcı available 160 / held 0 (iade geri döndü) bekleniyor:'
select available_points, held_points from wallets where user_id=:'b';

\echo '=== 5) NEGATİF BAKİYE ENGELİ: 160 puan varken 999 hold denemesi (HATA bekleniyor) ==='
insert into trades(id, buyer_id, seller_id, product_id, points)
  values ('aaaaaaaa-0000-0000-0000-000000000003', :'b', :'s', 'expensive', 999);
\set ON_ERROR_STOP 0
select status from hold_points('aaaaaaaa-0000-0000-0000-000000000003');
\set ON_ERROR_STOP 1

\echo '=== 6) ÇİFT HARCAMA/İDEMPOTENCY ENGELİ: tamamlanmış takası tekrar release (HATA bekleniyor) ==='
\set ON_ERROR_STOP 0
select status from release_points('aaaaaaaa-0000-0000-0000-000000000001');
\set ON_ERROR_STOP 1

\echo '=== 7) Defter tutarlılığı: tüm hareketler ==='
select user_id, type, amount, available_after, held_after from wallet_entries order by id;

\echo '=== 8) Çift-giriş kontrolü: toplam available+held korunuyor mu? ==='
select sum(available_points+held_points) as toplam_puan_sistemde from wallets;
