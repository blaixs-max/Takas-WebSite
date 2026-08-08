-- KIDS TRADE — İlan açma testleri

\set s '22222222-2222-2222-2222-222222222222'
\set b '11111111-1111-1111-1111-111111111111'

\echo ''
\echo '=== Hazırlık: satıcı hesabı ==='
insert into auth.users (id, email, raw_user_meta_data)
values (:'s', 'zeynep.demir@example.com', '{"full_name":"Zeynep Demir"}'::jsonb),
       (:'b', 'alici@example.com', '{}'::jsonb)
on conflict (id) do nothing;

set session role authenticated;
select set_config('test.uid', :'s', false);

\echo ''
\echo '=== 1) İlan açılır, satıcı ve baş harfler oturumdan gelir ==='
select id, title, points, ai_suggested_points, size_class, status,
       seller_name, seller_initials
  from create_listing('Ahşap tren seti', 'Oyuncak', 'Az kullanılmış', 'M', 380, 'Kadıköy',
                      'Doğal ahşap, 12 parça, kutusunda.') \gset l_
select title, points, ai_suggested_points, size_class, status, seller_name, seller_initials
  from products where id = :'l_id';
\echo 'BEKLENEN: 380/380, M, ACTIVE, Zeynep Demir, ZD'

\echo ''
\echo '=== 2) Yeni ilan hemen fiyatlanabiliyor ==='
reset role;
select available_points from earn_points(:'b', 1000, 'test:alici-bakiye');
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from create_trade(:'l_id', :'b') \gset t_
select size_class, shipping_tl, service_fee_tl, transaction_fee_tl, total_tl
  from quote_trade_price(:'t_id');
\echo 'BEKLENEN: M kademesi, kargo 78.00, hizmet 17.90, işlem payı 22.80, toplam 118.70'

\echo ''
\echo '=== 3) Geçersiz desi reddedilir ==='
select set_config('test.uid', :'s', false);
do $$
begin
  perform create_listing('Kötü desi', 'Oyuncak', 'Az kullanılmış', 'XXXL', 100);
  raise notice 'SONUÇ: HATA — geçersiz desi kabul edildi';
exception when others then
  raise notice 'SONUÇ: doğru — reddedildi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 4) Boş başlık reddedilir ==='
do $$
begin
  perform create_listing('   ', 'Oyuncak', 'Az kullanılmış', 'S', 100);
  raise notice 'SONUÇ: HATA — boş başlık kabul edildi';
exception when others then
  raise notice 'SONUÇ: doğru — reddedildi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 5) Oturumsuz ilan açılamaz ==='
select set_config('test.uid', '', false);
do $$
begin
  perform create_listing('Oturumsuz', 'Oyuncak', 'Az kullanılmış', 'S', 100);
  raise notice 'SONUÇ: HATA — oturumsuz ilan açıldı';
exception when others then
  raise notice 'SONUÇ: doğru — reddedildi (%)', sqlerrm;
end $$;

reset role;
\echo ''
\echo '=== 6) Satıcı KENDİ ilanlarını görebiliyor (rezerve/satılmış dahil) ==='
set session role authenticated;
select set_config('test.uid', :'s', false);
select count(*) as gorunen, count(*) filter (where status <> 'ACTIVE') as aktif_olmayan
  from products where seller_id = :'s';
\echo 'BEKLENEN: gorunen 1, aktif_olmayan 1 (test 2 ilanı rezerve etti)'

\echo ''
\echo '=== 7) Satıcı kendi ilanının puanını yükseltemez (fiyat kilidi hâlâ ayakta) ==='
select set_config('test.uid', :'s', false);
do $$
declare pid text;
begin
  select id into pid from products where seller_name = 'Zeynep Demir' limit 1;
  if pid is null then raise exception 'ilan görünmüyor — RLS testi başarısız'; end if;
  perform set_product_points(pid, 999999);
  raise notice 'SONUÇ: HATA — puan yükseltildi';
exception when others then
  raise notice 'SONUÇ: doğru — reddedildi (%)', sqlerrm;
end $$;
reset role;
