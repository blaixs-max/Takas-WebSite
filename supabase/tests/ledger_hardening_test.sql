-- KIDS TRADE — Defter sağlamlaştırma testleri
--
-- 20260807100000_ledger_hardening.sql'in kapattığı iki açığın gerçekten
-- kapandığını gösterir. Her bölüm beklenen sonucu yazdırır; "BEKLENEN" ile
-- "SONUÇ" satırları uyuşmuyorsa test başarısızdır.
--
-- Çalıştırma:
--   psql "$DB" -f supabase/tests/ledger_hardening_test.sql

\set b '11111111-1111-1111-1111-111111111111'
\set s '22222222-2222-2222-2222-222222222222'
\set t1 'aaaaaaaa-0000-0000-0000-000000000001'

\echo ''
\echo '=== 1) earn_points idempotent: aynı anahtarla iki çağrı ==='
select available_points as ilk_cagri from earn_points(:'b', 500, 'bonus:kayit:' || :'b');
select available_points as ikinci_cagri from earn_points(:'b', 500, 'bonus:kayit:' || :'b');
\echo 'BEKLENEN: iki satır da 500 (ikinci çağrı puan basmadı)'
select count(*) as defter_satiri from wallet_entries
 where idempotency_key = 'bonus:kayit:' || :'b';
\echo 'BEKLENEN: defter_satiri = 1'

\echo ''
\echo '=== 2) earn_points anahtarsız çağrılamaz ==='
do $$
begin
  perform earn_points('11111111-1111-1111-1111-111111111111'::uuid, 100, '');
  raise notice 'SONUÇ: HATA — boş anahtar kabul edildi';
exception when others then
  raise notice 'SONUÇ: doğru — reddedildi (%)', sqlerrm;
end $$;
\echo 'BEKLENEN: reddedildi'

\echo ''
\echo '=== 3) wallet_entries değişmez: UPDATE ve DELETE engelli ==='
do $$
begin
  update wallet_entries set amount = 999999 where type = 'EARN';
  raise notice 'SONUÇ: HATA — UPDATE geçti';
exception when others then
  raise notice 'SONUÇ: doğru — UPDATE engellendi (%)', sqlerrm;
end $$;
do $$
begin
  delete from wallet_entries where type = 'EARN';
  raise notice 'SONUÇ: HATA — DELETE geçti';
exception when others then
  raise notice 'SONUÇ: doğru — DELETE engellendi (%)', sqlerrm;
end $$;
\echo 'BEKLENEN: ikisi de engellendi'

\echo ''
\echo '=== 4) Mutlu yol hâlâ çalışıyor: HOLD → RELEASE ==='
insert into trades(id, buyer_id, seller_id, product_id, points)
  values (:'t1', :'b', :'s', 'rings', 340);
select status from hold_points(:'t1');
select available_points, held_points from wallets where user_id = :'b';
\echo 'BEKLENEN: POINTS_HELD, available 160 / held 340'

update trades set status = 'SHIPPED' where id = :'t1';
select status from release_points(:'t1');
select 'alici' as kim, available_points, held_points from wallets where user_id = :'b'
union all
select 'satici', available_points, held_points from wallets where user_id = :'s';
\echo 'BEKLENEN: COMPLETED, alıcı 160/0, satıcı 340/0'

\echo ''
\echo '=== 5) Defter satırları anahtar taşıyor ==='
select type, amount, idempotency_key from wallet_entries
 where trade_id = :'t1' order by id;
\echo 'BEKLENEN: hold:, release_out:, release_in: önekli üç anahtar'

\echo ''
\echo '=== 6) Mutabakat: Σ defter = cüzdan bakiyesi ==='
select w.user_id,
       w.available_points + w.held_points as cuzdan,
       coalesce(sum(case e.type
         when 'EARN' then e.amount
         when 'RELEASE_IN' then e.amount
         when 'RELEASE_OUT' then -e.amount
         else 0 end), 0) as defter
  from wallets w left join wallet_entries e on e.user_id = w.user_id
 group by w.user_id, w.available_points, w.held_points
 order by w.user_id;
\echo 'BEKLENEN: her satırda cuzdan = defter'
