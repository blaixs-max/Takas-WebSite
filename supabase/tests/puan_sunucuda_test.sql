-- ELDENELE — Puan sunucuda, yayın kapısı değerleme istiyor
--
-- Kritik iddia 1: `create_listing` artık puan **kabul etmiyor**. Eski imza
-- düşürülmeseydi PostgreSQL aşırı yükleme yapar, güncel olmayan istemci
-- eskisini çağırmaya devam eder ve hiçbir şey değişmezdi.
--
-- Kritik iddia 4: değerlenmemiş ilan yayına giremez. Bu, bütün turun sebebi —
-- puanı olmayan bir ilanı rafa koymak, kapalı devrede alıcının belirsiz
-- miktarda puan ödemesi demek.

\set s 'dd44dd44-0000-0000-0000-00000000a001'

\echo ''
\echo '=== Hazırlık ==='
insert into auth.users (id, email, phone, phone_confirmed_at, raw_user_meta_data)
values (:'s', 'deger-satici@example.com', '+905555550001', now(),
        '{"full_name":"Deniz Kaya"}'::jsonb)
on conflict (id) do nothing;

set session role authenticated;
select set_config('test.uid', :'s', false);

\echo ''
\echo '=== 1) ESKİ İMZA YOK ==='
-- Puanlı çağrı artık bulunmamalı. Bulunursa güncel olmayan istemci eski yolu
-- kullanmaya devam eder ve denetim hiç devreye girmez.
select count(*) = 0 as eski_imza_dusuruldu
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'create_listing'
   and pg_get_function_identity_arguments(p.oid) like '%integer%';
\echo 'BEKLENEN: eski_imza_dusuruldu = t'

\echo ''
\echo '=== 2) Yeni ilan puansız doğuyor ==='
select id, points is null as puan_bos, degerleme_at is null as degerleme_yok
  from create_listing('Ahşap tren seti', 'Oyun & Oyuncak', 'İyi durumda', 'M',
                      p_sub_category => 'Yapı & inşa') \gset y_
select :'y_puan_bos' = 't' as puansiz_dogdu;
\echo 'BEKLENEN: puansiz_dogdu = t'

\echo ''
\echo '=== 3) Kareler tamam ama değerleme yok — YAYIN REDDEDİLİR ==='
reset role;
insert into product_photos (product_id, slot, storage_path, moderation_status)
select :'y_id', s, :'s' || '/' || :'y_id' || '/' || s || '.jpg', 'approved'
  from unnest(array['front','back','left','right']::photo_slot[]) s;
set session role authenticated;
select set_config('test.uid', :'s', false);
do $$
declare pid text;
begin
  select id into pid from products where title = 'Ahşap tren seti';
  perform publish_listing(pid, 'front');
  raise notice 'SONUÇ: HATA — değerlenmemiş ilan yayına girdi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
\echo 'BEKLENEN: "ilan henüz değerlenmedi" ile engellendi'

\echo ''
\echo '=== 4) DEĞERLEME YAZILINCA PUAN ÇIKIYOR ==='
reset role;
select points, sifir_fiyat, degerleme_guven
  from degerleme_yaz(:'y_id', 1599, 'trendyol.com/superman-figur', 0.86, 'gemini-3.7-flash') \gset d_
select :d_points = 990 as puan_dogru;
\echo 'BEKLENEN: puan_dogru = t (1599 × %62 = 990)'

\echo ''
\echo '=== 5) Değerlemeden sonra yayın geçiyor ==='
set session role authenticated;
select set_config('test.uid', :'s', false);
select status from publish_listing(:'y_id', 'front') \gset p_
select :'p_status' = 'ACTIVE' as yayina_girdi;
\echo 'BEKLENEN: yayina_girdi = t'

\echo ''
\echo '=== 6) FİYAT BULUNAMAYAN İLAN YAYINA GİREMEZ ==='
-- Model ürünü tanıyamazsa `puan_hesapla` null döner. O ilan taslakta kalmalı;
-- aksi hâlde değeri belirsiz bir şey rafa çıkardı.
select id from create_listing('Tanınmayan nesne', 'Oyun & Oyuncak', 'İyi durumda', 'M',
                              p_sub_category => 'Yapı & inşa') \gset t_
reset role;
insert into product_photos (product_id, slot, storage_path, moderation_status)
select :'t_id', s, :'s' || '/' || :'t_id' || '/' || s || '.jpg', 'approved'
  from unnest(array['front','back','left','right']::photo_slot[]) s;
select points is null as puan_yok from degerleme_yaz(:'t_id', null, 'bulunamadı', 0.10, 'gemini-3.7-flash');
set session role authenticated;
select set_config('test.uid', :'s', false);
do $$
declare pid text;
begin
  select id into pid from products where title = 'Tanınmayan nesne';
  perform publish_listing(pid, 'front');
  raise notice 'SONUÇ: HATA — puansız ilan yayına girdi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
\echo 'BEKLENEN: "piyasa değeri bulunamadı" ile engellendi'

\echo ''
\echo '=== 7) BANT DIŞI PUAN YAYINA GİREMEZ ==='
select id from create_listing('Çok pahalı şey', 'Oyun & Oyuncak', 'Yeni gibi', 'M',
                              p_sub_category => 'Yapı & inşa') \gset b_
reset role;
insert into product_photos (product_id, slot, storage_path, moderation_status)
select :'b_id', s, :'s' || '/' || :'b_id' || '/' || s || '.jpg', 'approved'
  from unnest(array['front','back','left','right']::photo_slot[]) s;
select points from degerleme_yaz(:'b_id', 100000, 'şüpheli kaynak', 0.40, 'gemini-3.7-flash') \gset x_
set session role authenticated;
select set_config('test.uid', :'s', false);
do $$
declare pid text;
begin
  select id into pid from products where title = 'Çok pahalı şey';
  perform publish_listing(pid, 'front');
  raise notice 'SONUÇ: HATA — bant dışı puan yayına girdi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
\echo 'BEKLENEN: "olağandışı yüksek" ile engellendi (puan kırpılmadı, işaretlendi)'

\echo ''
\echo '=== 8) degerleme_yaz istemciye kapalı ==='
reset role;
select has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
       has_function_privilege('anon', p.oid, 'execute') as anon
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'degerleme_yaz';
\echo 'BEKLENEN: ikisi de f — puanı yazabilen istemci, puanı seçebilir demektir'
