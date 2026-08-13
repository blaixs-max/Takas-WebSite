-- KIDS TRADE — Yedi kare ve yayın kapısı testleri
--
-- Kapının işi şu: zorunlu karesi eksik ya da moderasyondan geçmemiş bir ilan
-- vitrine çıkmasın. En kritik iddia 5 numarada: bekleyen moderasyon otomatik
-- onay sayılmaz.

\set s '22222222-2222-2222-2222-222222222222'
\set b '11111111-1111-1111-1111-111111111111'

\echo ''
\echo '=== Hazırlık ==='
insert into auth.users (id, email, raw_user_meta_data)
values (:'s', 'zeynep@example.com', '{"full_name":"Zeynep Demir"}'::jsonb),
       (:'b', 'alici@example.com', '{}'::jsonb)
on conflict (id) do nothing;

set session role authenticated;
select set_config('test.uid', :'s', false);

\echo ''
\echo '=== 1) Yeni ilan TASLAK açılır, vitrine çıkmaz ==='
select id, status from create_listing('Ahşap tren', 'Oyun & Oyuncak', 'Az kullanılmış', 'M', 380, p_sub_category => 'Yapı & inşa') \gset p_
select status from products where id = :'p_id';
\echo 'BEKLENEN: DRAFT'

\echo ''
\echo '=== 2) Beş zorunlu kare — hasarsız, set değil ==='
select array_to_string(required_slots(:'p_id'), ', ') as zorunlu;
\echo 'BEKLENEN: front, back, left, right, label'

\echo ''
\echo '=== 3) Kare eksikken yayına alınamaz ==='
do $$
declare pid text;
begin
  select id into pid from products where status = 'DRAFT' limit 1;
  perform publish_listing(pid);
  raise notice 'SONUÇ: HATA — karesiz ilan yayına girdi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 4) Kareler yüklendi ama moderasyon beklemede ==='
insert into product_photos (product_id, slot, storage_path) values
  (:'p_id', 'front', :'s' || '/' || :'p_id' || '/front.jpg'),
  (:'p_id', 'back',  :'s' || '/' || :'p_id' || '/back.jpg'),
  (:'p_id', 'left',  :'s' || '/' || :'p_id' || '/left.jpg'),
  (:'p_id', 'right', :'s' || '/' || :'p_id' || '/right.jpg'),
  (:'p_id', 'label', :'s' || '/' || :'p_id' || '/label.jpg');
select count(*) as kare, count(*) filter (where moderation_status='pending') as bekleyen
  from product_photos where product_id = :'p_id';
\echo 'BEKLENEN: 5 kare, 5 bekleyen'

\echo ''
\echo '=== 5) BEKLEYEN MODERASYON OTOMATİK ONAY DEĞİLDİR ==='
do $$
declare pid text;
begin
  select id into pid from products where status = 'DRAFT' limit 1;
  perform publish_listing(pid);
  raise notice 'SONUÇ: HATA — incelenmemiş kareyle yayına girdi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 6) Reddedilen kare de geçirmez ==='
reset role;
update product_photos set moderation_status = 'approved' where product_id = :'p_id';
update product_photos set moderation_status = 'rejected', moderation_reason = 'bulanık'
 where product_id = :'p_id' and slot = 'label';
set session role authenticated;
select set_config('test.uid', :'s', false);
do $$
declare pid text;
begin
  select id into pid from products where status = 'DRAFT' limit 1;
  perform publish_listing(pid);
  raise notice 'SONUÇ: HATA — reddedilen kareyle yayına girdi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 7) Hepsi onaylıysa yayına girer ve kapak işaretlenir ==='
reset role;
update product_photos set moderation_status = 'approved' where product_id = :'p_id';
set session role authenticated;
select set_config('test.uid', :'s', false);
select status from publish_listing(:'p_id', 'front');
select slot, is_cover from product_photos where product_id = :'p_id' and is_cover;
\echo 'BEKLENEN: ACTIVE, kapak front'

\echo ''
\echo '=== 8) Hasar beyanı altıncı kareyi zorunlu yapar ==='
select id from create_listing('Hasarlı ürün', 'Oyun & Oyuncak', 'İyi durumda', 'S', 150,
                              'Kadıköy', null, true, false, p_sub_category => 'Yapı & inşa') \gset h_
-- psql değişkenleri $$...$$ içinde ikame edilmez; DO bloğunun okuyabilmesi için
-- kimliği RLS'e tabi olmayan geçici bir tabloya koyuyoruz.
create temp table if not exists t_ids (ad text primary key, deger text);
insert into t_ids values ('hasarli', :'h_id') on conflict (ad) do update set deger = excluded.deger;
select array_to_string(required_slots(:'h_id'), ', ') as zorunlu;
\echo 'BEKLENEN: front, back, left, right, label, damage'

\echo ''
\echo '=== 9) Set beyanı yedinci kareyi zorunlu yapar ==='
select id from create_listing('Set ürün', 'Oyun & Oyuncak', 'İyi durumda', 'S', 150,
                              'Kadıköy', null, false, true, p_sub_category => 'Yapı & inşa') \gset k_
select array_to_string(required_slots(:'k_id'), ', ') as zorunlu;
\echo 'BEKLENEN: front, back, left, right, label, parts'

\echo ''
\echo '=== 10) Başkasının ilanı yayına alınamaz ==='
select set_config('test.uid', :'b', false);
do $$
declare pid text;
begin
  -- Kimlik doğrudan veriliyor: RLS'in görünmezliğine değil, publish_listing
  -- içindeki sahiplik kontrolüne takılmalı.
  select deger into pid from t_ids where ad = 'hasarli';
  perform publish_listing(pid);
  raise notice 'SONUÇ: HATA — yabancı ilanı yayınladı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 11) Taslak ilan vitrinde görünmez ==='
select set_config('test.uid', :'s', false);
select count(*) as vitrinde from products where status = 'ACTIVE' and seller_id = :'s';
select count(*) as taslak from products where status = 'DRAFT' and seller_id = :'s';
\echo 'BEKLENEN: vitrinde 1, taslak 2'

reset role;
