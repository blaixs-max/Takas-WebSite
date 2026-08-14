-- KIDS TRADE — Güven skoru ve profil istatistikleri testleri
--
-- Kritik iddialar: 1 (işlemi olmayanın skoru YOKTUR — uydurulmuş 100 de
-- yanlıştır), 4 (kabul edilen iade satıcının skorunu düşürür), 5 (reddedilen
-- asılsız talep ALICININ skorunu düşürür) ve 8 (ceza kırılımı başkasına
-- gösterilmez).

\set s '33cc33cc-33cc-33cc-33cc-33cc33cc33cc'
\set b '44dd44dd-44dd-44dd-44dd-44dd44dd44dd'

\echo ''
\echo '=== Hazırlık ==='
insert into auth.users (id, email, phone, phone_confirmed_at, raw_user_meta_data)
values (:'s', 'guven-satici@example.com', '+905558880001', now(),
        '{"full_name":"Zeynep Demir"}'::jsonb),
       (:'b', 'guven-alici@example.com',  '+905558880002', now(),
        '{"full_name":"Ali Kaya"}'::jsonb)
on conflict (id) do nothing;

select available_points from earn_points(:'b', 8000, 'test:guven-alici-bakiye');

create or replace function pg_temp.ilan(p_baslik text, p_puan integer)
returns text language plpgsql as $$
declare pid text; sid text := '33cc33cc-33cc-33cc-33cc-33cc33cc33cc';
begin
  perform set_config('test.uid', sid, false);
  select id into pid from create_listing(p_baslik, 'Oyun & Oyuncak', 'Az kullanılmış', 'M', p_puan, p_sub_category => 'Yapı & inşa');
  insert into product_photos (product_id, slot, storage_path, moderation_status)
  select pid, s, sid || '/' || pid || '/' || s || '.jpg', 'approved'
    from unnest(array['front','back','left','right','label']::photo_slot[]) s;
  perform publish_listing(pid, 'front');
  return pid;
end; $$;

-- Teslim edilmiş takas üretir.
create or replace function pg_temp.teslim(p_baslik text, p_puan integer)
returns uuid language plpgsql as $$
declare pid text; tid uuid; bid text := '44dd44dd-44dd-44dd-44dd-44dd44dd44dd';
begin
  pid := pg_temp.ilan(p_baslik, p_puan);
  perform set_config('test.uid', bid, false);
  select id into tid from create_trade(pid, bid::uuid);
  update trades set status = 'SHIPPED' where id = tid;
  perform mark_delivered(tid);
  return tid;
end; $$;

\echo ''
\echo '=== 1) İŞLEMİ OLMAYANIN SKORU YOKTUR ==='
select skor is null as skor_yok, islem_sayisi from user_trust(:'s');
\echo 'BEKLENEN: skor yok (null), 0 işlem — uydurulmuş 100 de yanlıştır'

\echo ''
\echo '=== 2) İlk tamamlanan takastan sonra skor 100 ==='
select pg_temp.teslim('Temiz takas', 300) as id \gset t1_
set session role authenticated;
select set_config('test.uid', :'b', false);
select status from confirm_delivery(:'t1_id');
reset role;
select skor, islem_sayisi from user_trust(:'s');
\echo 'BEKLENEN: 100, 1 işlem'

\echo ''
\echo '=== 3) Alıcının da skoru oluştu (aynı takas iki tarafa da sayılır) ==='
select skor, islem_sayisi from user_trust(:'b');
\echo 'BEKLENEN: 100, 1 işlem'

\echo ''
\echo '=== 4) KABUL EDİLEN İADE SATICININ SKORUNU DÜŞÜRÜR ==='
select pg_temp.teslim('Ayıplı ürün', 300) as id \gset t2_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from open_dispute(:'t2_id', 'Ürün kırık') \gset d2_
select status from add_dispute_evidence(:'d2_id', :'b' || '/kirik.jpg');
reset role;
select resolution from resolve_dispute(:'d2_id', true, 'Ayıp doğrulandı');
select skor, ayipli_satis from user_trust(:'s');
\echo 'BEKLENEN: 85, 1 ayıplı satış'

