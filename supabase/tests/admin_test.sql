-- KIDS TRADE — Yönetici yetkisi, kuyruklar ve denetim kaydı testleri
--
-- En kritik iddialar: 2 (sıradan kullanıcı yönetici fonksiyonlarını çağıramaz),
-- 3 (yönetici listesi kimseye görünmez), 9 (denetim kaydı değiştirilemez) ve
-- 10 (yetki alınınca aynı oturum anında yetkisiz kalır).

\set a '99999999-9999-9999-9999-999999999999'
\set s 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
\set b 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

\echo ''
\echo '=== Hazırlık ==='
insert into auth.users (id, email, raw_user_meta_data)
values (:'a', 'yonetici@example.com', '{"full_name":"Yönetici Kişi"}'::jsonb),
       (:'s', 'admin-satici@example.com', '{"full_name":"Zeynep Demir"}'::jsonb),
       (:'b', 'admin-alici@example.com',  '{"full_name":"Ali Kaya"}'::jsonb)
on conflict (id) do nothing;

insert into admins (user_id, note) values (:'a', 'test yöneticisi')
on conflict (user_id) do nothing;

select available_points from earn_points(:'b', 4000, 'test:admin-alici-bakiye');

-- Taslak ilan üretir: kareler yüklenir ama moderasyondan geçmez.
create or replace function pg_temp.taslak_ilan(p_baslik text)
returns text language plpgsql as $$
declare pid text; sid text := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
begin
  perform set_config('test.uid', sid, false);
  select id into pid from create_listing(p_baslik, 'Oyun & Oyuncak', 'Az kullanılmış', 'M', p_sub_category => 'Yapı & inşa');
  insert into product_photos (product_id, slot, storage_path)
  select pid, s, sid || '/' || pid || '/' || s || '.jpg'
    from unnest(array['front','back','left','right','label']::photo_slot[]) s;
  return pid;
end; $$;

create temp table a_ids (ad text primary key, deger text);
grant all on a_ids to authenticated;

\echo ''
\echo '=== 1) Moderasyon kuyruğu bekleyen kareleri gösterir ==='
select pg_temp.taslak_ilan('Bekleyen ilan') as pid \gset p1_
-- Kare kimliğini rol değişmeden alıyoruz: alıcı rolündeyken RLS kareyi
-- gizliyor ve \gset boş dönüyor.
select id from product_photos where product_id = :'p1_pid' and slot = 'front' \gset f1_
insert into a_ids values ('f1', :'f1_id'), ('p1', :'p1_pid');
set session role authenticated;
select set_config('test.uid', :'a', false);
select count(*) as kuyrukta, count(distinct product_id) as ilan
  from admin_photo_queue();
\echo 'BEKLENEN: 5 kare, 1 ilan'

\echo ''
\echo '=== 2) SIRADAN KULLANICI KUYRUĞU GÖREMEZ ==='
select set_config('test.uid', :'b', false);
select count(*) as siradan_kullanici_gorur from admin_photo_queue();
\echo 'BEKLENEN: 0 — is_admin() false, kuyruk boş döner'

\echo ''
\echo '=== 3) SIRADAN KULLANICI KARE ONAYLAYAMAZ ==='
do $$
declare fid uuid;
begin
  select deger::uuid into fid from a_ids where ad = 'f1';
  perform admin_moderate_photo(fid, true);
  raise notice 'SONUÇ: HATA — sıradan kullanıcı kare onayladı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 4) YÖNETİCİ LİSTESİ KİMSEYE GÖRÜNMEZ ==='
select count(*) as alici_gorur from admins;
select set_config('test.uid', :'a', false);
select count(*) as yonetici_gorur from admins;
\echo 'BEKLENEN: alıcı 0, yönetici 1 (yalnız kendi satırı)'

