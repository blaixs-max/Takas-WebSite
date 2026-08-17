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
select id, status from create_listing('Ahşap tren', 'Oyun & Oyuncak', 'Az kullanılmış', 'M', p_sub_category => 'Yapı & inşa') \gset p_
select bekle_esit('yeni ilan DRAFT açılır',
                  (select status from products where id = :'p_id'), 'DRAFT');

\echo ''
\echo '=== 2) Beş zorunlu kare — hasarsız, set değil ==='
-- `required_slots` iç bir yardımcıdır: `publish_listing` onu kendi içinde
-- çağırıyor, uygulama ise zorunlu kareleri istemcide hesaplıyor
-- (`data/photoSlots.ts`). Bu yüzden `rpc_grants` onu `authenticated`dan geri
-- aldı ve test o rolde çağırdığı için düşüyordu. Kural doğru; test yanlış
-- roldeydi. Çağrılar yetkili rolde yapılıyor, ilan oluşturma ve yayına alma
-- adımları `authenticated` olarak kalıyor.
reset role;
select bekle_esit('beyansız ilanda zorunlu slotlar',
                  array_to_string(required_slots(:'p_id'), ', '),
                  'front, back, left, right');
set session role authenticated;

\echo ''
\echo '=== 3) Kare eksikken yayına alınamaz ==='
do $$
declare pid text;
begin
  select id into pid from products where status = 'DRAFT' limit 1;
  perform test_degerle(pid);
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
select bekle_esit('beş kare yüklendi',
                  (select count(*) from product_photos where product_id = :'p_id'), 5::bigint);
select bekle_esit('hepsi incelemeyi bekliyor',
                  (select count(*) from product_photos
                    where product_id = :'p_id' and moderation_status = 'pending'), 5::bigint);

\echo ''
\echo '=== 5) BEKLEYEN MODERASYON OTOMATİK ONAY DEĞİLDİR ==='
do $$
declare pid text;
begin
  select id into pid from products where status = 'DRAFT' limit 1;
  perform test_degerle(pid);
  perform publish_listing(pid);
  raise notice 'SONUÇ: HATA — incelenmemiş kareyle yayına girdi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 6) Reddedilen kare de geçirmez ==='
reset role;
update product_photos set moderation_status = 'approved' where product_id = :'p_id';
-- Reddedilen kare ZORUNLU slotta: yayın durmalı, kare gerçekten gerekli.
update product_photos set moderation_status = 'rejected', moderation_reason = 'bulanık'
 where product_id = :'p_id' and slot = 'back';
set session role authenticated;
select set_config('test.uid', :'s', false);
/* İlan kimliği açıkça veriliyor. Önceden `where status = 'DRAFT' limit 1`
   yazıyordu ve sırasız bir seçim başka bir taslağı yakalıyordu: test
   "engellendi" görüp geçiyordu ama gerekçe "eksik kare"ydi, yani reddedilen
   kare hiç sınanmamıştı. Yanlış sebeple geçen test, olmayan testten kötüdür. */
select set_config('test.pid', :'p_id', false);
do $$
declare pid text := current_setting('test.pid');
begin
  perform test_degerle(pid);
  perform publish_listing(pid);
  raise notice 'SONUÇ: HATA — reddedilen zorunlu kareyle yayına girdi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 6b) ZORUNLU OLMAYAN slottaki ret yayını kilitlemez ==='
-- Canlıda çıkan çıkmaz (2026-08-17): etiket karesi reddedilince ilan kalıcı
-- olarak yayına alınamıyordu. Etiket zorunlu değil; "zorunlu değil" demek,
-- o karenin ilanı kilitleyememesi demek. Kapı artık reddedilmiş zorunsuz
-- kareyi siliyor — yok sayıp bırakmak, galeriyi silinmiş bir dosyaya
-- baktırırdı.
reset role;
update product_photos set moderation_status = 'approved' where product_id = :'p_id';
update product_photos set moderation_status = 'rejected', moderation_reason = 'sigara paketi'
 where product_id = :'p_id' and slot = 'label';
set session role authenticated;
select set_config('test.uid', :'s', false);
select test_degerle(:'p_id');
select status from publish_listing(:'p_id', 'front');
select bekle_esit('zorunsuz slottaki ret yayını kilitlemez',
                  (select status from products where id = :'p_id'), 'ACTIVE');
select bekle_esit('reddedilen zorunsuz kare satırı silinir',
                  (select count(*) from product_photos
                    where product_id = :'p_id' and slot = 'label'), 0::bigint);

\echo ''
\echo '=== 6c) Kullanıcı kendi karesini onaylayamaz ==='
-- UPDATE politikası eklendi (yeniden çekim onsuz 403 veriyordu). Politika
-- satırı açıyor ama hangi kolonun değişebileceğini söyleyemiyor; sınır
-- tetikleyicide. Bu iddia düşerse denetimin tamamı süs olur.
select id from create_listing('Onay denemesi', 'Oyun & Oyuncak', 'İyi durumda', 'S',
                              p_sub_category => 'Yapı & inşa') \gset o_
