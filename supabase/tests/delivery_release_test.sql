-- KIDS TRADE — Teslimat onayı, otomatik tamamlanma ve zaman aşımı testleri
--
-- Buradaki asıl soru şu: puan havuza girdikten sonra oradan çıkabiliyor mu, ve
-- yalnızca çıkması gereken durumlarda mı çıkıyor. En kritik iddialar 2 (satıcı
-- kendi takasını onaylayamaz), 7 (itiraz sayacı durdurur) ve 8 (ödemesi alınmış
-- takas zaman aşımıyla iade edilmez).

\set s '55555555-5555-5555-5555-555555555555'
\set b '66666666-6666-6666-6666-666666666666'

\echo ''
\echo '=== Hazırlık: hesaplar, bakiye ve yayında bir ilan ==='
insert into auth.users (id, email, raw_user_meta_data)
values (:'s', 'teslim-satici@example.com', '{"full_name":"Zeynep Demir"}'::jsonb),
       (:'b', 'teslim-alici@example.com',  '{"full_name":"Ali Kaya"}'::jsonb)
on conflict (id) do nothing;

-- Idempotency anahtarı takıma özel olmalı: aynı anahtar başka bir takımda
-- kullanıldıysa earn_points ikinci kez yazmaz ve bakiye sıfır kalır.
select available_points as alici_baslangic
  from earn_points(:'b', 2000, 'test:teslim-alici-bakiye');

-- Yayına alınmış ilan üretmek için küçük bir yardımcı: ilan aç, kareleri koy,
-- onayla, yayınla. Testlerin her biri taze bir ilana ihtiyaç duyuyor.
create or replace function pg_temp.yayinda_ilan(p_baslik text, p_puan integer)
returns text language plpgsql as $$
declare pid text; sid text := '55555555-5555-5555-5555-555555555555';
begin
  perform set_config('test.uid', sid, false);
  select id into pid from create_listing(p_baslik, 'Oyun & Oyuncak', 'Az kullanılmış', 'M', p_sub_category => 'Yapı & inşa');
  insert into product_photos (product_id, slot, storage_path, moderation_status)
  select pid, s, sid || '/' || pid || '/' || s || '.jpg', 'approved'
    from unnest(array['front','back','left','right','label']::photo_slot[]) s;
  perform test_degerle(pid);
  perform publish_listing(pid, 'front');
  return pid;
end; $$;

-- psql değişkenleri $$...$$ içinde ikame edilmediği için kimlikleri buradan
-- okuyoruz. Tablo süperkullanıcı olarak açılıyor, testler authenticated
-- rolünde koşuyor — erişim açıkça verilmeli.
create temp table t_ids (ad text primary key, deger text);
grant all on t_ids to authenticated;

\echo ''
\echo '=== 1) Takas açılınca ödeme sayacı başlar ==='
select pg_temp.yayinda_ilan('Ahşap tren', 400) as pid \gset i1_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from create_trade(:'i1_pid', :'b') \gset t1_
insert into t_ids values ('t1', :'t1_id');
select status, deadline_at is not null as sayac_var,
       deadline_at > now() as ileride
  from trades where id = :'t1_id';
\echo 'BEKLENEN: POINTS_HELD, sayaç var, ileride'

\echo ''
\echo '=== 2) SATICI KENDİ TAKASINI ONAYLAYAMAZ ==='
select set_config('test.uid', :'s', false);
do $$
declare tid uuid;
begin
  select deger::uuid into tid from t_ids where ad = 't1';
  perform confirm_delivery(tid);
  raise notice 'SONUÇ: HATA — satıcı kendi takasını onayladı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 3) Kargolanmamış takas onaylanamaz ==='
select set_config('test.uid', :'b', false);
do $$
declare tid uuid;
begin
  select deger::uuid into tid from t_ids where ad = 't1';
  perform confirm_delivery(tid);
  raise notice 'SONUÇ: HATA — POINTS_HELD durumunda onaylandı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 4) SHIPPED damgası ve üç günlük şube sayacı ==='
reset role;
update trades set status = 'SHIPPED' where id = :'t1_id';
select status, shipped_at is not null as damga,
       deadline_at::date - now()::date as gun_kaldi
  from trades where id = :'t1_id';
\echo 'BEKLENEN: SHIPPED, damga var, 3 gün'

\echo ''
\echo '=== 5) Alıcı onaylar: puan satıcıya geçer, ilan SOLD olur ==='
set session role authenticated;
select set_config('test.uid', :'b', false);
select status from confirm_delivery(:'t1_id');
reset role;
select (select available_points from wallets where user_id = :'s') as satici_puan,
       (select held_points      from wallets where user_id = :'b') as alici_havuzda,
       (select status from products where id = :'i1_pid')          as ilan,
       (select deadline_at from trades where id = :'t1_id')        as sayac;
\echo 'BEKLENEN: satıcı 400, alıcı havuzda 0, ilan SOLD, sayaç null'

