-- KIDS TRADE — Kampanya puanı motoru testleri (Ana Doküman 2.4)
--
-- Kritik iddialar: 3 (telefonu doğrulanmamış hak almaz), 5 (aynı numara ikinci
-- hesapla aynı hakkı alamaz), 7 (hak geri alınamaz) ve 8 (1000 kullanıcı
-- sınırı gerçekten duruyor).

\set d 'cccccccc-cccc-cccc-cccc-cccccccccccc'
\set n 'dddddddd-dddd-dddd-dddd-dddddddddddd'
\set k 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
\set y 'ffffffff-ffff-ffff-ffff-ffffffffffff'

\echo ''
\echo '=== Hazırlık: doğrulanmış, doğrulanmamış ve kopya numaralı hesaplar ==='
insert into auth.users (id, email, phone, phone_confirmed_at, raw_user_meta_data)
values (:'d', 'kampanya-dogrulanmis@example.com', '+905551110001', now(),
        '{"full_name":"Deniz Yılmaz"}'::jsonb),
       (:'n', 'kampanya-dogrulanmamis@example.com', '+905551110002', null,
        '{"full_name":"Nur Aksoy"}'::jsonb),
       (:'k', 'kampanya-kopya@example.com', '+905551110001', now(),
        '{"full_name":"Kopya Hesap"}'::jsonb),
       (:'y', 'kampanya-yonetici@example.com', '+905551110009', now(), '{}'::jsonb)
on conflict (id) do nothing;

insert into admins (user_id, note) values (:'y', 'kampanya testi')
on conflict (user_id) do nothing;

-- Yayına alınmış ilan üretir; hak trigger üzerinden doğmalı.
create or replace function pg_temp.ilan_yayinla(p_sahip text, p_baslik text)
returns text language plpgsql as $$
declare pid text;
begin
  perform set_config('test.uid', p_sahip, false);
  select id into pid from create_listing(p_baslik, 'Oyun & Oyuncak', 'Az kullanılmış', 'M', p_sub_category => 'Yapı & inşa');
  insert into product_photos (product_id, slot, storage_path, moderation_status)
  select pid, s, p_sahip || '/' || pid || '/' || s || '.jpg', 'approved'
    from unnest(array['front','back','left','right','label']::photo_slot[]) s;
  perform test_degerle(pid);
  perform publish_listing(pid, 'front');
  return pid;
end; $$;

\echo ''
\echo '=== 1) İlk ilan yayına girince 250 puan doğar ==='
select pg_temp.ilan_yayinla(:'d', 'İlk ilanım') as pid \gset i1_
select (select count(*) from campaign_grants where user_id = :'d' and kind = 'FIRST_LISTING') as hak,
       (select available_points from wallets where user_id = :'d') as bakiye;
\echo 'BEKLENEN: hak 1, bakiye 250'

\echo ''
\echo '=== 2) İKİNCİ İLAN İKİNCİ HAK DOĞURMAZ ==='
select pg_temp.ilan_yayinla(:'d', 'İkinci ilanım') as pid \gset i2_
select (select count(*) from campaign_grants where user_id = :'d' and kind = 'FIRST_LISTING') as hak,
       (select available_points from wallets where user_id = :'d') as bakiye;
\echo 'BEKLENEN: hak hâlâ 1, bakiye hâlâ 250'

\echo ''
\echo '=== 3) TELEFONU DOĞRULANMAMIŞ HESAP HAK ALMAZ ==='
select pg_temp.ilan_yayinla(:'n', 'Doğrulanmamış ilan') as pid \gset i3_
select (select count(*) from campaign_grants where user_id = :'n') as hak,
       (select coalesce((select available_points from wallets where user_id = :'n'), 0)) as bakiye;
\echo 'BEKLENEN: hak 0, bakiye 0'

\echo ''
\echo '=== 4) İlan yayına girdi mi? (hak vermemek ilanı engellememeli) ==='
select status from products where id = :'i3_pid';
\echo 'BEKLENEN: ACTIVE — kampanya kuralı ilanı yayına girmekten alıkoymaz'