insert into product_photos (product_id, slot, storage_path)
values (:'o_id', 'front', :'s' || '/' || :'o_id' || '/front.jpg');
update product_photos set moderation_status = 'approved'
 where product_id = :'o_id' and slot = 'front';
/* Paketin kör noktasının saklandığı iddia. Tetikleyici bir tur boyunca
   `security definer` yazıldığı için hiç çalışmadı ve burası `approved`
   döndürdü; sonuç ekrana basılıp geçildiği için kimse görmedi. */
select bekle_esit('kullanıcı kendi karesini onaylayamaz',
                  (select moderation_status from product_photos
                    where product_id = :'o_id' and slot = 'front'), 'pending');

\echo ''
\echo '=== 7) Hepsi onaylıysa yayına girer ve kapak işaretlenir ==='
-- Kendi taslağıyla koşuyor: 6b ilanı zaten yayına aldı ve ACTIVE bir ilanı
-- ikinci kez yayınlamak başka bir kuralın hatasını verirdi.
select id from create_listing('Kapak denemesi', 'Oyun & Oyuncak', 'İyi durumda', 'S',
                              p_sub_category => 'Yapı & inşa') \gset kap_
insert into product_photos (product_id, slot, storage_path)
select :'kap_id', s, :'s' || '/' || :'kap_id' || '/' || s || '.jpg'
  from unnest(array['front','back','left','right']::photo_slot[]) s;
reset role;
update product_photos set moderation_status = 'approved' where product_id = :'kap_id';
set session role authenticated;
select set_config('test.uid', :'s', false);
select test_degerle(:'kap_id');
select status from publish_listing(:'kap_id', 'front');
select bekle_esit('hepsi onaylıysa yayına girer',
                  (select status from products where id = :'kap_id'), 'ACTIVE');
select bekle_esit('kapak front işaretlenir',
                  (select slot::text from product_photos
                    where product_id = :'kap_id' and is_cover), 'front');

\echo ''
\echo '=== 8) Hasar beyanı altıncı kareyi zorunlu yapar ==='
select id from create_listing('Hasarlı ürün', 'Oyun & Oyuncak', 'İyi durumda', 'S',
                              'Kadıköy', null, true, false, p_sub_category => 'Yapı & inşa') \gset h_
-- psql değişkenleri $$...$$ içinde ikame edilmez; DO bloğunun okuyabilmesi için
-- kimliği RLS'e tabi olmayan geçici bir tabloya koyuyoruz.
create temp table if not exists t_ids (ad text primary key, deger text);
insert into t_ids values ('hasarli', :'h_id') on conflict (ad) do update set deger = excluded.deger;
reset role;
select bekle_esit('hasar beyanı damage karesini zorunlu yapar',
                  array_to_string(required_slots(:'h_id'), ', '),
                  'front, back, left, right, damage');
set session role authenticated;

\echo ''
\echo '=== 9) Set beyanı yedinci kareyi zorunlu yapar ==='
select id from create_listing('Set ürün', 'Oyun & Oyuncak', 'İyi durumda', 'S',
                              'Kadıköy', null, false, true, p_sub_category => 'Yapı & inşa') \gset k_
reset role;
select bekle_esit('set beyanı parts karesini zorunlu yapar',
                  array_to_string(required_slots(:'k_id'), ', '),
                  'front, back, left, right, parts');
set session role authenticated;

\echo ''
\echo '=== 10) Başkasının ilanı yayına alınamaz ==='
select set_config('test.uid', :'b', false);
do $$
declare pid text;
begin
  -- Kimlik doğrudan veriliyor: RLS'in görünmezliğine değil, publish_listing
  -- içindeki sahiplik kontrolüne takılmalı.
  select deger into pid from t_ids where ad = 'hasarli';
  perform test_degerle(pid);
  perform publish_listing(pid);
  raise notice 'SONUÇ: HATA — yabancı ilanı yayınladı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 11) Taslak ilan vitrinde görünmez ==='
select set_config('test.uid', :'s', false);
/* Sayıya değil kimliğe bağlanıyor. Önceki hâli "vitrinde 1, taslak 2" diye
   sayıyordu; testler tek veri tabanını paylaştığı için sayı önceki dosyalar
   ilan açtıkça kayıyordu ve gerçek 6'ya çıkmıştı. Kimse görmedi, çünkü
   karşılaştırılmıyordu. Bir testin iddiası, kendi kurduğu duruma bağlı
   olmalı — başka dosyaların kaç ilan açtığına değil. */
select id from create_listing('Vitrin dışı taslak', 'Oyun & Oyuncak', 'İyi durumda', 'S',
                              p_sub_category => 'Yapı & inşa') \gset v_
select bekle('yeni taslak vitrinde görünmez',
             not exists (select 1 from products
                          where id = :'v_id' and status = 'ACTIVE'));
select bekle('yayına alınan ilan vitrinde görünür',
             exists (select 1 from products
                      where id = :'kap_id' and status = 'ACTIVE'));

reset role;