\echo ''
\echo '=== 5) Gerekçesiz ret kabul edilmez ==='
do $$
declare fid uuid;
begin
  select deger::uuid into fid from a_ids where ad = 'f1';
  perform admin_moderate_photo(fid, false, '   ');
  raise notice 'SONUÇ: HATA — gerekçesiz ret geçti';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 6) Yönetici kareleri onaylar, ilan yayına alınabilir hâle gelir ==='
select count(*) as onaylanan from (
  select admin_moderate_photo(id, true) from product_photos where product_id = :'p1_pid'
) x;
select set_config('test.uid', :'s', false);
select test_degerle(:'p1_pid');
select status from publish_listing(:'p1_pid', 'front');
\echo 'BEKLENEN: 5 onaylandı, ACTIVE'

\echo ''
\echo '=== 7) İtiraz kuyruğu eşik bilgisiyle birlikte gelir ==='
reset role;
-- 800 puanlık bir takas: eşiğin üstünde olmalı.
select set_config('test.uid', :'s', false);
select id as pid from create_listing('Pahalı ürün', 'Oyun & Oyuncak', 'İyi durumda', 'M', p_sub_category => 'Yapı & inşa') \gset p2_
insert into product_photos (product_id, slot, storage_path, moderation_status)
select :'p2_pid', s, :'s' || '/' || :'p2_pid' || '/' || s || '.jpg', 'approved'
  from unnest(array['front','back','left','right','label']::photo_slot[]) s;
select test_degerle(:'p2_pid');
select status from publish_listing(:'p2_pid', 'front');
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from create_trade(:'p2_pid', :'b') \gset t2_
reset role;
update trades set status = 'SHIPPED' where id = :'t2_id';
select status from mark_delivered(:'t2_id');
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from open_dispute(:'t2_id', 'Ürün ilanla uyuşmuyor') \gset d2_
insert into a_ids values ('d2', :'d2_id');
select set_config('test.uid', :'a', false);
select dispute_status, points, esigin_ustunde, kanit_sayisi
  from admin_dispute_queue() where dispute_id = :'d2_id';
\echo 'BEKLENEN: NEEDS_EVIDENCE, 800, eşiğin üstünde t, kanıt 0'

\echo ''
\echo '=== 8) Gerekçesiz karar kabul edilmez ==='
do $$
declare did uuid;
begin
  select deger::uuid into did from a_ids where ad = 'd2';
  perform admin_resolve_dispute(did, true, '');
  raise notice 'SONUÇ: HATA — gerekçesiz karar geçti';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 9) Yönetici kararı: iade + satıcı borcu + denetim kaydı ==='
select resolution from admin_resolve_dispute(:'d2_id', true, 'Kanıtlar ayıbı gösteriyor', false, 78.00);
reset role;
select (select status from trades where id = :'t2_id')                    as takas,
       (select amount_tl from seller_debts where trade_id = :'t2_id')     as borc,
       (select action from audit_logs where subject = 'dispute:' || :'d2_id')      as kayit,
       (select actor_id = :'a' from audit_logs where subject = 'dispute:' || :'d2_id') as kim;
\echo 'BEKLENEN: REFUNDED, borç 78.00, dispute.accept, kim = yönetici'

\echo ''
\echo '=== 10) DENETİM KAYDI DEĞİŞTİRİLEMEZ VE SİLİNEMEZ ==='
do $$
begin
  update audit_logs set action = 'dispute.reject' where action = 'dispute.accept';
  raise notice 'SONUÇ: HATA — denetim kaydı değiştirildi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
do $$
begin
  delete from audit_logs;
  raise notice 'SONUÇ: HATA — denetim kaydı silindi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 11) YETKİ ALININCA AYNI OTURUM ANINDA YETKİSİZ KALIR ==='
-- Yetki JWT'de olsaydı, elindeki token'la karar vermeye devam ederdi.
delete from admins where user_id = :'a';
set session role authenticated;
select set_config('test.uid', :'a', false);
select is_admin() as hala_yonetici_mi, (select count(*) from admin_photo_queue()) as kuyruk;
\echo 'BEKLENEN: f, kuyruk 0'

reset role;