\echo ''
\echo '=== 5) AYNI NUMARA İKİNCİ HESAPLA AYNI HAKKI ALAMAZ ==='
select pg_temp.ilan_yayinla(:'k', 'Kopya hesabın ilanı') as pid \gset i4_
select (select count(*) from campaign_grants where user_id = :'k') as kopya_hak,
       (select count(*) from campaign_grants where phone = '+905551110001') as numara_hakki;
\echo 'BEKLENEN: kopya hak 0, numara hakkı 1'

\echo ''
\echo '=== 6) İlk satış tamamlanınca ikinci 250 gelir ==='
-- Doğrulanmış satıcının ilanını bir alıcı satın alıp teslim onayı versin.
insert into auth.users (id, email, phone, phone_confirmed_at)
values ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'kampanya-alici@example.com',
        '+905551119999', now())
on conflict (id) do nothing;
select available_points from earn_points('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 3000,
                                         'test:kampanya-alici-bakiye');
set session role authenticated;
select set_config('test.uid', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', false);
select id from create_trade(:'i1_pid', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1') \gset t1_
reset role;
update trades set status = 'SHIPPED' where id = :'t1_id';
set session role authenticated;
select set_config('test.uid', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', false);
select status from confirm_delivery(:'t1_id');
reset role;
select (select count(*) from campaign_grants where user_id = :'d') as satici_hak_sayisi,
       (select string_agg(kind, ', ' order by kind) from campaign_grants where user_id = :'d') as haklar;
\echo 'BEKLENEN: 2 hak — FIRST_LISTING, FIRST_SALE'

\echo ''
\echo '=== 7) KAMPANYA HAKKI GERİ ALINAMAZ ==='
do $$
begin
  delete from campaign_grants where kind = 'FIRST_SALE';
  raise notice 'SONUÇ: HATA — kampanya hakkı silindi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
do $$
begin
  update campaign_grants set points = 9999;
  raise notice 'SONUÇ: HATA — kampanya hakkı değiştirildi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 8) KULLANICI SINIRI GERÇEKTEN DURUYOR ==='
-- Sınırı mevcut kullanıcı sayısına çekiyoruz: bir sonraki yeni kullanıcı
-- hak alamamalı, ama zaten içeride olan ikinci hakkını alabilmeli.
update campaign_settings set max_users = (select count(distinct user_id) from campaign_grants);
insert into auth.users (id, email, phone, phone_confirmed_at)
values ('b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', 'kampanya-gec@example.com',
        '+905551112222', now())
on conflict (id) do nothing;
select pg_temp.ilan_yayinla('b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', 'Geç kalan ilan') as pid \gset i5_
select count(*) as gec_gelen_hak from campaign_grants
 where user_id = 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2';
\echo 'BEKLENEN: 0 — kontenjan dolu'

\echo ''
\echo '=== 9) Kampanya kapalıyken hak verilmez ==='
update campaign_settings set max_users = 1000, active = false;
insert into auth.users (id, email, phone, phone_confirmed_at)
values ('c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3', 'kampanya-kapali@example.com',
        '+905551113333', now())
on conflict (id) do nothing;
select pg_temp.ilan_yayinla('c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3', 'Kapalıyken ilan') as pid \gset i6_
select count(*) as kapaliyken_hak from campaign_grants
 where user_id = 'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3';
\echo 'BEKLENEN: 0'

\echo ''
\echo '=== 10) Yükümlülük ölçümü yöneticiye görünür ==='
update campaign_settings set active = true;
set session role authenticated;
select set_config('test.uid', :'y', false);
select kullanici_sayisi, dagitilan_puan, ilk_ilan_hakki, ilk_satis_hakki
  from campaign_status();
\echo 'BEKLENEN: 1 kullanıcı, 500 puan, 1 ilan hakkı, 1 satış hakkı'

\echo ''
\echo '=== 11) SIRADAN KULLANICI ÖLÇÜMÜ GÖREMEZ ==='
select set_config('test.uid', :'d', false);
select count(*) as siradan_kullanici_gorur from campaign_status();
\echo 'BEKLENEN: 0'

reset role;