\echo ''
\echo '=== 5) REDDEDİLEN ASILSIZ TALEP ALICININ SKORUNU DÜŞÜRÜR ==='
select pg_temp.teslim('Sağlam ürün', 300) as id \gset t3_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from open_dispute(:'t3_id', 'Beğenmedim') \gset d3_
reset role;
select status from resolve_dispute(:'d3_id', false, 'Ürün ilanla uyumlu');
select skor, asilsiz_talep from user_trust(:'b');
\echo 'BEKLENEN: 90, 1 asılsız talep'

\echo ''
\echo '=== 6) Ödenmemiş satıcı borcu da düşürür ==='
select pg_temp.teslim('Pahalı ayıplı', 800) as id \gset t4_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from open_dispute(:'t4_id', 'Ayıplı') \gset d4_
select status from add_dispute_evidence(:'d4_id', :'b' || '/ayip.jpg');
reset role;
select resolution from resolve_dispute(:'d4_id', true, 'Ayıp doğrulandı', false, 78.00);
select skor, ayipli_satis, odenmemis_borc from user_trust(:'s');
\echo 'BEKLENEN: 60 (100 - 2×15 ayıplı - 1×10 borç), 2 ayıplı, 1 borç'

\echo ''
\echo '=== 7) Borç ödenince ceza kalkar ==='
update seller_debts set status = 'PAID', settled_at = now() where seller_id = :'s';
select skor, odenmemis_borc from user_trust(:'s');
\echo 'BEKLENEN: 70, 0 borç'

\echo ''
\echo '=== 8) BAŞKASININ SKORU HİÇ SORGULANAMAZ ==='
-- Bu bölüm eskiden "kırılım gösterilmez, özet skor görünür" diyordu ve
-- `seller_trust_score(:'s')` çağırıp 70 bekliyordu. `rpc_grants` o yetkiyi
-- `authenticated`dan geri aldı: elinde anon/oturum anahtarı olan herkesin
-- istediği kullanıcının güven skorunu sorgulayabilmesi başlı başına bir
-- sızıntıydı. Yani güvenlik duruşu değişti ve testin eski beklentisi artık
-- **yanlış olanı** doğruluyordu.
--
-- Doğru beklenti bu: çağrı reddedilir. Skor kullanıcıya kendi `profile_stats()`
-- çağrısıyla ulaşıyor (aşağıdaki 9. bölüm) ve ilan kartındaki skoru sunucu
-- `products.seller_trust` sütununa yazıyor.
set session role authenticated;
select set_config('test.uid', :'b', false);
do $$
begin
  perform seller_trust_score('22222222-2222-2222-2222-222222222222');
  raise exception 'BEKLENMEDİK: başkasının güven skoru sorgulanabildi';
exception
  when insufficient_privilege then
    raise notice 'BEKLENEN: yetki reddedildi';
end
$$;

\echo ''
\echo '=== 9) Profil istatistikleri gerçek sayıları veriyor ==='
select set_config('test.uid', :'s', false);
select available_points, basarili_takas, aktif_takas, yayindaki_ilan, satilan_ilan, trust_skor
  from profile_stats();
-- Yayındaki 2: iadesi kabul edilen iki ilan REFUNDED ile vitrine döndü.
-- Aktif 1: 5'teki takas reddedilen itirazdan sonra DELIVERED'a döndü, hâlâ açık.
\echo 'BEKLENEN: gerçek bakiye, 1 başarılı takas, 1 aktif, 2 yayında, 1 satılan, skor 70'

\echo ''
\echo '=== 10) Oturumsuz çağrı boş döner ==='
select set_config('test.uid', '', false);
select count(*) as oturumsuz_satir from profile_stats();
\echo 'BEKLENEN: 0'

\echo ''
\echo '=== 11) Skor sıfırın altına inmez ==='
reset role;
update trust_penalties set ayipli_satis = 200;
select skor from user_trust(:'s');
update trust_penalties set ayipli_satis = 15;
\echo 'BEKLENEN: 0 — negatif skor yok'
