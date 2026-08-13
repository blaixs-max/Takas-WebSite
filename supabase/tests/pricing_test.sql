-- KIDS TRADE — Sunucu tarafı fiyatlandırma testleri
-- Ana Doküman v1.1 Bölüm 3.4'teki örnek hesabın koddan da aynı çıktığını gösterir.

\set b '11111111-1111-1111-1111-111111111111'
\set s '22222222-2222-2222-2222-222222222222'

\echo ''
\echo '=== Tarife tablosu ==='
select size_class, desi_min, desi_max, carrier_cost_tl, buyer_price_tl,
       buyer_price_tl - carrier_cost_tl as marj
  from shipping_rates order by sort_order;
\echo 'BEKLENEN: 6 kademe, her birinde marj 10.00'

\echo ''
\echo '=== Ana Doküman örneği: 250 puanlık, S desi ürün ==='
insert into products (id, title, points, ai_suggested_points, condition, category,
                      location, image_key, seller_id, seller_name, seller_initials, size_class)
values ('fiyat-testi', 'S desi test ürünü', 250, 250, 'İyi durumda', 'Oyun & Oyuncak',
        'Kadıköy', 'wooden-blocks', :'s', 'Test', 'TT', 'S')
on conflict (id) do update set points = 250, size_class = 'S';

insert into trades (id, buyer_id, seller_id, product_id, points)
values ('bbbbbbbb-0000-0000-0000-000000000001', :'b', :'s', 'fiyat-testi', 250)
on conflict (id) do nothing;

select * from quote_trade_price('bbbbbbbb-0000-0000-0000-000000000001');
\echo 'BEKLENEN: kargo 52.00 + hizmet 17.90 + işlem payı 15.00 = 84.90'

\echo ''
\echo '=== Asgari işlem payı: 50 puanlık ucuz ürün ==='
insert into products (id, title, points, ai_suggested_points, condition, category,
                      location, image_key, seller_id, seller_name, seller_initials, size_class)
values ('ucuz-urun', 'Ucuz ürün', 50, 50, 'İyi durumda', 'Oyun & Oyuncak',
        'Kadıköy', 'wooden-blocks', :'s', 'Test', 'TT', 'XS')
on conflict (id) do update set points = 50, size_class = 'XS';
insert into trades (id, buyer_id, seller_id, product_id, points)
values ('bbbbbbbb-0000-0000-0000-000000000002', :'b', :'s', 'ucuz-urun', 50)
on conflict (id) do nothing;
select transaction_fee_tl, total_tl from quote_trade_price('bbbbbbbb-0000-0000-0000-000000000002');
\echo 'BEKLENEN: işlem payı 6.00 (yüzde 3.00 verirdi, asgari devreye girdi), toplam 61.90'

\echo ''
\echo '=== XXL kademe ==='
insert into products (id, title, points, ai_suggested_points, condition, category,
                      location, image_key, seller_id, seller_name, seller_initials, size_class)
values ('buyuk-urun', 'Büyük ürün', 600, 600, 'İyi durumda', 'Bebek Arabası & Puset',
        'Kadıköy', 'wooden-blocks', :'s', 'Test', 'TT', 'XXL')
on conflict (id) do update set points = 600, size_class = 'XXL';
insert into trades (id, buyer_id, seller_id, product_id, points)
values ('bbbbbbbb-0000-0000-0000-000000000003', :'b', :'s', 'buyuk-urun', 600)
on conflict (id) do nothing;
select shipping_tl, transaction_fee_tl, total_tl, commission_tl
  from quote_trade_price('bbbbbbbb-0000-0000-0000-000000000003');
\echo 'BEKLENEN: kargo 250.00, işlem payı 36.00, toplam 303.90, komisyon 63.90'

\echo ''
\echo '=== Desi kademesi olmayan ilan reddedilir ==='
do $$
begin
  update products set size_class = null where id = 'fiyat-testi';
  perform quote_trade_price('bbbbbbbb-0000-0000-0000-000000000001');
  raise notice 'SONUÇ: HATA — desisiz ilan fiyatlandı';
exception when others then
  raise notice 'SONUÇ: doğru — reddedildi (%)', sqlerrm;
end $$;
