-- KIDS TRADE — Yaptırım merdiveni testleri (Ana Doküman 5.5)
--
-- Kritik iddialar: 1 (merdiven KAPALI kuruluyor — açılmadan kimse kısıtlanmaz),
-- 5 (kısıt gerçekten yeni ilanı ve yeni alımı durduruyor), 6 (süren takaslar
-- tamamlanabiliyor), 7 (kalıcı kapatmayı yalnızca insan verir) ve 8 (yanlış
-- uygulanan kısıt geri alınabiliyor).

\set s 'ccddccdd-ccdd-ccdd-ccdd-ccddccddccdd'
\set b 'ddeeddee-ddee-ddee-ddee-ddeeddeeddee'
\set y 'eeffeeff-eeff-eeff-eeff-eeffeeffeeff'

\echo ''
\echo '=== Hazırlık ==='
insert into auth.users (id, email, phone, phone_confirmed_at, raw_user_meta_data)
values (:'s', 'ceza-satici@example.com', '+905554440001', now(),
        '{"full_name":"Zeynep Demir"}'::jsonb),
       (:'b', 'ceza-alici@example.com',  '+905554440002', now(),
        '{"full_name":"Ali Kaya"}'::jsonb),
       (:'y', 'ceza-yonetici@example.com', '+905554440003', now(), '{}'::jsonb)
on conflict (id) do nothing;

insert into admins (user_id, note) values (:'y', 'yaptırım testi')
on conflict (user_id) do nothing;

select available_points from earn_points(:'b', 9000, 'test:ceza-alici-bakiye');

create or replace function pg_temp.ilan(p_baslik text, p_puan integer)
returns text language plpgsql as $$
declare pid text; sid text := 'ccddccdd-ccdd-ccdd-ccdd-ccddccddccdd';
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

create or replace function pg_temp.teslim(p_baslik text, p_puan integer)
returns uuid language plpgsql as $$
declare pid text; tid uuid; bid text := 'ddeeddee-ddee-ddee-ddee-ddeeddeeddee';
begin
  pid := pg_temp.ilan(p_baslik, p_puan);
  perform set_config('test.uid', bid, false);
  select id into tid from create_trade(pid, bid::uuid);
  update trades set status = 'SHIPPED' where id = tid;
  perform mark_delivered(tid);
  return tid;
end; $$;

-- Satıcıya bir ayıplı satış yazdıralım (skor 85) ve merdiven kapalıyken bakalım.
create or replace function pg_temp.ayipli_satis(p_baslik text)
returns void language plpgsql as $$
declare tid uuid; did uuid; bid text := 'ddeeddee-ddee-ddee-ddee-ddeeddeeddee';
begin
  tid := pg_temp.teslim(p_baslik, 300);
  perform set_config('test.uid', bid, false);
  select id into did from open_dispute(tid, 'Ürün ayıplı');
  -- Depolama yolu benzersiz; her çağrıda ayrı bir ad gerekiyor.
  perform add_dispute_evidence(did, bid || '/' || did::text || '.jpg');
  perform resolve_dispute(did, true, 'Ayıp doğrulandı');
end; $$;

\echo ''
\echo '=== 0) Hazırlık: skorun oluşması için bir temiz takas ==='
-- Skoru olmayana yaptırım uygulanmaz (bilinçli). Merdiveni sınayabilmek için
-- satıcının önce en az bir tamamlanmış takası olmalı.
select pg_temp.teslim('Temiz takas', 300) as id \gset t0_
set session role authenticated;
select set_config('test.uid', :'b', false);
select status from confirm_delivery(:'t0_id');
reset role;
select skor from user_trust(:'s');
-- Kısıt geldikten SONRA tamamlanacak bir takas bırakıyoruz: 5.5'in "süren
-- takaslar tamamlanır" maddesini gerçekten sınamanın tek yolu bu.
select pg_temp.teslim('Süren takas', 300) as id \gset suren_
reset role;
\echo 'BEKLENEN: 100'

\echo ''
\echo '=== 1) MERDİVEN KAPALI KURULUYOR ==='
select active as acik_mi, warn_score, restrict_score from sanction_settings;
select pg_temp.ayipli_satis('Kapalıyken ayıplı');
select (select skor from user_trust(:'s')) as skor,
       (select count(*) from user_sanctions where user_id = :'s') as yaptirim;
\echo 'BEKLENEN: kapalı (f), 70/40 · skor 85e düştü ama YAPTIRIM 0'

