-- KIDS TRADE — İade ve uyuşmazlık testleri (Ana Doküman Bölüm 5)
--
-- En kritik iddia 5 numarada: reddedilen talepten sonra sayaç SIFIRLANMAZ,
-- kaldığı yerden devam eder. Aksi hâlde arka arkaya açılan asılsız talepler
-- satıcının puanını süresiz rehin alır.

\set s '77777777-7777-7777-7777-777777777777'
\set b '88888888-8888-8888-8888-888888888888'

\echo ''
\echo '=== Hazırlık ==='
insert into auth.users (id, email, raw_user_meta_data)
values (:'s', 'iade-satici@example.com', '{"full_name":"Zeynep Demir"}'::jsonb),
       (:'b', 'iade-alici@example.com',  '{"full_name":"Ali Kaya"}'::jsonb)
on conflict (id) do nothing;

select available_points as alici_baslangic
  from earn_points(:'b', 5000, 'test:iade-alici-bakiye');

create or replace function pg_temp.yayinda_ilan(p_baslik text, p_puan integer)
returns text language plpgsql as $$
declare pid text; sid text := '77777777-7777-7777-7777-777777777777';
begin
  perform set_config('test.uid', sid, false);
  select id into pid from create_listing(p_baslik, 'Oyun & Oyuncak', 'Az kullanılmış', 'M', p_puan, p_sub_category => 'Yapı & inşa');
  insert into product_photos (product_id, slot, storage_path, moderation_status)
  select pid, s, sid || '/' || pid || '/' || s || '.jpg', 'approved'
    from unnest(array['front','back','left','right','label']::photo_slot[]) s;
  perform publish_listing(pid, 'front');
  return pid;
end; $$;

-- Teslim edilmiş bir takas üretir: ilan aç, satın al, kargola, teslim et.
create or replace function pg_temp.teslim_edilmis(p_baslik text, p_puan integer)
returns uuid language plpgsql as $$
declare pid text; tid uuid; bid text := '88888888-8888-8888-8888-888888888888';
begin
  pid := pg_temp.yayinda_ilan(p_baslik, p_puan);
  perform set_config('test.uid', bid, false);
  select id into tid from create_trade(pid, bid::uuid);
  update trades set status = 'SHIPPED' where id = tid;
  perform mark_delivered(tid);
  return tid;
end; $$;

create temp table d_ids (ad text primary key, deger text);
grant all on d_ids to authenticated;

\echo ''
\echo '=== 1) İtiraz açılınca kanıt istenir ve sayaç durur ==='
select pg_temp.teslim_edilmis('Ahşap tren', 300) as id \gset t1_
select deadline_at > now() + interval '47 hours' as onay_sayaci_isliyor
  from trades where id = :'t1_id';
set session role authenticated;
select set_config('test.uid', :'b', false);
select id, status from open_dispute(:'t1_id', 'Üründe kırık var') \gset d1_
insert into d_ids values ('d1', :'d1_id'), ('t1', :'t1_id');
reset role;
select (select status from trades where id = :'t1_id')            as takas,
       (select deadline_at from trades where id = :'t1_id')       as takas_sayaci,
       (select deadline_remaining > interval '46 hours'
          from trades where id = :'t1_id')                        as kalan_saklandi,
       (select status from disputes where id = :'d1_id')          as itiraz;
\echo 'BEKLENEN: DISPUTED, sayaç null, kalan ~48s saklandı, NEEDS_EVIDENCE'

\echo ''
\echo '=== 2) Kanıt gelince karar kuyruğuna geçer ==='
set session role authenticated;
select set_config('test.uid', :'b', false);
select status from add_dispute_evidence(:'d1_id', :'b' || '/kirik.jpg', 'Sol tekerlek kırık');
reset role;
select status, deadline_at > now() + interval '47 hours' as karar_sayaci
  from disputes where id = :'d1_id';
\echo 'BEKLENEN: OPEN, karar sayacı 48 saat'

