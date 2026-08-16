-- ELDENELE — Kategori matrisi testleri
--
-- Göç: 20260813072758_kategori_matrisi.sql
-- Sınanan kurallar: ağaç eksiksiz seed edildi, ana kategori ağaçtan gelmek
-- zorunda, alt kategori ana kategorisiyle tutarlı olmak zorunda, alt
-- kategorisiz ilan yayına giremez, kategori doğrudan UPDATE ile değişmez.

\set s '22222222-2222-2222-2222-222222222222'

\echo ''
\echo '=== Hazırlık: satıcı hesabı ==='
insert into auth.users (id, email, raw_user_meta_data)
values (:'s', 'zeynep.demir@example.com', '{"full_name":"Zeynep Demir"}'::jsonb)
on conflict (id) do nothing;

set session role authenticated;
select set_config('test.uid', :'s', false);

\echo ''
\echo '=== 1) Ağaç eksiksiz ==='
select (select count(*) from product_categories)     as ana,
       (select count(*) from product_sub_categories) as alt;
\echo 'BEKLENEN: 9 | 62'

\echo ''
\echo '=== 2) Altsız ana kategori yok ==='
select count(*) as altsiz_ana
  from product_categories c
 where not exists (select 1 from product_sub_categories s where s.category = c.name);
\echo 'BEKLENEN: 0'

\echo ''
\echo '=== 3) Demo ilanlar yeni ağaca taşındı ==='
select category, sub_category, count(*) as adet
  from products group by 1, 2 order by 1, 2;
\echo 'BEKLENEN: yalnızca "Oyun & Oyuncak" satırları, alt kategorileri dolu'

\echo ''
\echo '=== 4) Ağaçta olmayan ana kategori reddedilir ==='
do $$
begin
  perform create_listing('Uydurma kategori', 'Zırva', 'Az kullanılmış', 'S', 100,
                         p_sub_category => 'Yapı & inşa');
  raise notice 'SONUÇ: HATA — geçersiz kategori kabul edildi';
exception when others then
  raise notice 'SONUÇ: doğru — reddedildi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 5) Başka ana kategorinin alt kategorisi reddedilir ==='
do $$
begin
  perform create_listing('Yanlış eşleşme', 'Giyim & Ayakkabı', 'Az kullanılmış', 'S', 100,
                         p_sub_category => 'Bisiklet');
  raise notice 'SONUÇ: HATA — yanlış çift kabul edildi';
exception when others then
  raise notice 'SONUÇ: doğru — reddedildi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 6) Alt kategorisiz taslak açılır ==='
select id from create_listing('Alt kategorisiz', 'Oyun & Oyuncak', 'Az kullanılmış', 'S', 100) \gset a_
-- psql değişkenleri $$...$$ içinde ikame edilmez; kimliği geçici bir tabloya
-- koyup DO bloklarında oradan okuyoruz (bkz. product_photos_test).
create temp table if not exists t_kat (ad text primary key, deger text);
insert into t_kat values ('ilan', :'a_id') on conflict (ad) do update set deger = excluded.deger;
select category, sub_category, status from products where id = :'a_id';
\echo 'BEKLENEN: Oyun & Oyuncak | (boş) | DRAFT'

\echo ''
\echo '=== 7) ...ama yayına alınamaz ==='
-- Kapı alt kategoriyi karelerden ÖNCE denetler: kare olmadan da doğru hatayı
-- vermeli, yoksa kullanıcı eksik kare sanıp fotoğraf çekmeye giderdi.
do $$
declare pid text;
begin
  select deger into pid from t_kat where ad = 'ilan';
  perform publish_listing(pid, 'front');
  raise notice 'SONUÇ: HATA — alt kategorisiz ilan yayına girdi';
exception when others then
  raise notice 'SONUÇ: doğru — reddedildi (%)', sqlerrm;
end $$;
\echo 'BEKLENEN: alt kategori seçilmeden ilan yayına alınamaz'

\echo ''
\echo '=== 8) set_listing_category taslakta düzeltir ==='
select category, sub_category from set_listing_category(:'a_id', 'Oyun & Oyuncak', 'Puzzle & zekâ');
\echo 'BEKLENEN: Oyun & Oyuncak | Puzzle & zekâ'

\echo ''
\echo '=== 9) ...ama tutarsız çifti kabul etmez ==='
do $$
declare pid text;
begin
  select deger into pid from t_kat where ad = 'ilan';
  perform set_listing_category(pid, 'Oyun & Oyuncak', 'Ayakkabı');
  raise notice 'SONUÇ: HATA — tutarsız çift kabul edildi';
exception when others then
  raise notice 'SONUÇ: doğru — reddedildi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 10) Alt kategori dolunca kapı karelere geçer ==='
do $$
declare pid text;
begin
  select deger into pid from t_kat where ad = 'ilan';
  perform publish_listing(pid, 'front');
  raise notice 'SONUÇ: HATA — karesiz ilan yayına girdi';
exception when others then
  raise notice 'SONUÇ: doğru — reddedildi (%)', sqlerrm;
end $$;
\echo 'BEKLENEN: "eksik kare: ..." — artık alt kategoriden değil, kareden şikâyet ediyor'

\echo ''
\echo '=== 11) Kategori doğrudan UPDATE ile değiştirilemez ==='
do $$
declare pid text;
begin
  select deger into pid from t_kat where ad = 'ilan';
  update products set category = 'Beslenme', sub_category = 'Sofra ürünleri' where id = pid;
  raise notice 'SONUÇ: HATA — kategori doğrudan değişti';
exception when others then
  raise notice 'SONUÇ: doğru — reddedildi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 12) Ağaç dışı alt kategori dış anahtara takılır ==='
-- Guard aşılsa bile kısıt tutmalı; iki katman ayrı ayrı sınanıyor.
do $$
declare pid text;
begin
  select deger into pid from t_kat where ad = 'ilan';
  perform set_config('kt.bypass_product_guard', 'on', true);
  update products set sub_category = 'Zırva' where id = pid;
  perform set_config('kt.bypass_product_guard', 'off', true);
  raise notice 'SONUÇ: HATA — ağaç dışı alt kategori yazıldı';
exception when others then
  perform set_config('kt.bypass_product_guard', 'off', true);
  raise notice 'SONUÇ: doğru — reddedildi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 13) İlan sonunda beklenen yerde ==='
select category, sub_category, status from products where id = :'a_id';
\echo 'BEKLENEN: Oyun & Oyuncak | Puzzle & zekâ | DRAFT'

reset role;
\echo ''
\echo '=== BİTTİ ==='