\echo ''
\echo '=== 2) Merdiven açılınca uyarı basamağı işliyor ==='
update sanction_settings set active = true;
-- Her ayıplı satış −15. 2. → 70 (eşik 70'in altında DEĞİL), 3. → 55 → uyarı.
select pg_temp.ayipli_satis('Açıkken ayıplı 1');
select pg_temp.ayipli_satis('Açıkken ayıplı 2');
select (select skor from user_trust(:'s')) as skor,
       (select level from user_sanctions where user_id = :'s' and lifted_at is null) as basamak;
\echo 'BEKLENEN: skor 55, basamak WARNED'

\echo ''
\echo '=== 3) Uyarı ikinci kez yazılmıyor ==='
select pg_temp.ayipli_satis('Açıkken ayıplı 3');
select count(*) as uyari_sayisi from user_sanctions
 where user_id = :'s' and level = 'WARNED' and lifted_at is null;
\echo 'BEKLENEN: 1'

\echo ''
\echo '=== 4) Skor kısıt eşiğinin altına inince KISIT geliyor ==='
-- 4. ayıplı → 40. Eşik "40'ın altı" olduğu için 40 henüz kısıt değil; 5. → 25.
select (select skor from user_trust(:'s')) as skor_4uncude,
       (select count(*) from user_sanctions
         where user_id = :'s' and level = 'RESTRICTED' and lifted_at is null) as kisit_4uncude;
select pg_temp.ayipli_satis('Açıkken ayıplı 4');
select (select skor from user_trust(:'s')) as skor,
       (select count(*) from user_sanctions
         where user_id = :'s' and level = 'RESTRICTED' and lifted_at is null) as kisit;
\echo 'BEKLENEN: 4üncüde 40 ve kısıt 0; 5inciden sonra skor 25 ve kısıt 1'

\echo ''
\echo '=== 5) KISIT GERÇEKTEN DURDURUYOR ==='
select is_restricted(:'s') as satici_kisitli;
do $$
begin
  perform set_config('test.uid', 'ccddccdd-ccdd-ccdd-ccdd-ccddccddccdd', false);
  perform create_listing('Kısıtlıyken ilan', 'Oyun & Oyuncak', 'İyi durumda', 'S', p_sub_category => 'Yapı & inşa');
  raise notice 'SONUÇ: HATA — kısıtlı hesap yeni ilan verdi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 6) SÜREN TAKASLAR TAMAMLANABİLİYOR ==='
-- 5.5: kısıt yeni ilanı ve yeni alımı durdurur, süren takası değil.
select is_restricted(:'s') as satici_hala_kisitli;
set session role authenticated;
select set_config('test.uid', :'b', false);
select status from confirm_delivery(:'suren_id');
\echo 'BEKLENEN: satıcı kısıtlı (t) ama takas COMPLETED oldu'

\echo ''
\echo '=== 7) KALICI KAPATMAYI YALNIZCA İNSAN VERİR ==='
select set_config('test.uid', :'s', false);
do $$
begin
  perform admin_close_account('ddeeddee-ddee-ddee-ddee-ddeeddeeddee', 'Ben kapattım');
  raise notice 'SONUÇ: HATA — yetkisiz kullanıcı hesap kapattı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
select set_config('test.uid', :'y', false);
do $$
begin
  perform admin_close_account('eeffeeff-eeff-eeff-eeff-eeffeeffeeff', 'Kendimi kapatıyorum');
  raise notice 'SONUÇ: HATA — yönetici kendi hesabını kapattı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 8) YANLIŞ UYGULANAN KISIT GERİ ALINABİLİYOR ==='
-- Otomatik bir karar, itiraz edilemez bir karar olmamalı.
reset role;
select id as sid from user_sanctions
 where user_id = :'s' and level = 'RESTRICTED' and lifted_at is null \gset k_
set session role authenticated;
select set_config('test.uid', :'y', false);
select level from admin_lift_sanction(:'k_sid', 'İnceleme sonucu kısıt kaldırıldı');
reset role;
select is_restricted(:'s') as hala_kisitli;
\echo 'BEKLENEN: RESTRICTED kaldırıldı, artık kısıtlı değil (f)'

\echo ''
\echo '=== 9) Kısıt kalkınca yeniden ilan verebiliyor ==='
select set_config('test.uid', :'s', false);
select status from create_listing('Kısıt sonrası ilan', 'Oyun & Oyuncak', 'İyi durumda', 'S', p_sub_category => 'Yapı & inşa');
\echo 'BEKLENEN: DRAFT — ilan açılabildi'

\echo ''
\echo '=== 10) Gerekçesiz kapatma reddedilir ==='
set session role authenticated;
select set_config('test.uid', :'y', false);
do $$
begin
  perform admin_close_account('ddeeddee-ddee-ddee-ddee-ddeeddeeddee', '  ');
  raise notice 'SONUÇ: HATA — gerekçesiz kapatma geçti';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 11) Kapatılan hesap yeni takas açamıyor ==='
select level from admin_close_account(:'b', 'Tekrarlanan ihlal') \gset kapat_
reset role;
select is_restricted(:'b') as alici_kisitli;
select set_config('test.uid', :'s', false);
select id as pid from create_listing('Kapatma testi', 'Oyun & Oyuncak', 'İyi durumda', 'S', p_sub_category => 'Yapı & inşa') \gset pk_
insert into product_photos (product_id, slot, storage_path, moderation_status)
select :'pk_pid', s, :'s' || '/' || :'pk_pid' || '/' || s || '.jpg', 'approved'
  from unnest(array['front','back','left','right','label']::photo_slot[]) s;
select test_degerle(:'pk_pid');
select status from publish_listing(:'pk_pid', 'front');
do $$
declare pid text;
begin
  select id into pid from products where title = 'Kapatma testi' limit 1;
  perform set_config('test.uid', 'ddeeddee-ddee-ddee-ddee-ddeeddeeddee', false);
  perform create_trade(pid, 'ddeeddee-ddee-ddee-ddee-ddeeddeeddee'::uuid);
  raise notice 'SONUÇ: HATA — kapatılmış hesap takas açtı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 12) Yönetim listesi açık yaptırımları gösteriyor ==='
set session role authenticated;
select set_config('test.uid', :'y', false);
select level, otomatik from admin_sanction_list() where user_id = :'b';
\echo 'BEKLENEN: CLOSED, otomatik f (insan kararı)'

reset role;
update sanction_settings set active = false;