\echo ''
\echo '=== 3) BAŞKASININ KLASÖRÜ KANIT DİYE GÖSTERİLEMEZ ==='
set session role authenticated;
select set_config('test.uid', :'b', false);
do $$
declare did uuid;
begin
  select deger::uuid into did from d_ids where ad = 'd1';
  perform add_dispute_evidence(did, '77777777-7777-7777-7777-777777777777/sahte.jpg');
  raise notice 'SONUÇ: HATA — yabancı klasör kanıt olarak kabul edildi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 4) ALICI KENDİ İTİRAZINA KARAR VEREMEZ ==='
do $$
declare did uuid;
begin
  select deger::uuid into did from d_ids where ad = 'd1';
  perform resolve_dispute(did, true);
  raise notice 'SONUÇ: HATA — alıcı kendi itirazını karara bağladı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (yetki yok)';
end $$;

\echo ''
\echo '=== 5) SAYAÇ SIFIRLANMAZ — reddedilen talep kaldığı yerden devam eder ==='
reset role;
-- Sayacı 10 saate düşürüp itiraz açalım: reddedilince 48 değil ~10 saat kalmalı.
select pg_temp.teslim_edilmis('Denge bisikleti', 200) as id \gset t2_
update trades set deadline_at = now() + interval '10 hours' where id = :'t2_id';
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from open_dispute(:'t2_id', 'Beğenmedim') \gset d2_
reset role;
insert into d_ids values ('t2', :'t2_id');
select status from resolve_dispute(:'d2_id', false, 'Ürün ilanla uyumlu, ayıp yok');
select status,
       deadline_at < now() + interval '11 hours' as sifirlanmadi,
       deadline_at > now() + interval '9 hours'  as kalan_korundu,
       deadline_remaining is null                as kalan_temizlendi
  from trades where id = :'t2_id';
\echo 'BEKLENEN: DELIVERED, sıfırlanmadı t, kalan korundu t, temizlendi t'

\echo ''
\echo '=== 6) Eşiğin ALTINDA: tam iade, ürün alıcıda kalır ==='
select pg_temp.teslim_edilmis('Küçük oyuncak', 300) as id \gset t3_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from open_dispute(:'t3_id', 'Ürün ayıplı') \gset d3_
select status from add_dispute_evidence(:'d3_id', :'b' || '/ayip3.jpg');
reset role;
select resolution from resolve_dispute(:'d3_id', true, 'Ayıp doğrulandı');
select (select status from trades where id = :'t3_id')                       as takas,
       (select count(*) from seller_debts where trade_id = :'t3_id')         as borc;
\echo 'BEKLENEN: REFUND_KEEP, REFUNDED, borç 0'

\echo ''
\echo '=== 7) Eşiğin ÜSTÜNDE: ürün geri döner, satıcıya borç yazılır ==='
select pg_temp.teslim_edilmis('Pahalı oyuncak', 800) as id \gset t4_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from open_dispute(:'t4_id', 'Ürün ayıplı') \gset d4_
select status from add_dispute_evidence(:'d4_id', :'b' || '/ayip4.jpg');
reset role;
select resolution from resolve_dispute(:'d4_id', true, 'Ayıp doğrulandı', false, 78.00);
select (select status from trades where id = :'t4_id')                  as takas,
       (select amount_tl from seller_debts where trade_id = :'t4_id')   as borc_tl,
       (select seller_id = :'s' from seller_debts where trade_id = :'t4_id') as borclu_satici;
\echo 'BEKLENEN: REFUND_RETURN, REFUNDED, borç 78.00, borçlu satıcı'

\echo ''
\echo '=== 8) Kanıt gelmezse talep reddedilir, sayaç devam eder ==='
select pg_temp.teslim_edilmis('Kitaplık', 250) as id \gset t5_
update trades set deadline_at = now() + interval '20 hours' where id = :'t5_id';
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from open_dispute(:'t5_id', 'Sorun var ama kanıt yüklemeyeceğim') \gset d5_
reset role;
update disputes set deadline_at = now() - interval '1 minute' where id = :'d5_id';
select * from expire_stale_disputes();
select (select status from disputes where id = :'d5_id')        as itiraz,
       (select status from trades where id = :'t5_id')          as takas,
       (select deadline_at < now() + interval '21 hours'
           and deadline_at > now() + interval '19 hours'
          from trades where id = :'t5_id')                      as sayac_kaldigi_yerden;
\echo 'BEKLENEN: REJECTED, DELIVERED, sayaç ~20 saat'