\echo ''
\echo '=== 6) Kargo bedeli ödenmezse puan iade edilir, ilan vitrine döner ==='
select pg_temp.yayinda_ilan('Denge bisikleti', 300) as pid \gset i2_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from create_trade(:'i2_pid', :'b') \gset t2_
reset role;
-- Sayacı geriye çekerek süreyi doldurmuş sayıyoruz.
update trades set deadline_at = now() - interval '1 minute' where id = :'t2_id';
select * from expire_stale_trades();
select (select status from trades where id = :'t2_id')       as takas,
       (select status from products where id = :'i2_pid')    as ilan,
       (select available_points from wallets where user_id = :'b') as alici_puan;
\echo 'BEKLENEN: REFUNDED, ilan ACTIVE, alıcı puanı geri (1600)'

\echo ''
\echo '=== 7) İTİRAZ SAYACI DURDURUR — otomatik onay itirazlıyı ödemez ==='
select pg_temp.yayinda_ilan('Kitaplık', 250) as pid \gset i3_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from create_trade(:'i3_pid', :'b') \gset t3_
reset role;
update trades set status = 'SHIPPED' where id = :'t3_id';
select status from mark_delivered(:'t3_id');
set session role authenticated;
select set_config('test.uid', :'b', false);
select status from open_dispute(:'t3_id', 'Ürün açıklamadaki gibi değil');
reset role;
select deadline_at is null as sayac_durdu from trades where id = :'t3_id';
select * from expire_stale_trades();
select status as itiraz_sonrasi_durum,
       (select available_points from wallets where user_id = :'s') as satici_puan
  from trades where id = :'t3_id';
\echo 'BEKLENEN: sayaç durdu, DISPUTED kaldı, satıcı puanı 400te sabit'

\echo ''
\echo '=== 8) ÖDEMESİ ALINMIŞ TAKAS ZAMAN AŞIMIYLA İADE EDİLMEZ ==='
select pg_temp.yayinda_ilan('Peluş ayı', 200) as pid \gset i4_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from create_trade(:'i4_pid', :'b') \gset t4_
reset role;
insert into t_ids values ('t4', :'t4_id');
insert into cargo_payments (trade_id, buyer_id, seller_id, conversation_id, amount,
                            carrier_cost, commission, status, paid_at)
values (:'t4_id', :'b', :'s', :'t4_id', 84.90, 52.00, 32.90, 'PAID', now());
update trades set deadline_at = now() - interval '1 minute' where id = :'t4_id';
select * from expire_stale_trades();
do $$
declare d text;
begin
  select status into d from trades where id = (select deger::uuid from t_ids where ad = 't4');
  if d = 'REFUNDED' then
    raise notice 'SONUÇ: HATA — parası alınmış takas iade edildi';
  else
    raise notice 'SONUÇ: doğru — iade edilmedi (durum %)', d;
  end if;
end $$;

\echo ''
\echo '=== 9) 48 saat dolunca puan satıcıya otomatik geçer ==='
select pg_temp.yayinda_ilan('Lego seti', 150) as pid \gset i5_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from create_trade(:'i5_pid', :'b') \gset t5_
reset role;
update trades set status = 'SHIPPED' where id = :'t5_id';
select status from mark_delivered(:'t5_id');
select deadline_at > now() + interval '47 hours' as kirksekiz_saat
  from trades where id = :'t5_id';
update trades set deadline_at = now() - interval '1 minute' where id = :'t5_id';
select * from expire_stale_trades();
select (select status from trades where id = :'t5_id')              as takas,
       (select available_points from wallets where user_id = :'s')  as satici_puan;
\echo 'BEKLENEN: 48 saat doğru, COMPLETED, satıcı 550 (400 + 150)'

\echo ''
\echo '=== 10) Gerekçesiz itiraz açılamaz ==='
set session role authenticated;
select set_config('test.uid', :'b', false);
do $$
declare tid uuid;
begin
  select deger::uuid into tid from t_ids where ad = 't1';
  perform open_dispute(tid, '   ');
  raise notice 'SONUÇ: HATA — boş gerekçeyle itiraz açıldı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 11) Defter dengede: havuzda asılı puan kalmadı ==='
reset role;
-- Havuzda kalan puanın karşılığı olmalı: her açık takas kadar, ne fazla ne
-- eksik. Kapanmış takasta ne puan ne sayaç asılı kalmalı.
select (select held_points from wallets where user_id = :'b') as alici_havuzda,
       (select coalesce(sum(points),0) from trades
         where buyer_id = :'b'
           and status in ('CREATED','POINTS_HELD','SHIPPED','DELIVERED','DISPUTED'))
         as acik_takaslarin_toplami,
       (select count(*) from trades
         where (buyer_id = :'b' or seller_id = :'s')
           and deadline_at is not null
           and status in ('COMPLETED','REFUNDED','DISPUTED')) as asili_sayac;
\echo 'BEKLENEN: 450 = 450 (itirazlı 250 + ödemesi takılan 200), asılı sayaç 0'