\echo ''
\echo '=== 9) Karar gecikirse MAKİNE KARAR VERMEZ, kuyruğa alır ==='
select pg_temp.teslim_edilmis('Bekleyen ürün', 400) as id \gset t6_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from open_dispute(:'t6_id', 'Ayıplı') \gset d6_
select status from add_dispute_evidence(:'d6_id', :'b' || '/ayip6.jpg');
reset role;
update disputes set deadline_at = now() - interval '1 minute' where id = :'d6_id';
select * from expire_stale_disputes();
select status as itiraz, deadline_at > now() as yeniden_kuyrukta
  from disputes where id = :'d6_id';
\echo 'BEKLENEN: OPEN (karar verilmedi), yeniden kuyrukta'

\echo ''
\echo '=== 10) Aynı takasa ikinci AÇIK itiraz olamaz ==='
-- İndeksin kendisini sınıyoruz. open_dispute üzerinden gitseydik takas zaten
-- DISPUTED olduğu için durum kontrolüne takılır, benzersiz indeks hiç
-- denenmemiş olurdu — doğru sonuç, yanlış sebep.
reset role;
do $$
declare tid uuid; uid uuid := '88888888-8888-8888-8888-888888888888';
begin
  select deger::uuid into tid from d_ids where ad = 't1';
  insert into disputes (trade_id, opened_by, reason, status)
  values (tid, uid, 'İkinci talep', 'OPEN');
  raise notice 'SONUÇ: HATA — ikinci açık itiraz oluştu';
exception when unique_violation then
  raise notice 'SONUÇ: doğru — benzersiz indeks engelledi';
end $$;

\echo ''
\echo '=== 10b) Kapanmış itirazdan sonra ikinci talep AÇILABİLİR ==='
-- İndeks kısmi: reddedilen taleple hakkı sonsuza kadar kapatmak yanlış olurdu.
do $$
declare tid uuid; uid uuid := '88888888-8888-8888-8888-888888888888';
begin
  select deger::uuid into tid from d_ids where ad = 't2';   -- 5'te reddedilmişti
  insert into disputes (trade_id, opened_by, reason, status)
  values (tid, uid, 'Yeni kanıtım var', 'OPEN');
  raise notice 'SONUÇ: doğru — ikinci talep açılabildi';
  delete from disputes where trade_id = tid and reason = 'Yeni kanıtım var';
exception when others then
  raise notice 'SONUÇ: HATA — reddedilen talepten sonra yeni talep açılamadı (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 11) Kargo öncesi iptal: puan geri, ilan vitrine döner ==='
reset role;
select pg_temp.yayinda_ilan('İptal edilecek', 150) as pid \gset i7_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from create_trade(:'i7_pid', :'b') \gset t7_
select status from cancel_trade(:'t7_id');
reset role;
select (select status from trades where id = :'t7_id')     as takas,
       (select status from products where id = :'i7_pid')  as ilan;
\echo 'BEKLENEN: REFUNDED, ilan ACTIVE'

\echo ''
\echo '=== 12) GERÇEKTEN kargodaki takas iptal edilemez ==='
-- Taze bir SHIPPED takas: t1 üzerinden gitseydik DISPUTED olduğu için
-- engellenirdi ve "kargoya verildi" dalı hiç sınanmamış olurdu.
reset role;
select pg_temp.yayinda_ilan('Kargodaki ürün', 180) as pid \gset i8_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from create_trade(:'i8_pid', :'b') \gset t8_
insert into d_ids values ('t8', :'t8_id');
reset role;
update trades set status = 'SHIPPED' where id = :'t8_id';
set session role authenticated;
select set_config('test.uid', :'b', false);
do $$
declare tid uuid;
begin
  select deger::uuid into tid from d_ids where ad = 't8';
  perform cancel_trade(tid);
  raise notice 'SONUÇ: HATA — kargodaki takas iptal edildi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 13) SATICI ALICININ TAKASINI İPTAL EDEMEZ ==='
select set_config('test.uid', :'s', false);
do $$
declare tid uuid;
begin
  select deger::uuid into tid from d_ids where ad = 't8';
  perform cancel_trade(tid);
  raise notice 'SONUÇ: HATA — satıcı alıcının takasını iptal etti';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

reset role;
