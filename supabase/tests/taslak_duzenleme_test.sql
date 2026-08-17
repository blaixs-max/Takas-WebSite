-- ELDENELE — Taslak ilanı düzenleme (`update_listing`)
--
-- Kritik iddialar: 3 (değerlemeyi besleyen alan değişince puan siliniyor —
-- yoksa 'Hasarlı' seçip değerlenen kullanıcı 'Yeni gibi'ye çevirip düşük
-- puanla kalır ya da tersine bedava puan basar), 4 (etkisiz alanlar
-- değerlemeyi düşürmüyor — her düzenleme yeniden değerleme tetikleseydi
-- konumunu düzelten kullanıcı arama kotası yakardı), 5 (başkasının ilanı
-- düzenlenemiyor) ve 6 (yayındaki ilan düzenlenemiyor).

\set s 'cc33cc33-0000-0000-0000-00000000f001'
\set y 'cc33cc33-0000-0000-0000-00000000f002'

\echo ''
\echo '=== Hazırlık ==='
insert into auth.users (id, email, phone, phone_confirmed_at, raw_user_meta_data)
values (:'s', 'duzenle-satici@example.com',  '+905556660001', now(),
        '{"full_name":"Zeynep Demir"}'::jsonb),
       (:'y', 'duzenle-yabanci@example.com', '+905556660002', now(),
        '{"full_name":"Ali Kaya"}'::jsonb)
on conflict (id) do nothing;

select set_config('test.uid', :'s', false);
select id from create_listing('İlk başlık', 'Oyun & Oyuncak', 'İyi durumda', 'M',
                              p_location => 'Kadıköy, İstanbul',
                              p_description => 'ilk açıklama',
                              p_sub_category => 'Yapı & inşa') \gset d_

\echo ''
\echo '=== 1) Alanlar gerçekten güncelleniyor ==='
select id from update_listing(:'d_id', 'Yeni başlık', 'Oyun & Oyuncak', 'Az kullanılmış', 'L',
                              p_location => 'Çankaya, Ankara',
                              p_description => 'yeni açıklama',
                              p_sub_category => 'Bebek oyuncakları') \gset u_
select title = 'Yeni başlık' as baslik,
       condition = 'Az kullanılmış' as kondisyon,
       sub_category = 'Bebek oyuncakları' as alt_kategori,
       size_class = 'L' as desi,
       location = 'Çankaya, Ankara' as konum,
       description = 'yeni açıklama' as aciklama
  from products where id = :'d_id';
\echo 'BEKLENEN: altısı da t'

\echo ''
\echo '=== 2) Hasar beyanı kondisyondan türüyor, istemciden değil ==='
-- `create_listing` ile aynı kural. `p_has_damage => false` gönderiliyor ama
-- kondisyon 'Hasarlı'; istemciye güvenilseydi hasar karesi hiç istenmez ve
-- hasarlı ürün fotoğrafsız yayına girerdi.
select id from update_listing(:'d_id', 'Yeni başlık', 'Oyun & Oyuncak', 'Hasarlı', 'L',
                              p_has_damage => false,
                              p_sub_category => 'Bebek oyuncakları') \gset h_
select has_damage as hasar_zorlandi from products where id = :'d_id';
\echo 'BEKLENEN: hasar_zorlandi = t'

\echo ''
\echo '=== 3) DEĞERLEME BAYATLAYINCA SİLİNİYOR ==='
-- Bu dosyanın var olma sebebi. `listing-value` ilan başına bir kez çalışıyor
-- ve `degerleme_at` doluysa geri dönüyor; damga silinmeseydi kondisyonunu
-- değiştiren kullanıcının puanı eski beyanın puanı olarak kalırdı.
select test_degerle(:'d_id', 500);
select points = 500 as once_degerlendi, degerleme_at is not null as damga_vardi
  from products where id = :'d_id';
select id from update_listing(:'d_id', 'Yeni başlık', 'Oyun & Oyuncak', 'Yeni gibi', 'L',
                              p_sub_category => 'Bebek oyuncakları') \gset b_
select points is null as puan_silindi,
       degerleme_at is null as damga_silindi,
       sifir_fiyat is null as fiyat_silindi,
       degerleme_kaynak is null as kaynak_silindi
  from products where id = :'d_id';
\echo 'BEKLENEN: dördü de t — kondisyon değişti, ilan yeniden değerlenmeli'

\echo ''
\echo '=== 4) ETKİSİZ ALAN DEĞERLEMEYİ DÜŞÜRMÜYOR ==='
-- Konum ve desi kademesi modele hiç gitmiyor. Her düzenlemede damgayı
-- silseydik, konumunu düzelten kullanıcı bir arama çağrısı daha yakar ve
-- ilanı yeniden kuyruğa girerdi.
select test_degerle(:'d_id', 700);
select id from update_listing(:'d_id', 'Yeni başlık', 'Oyun & Oyuncak', 'Yeni gibi', 'XL',
                              p_location => 'Şişli, İstanbul',
                              p_sub_category => 'Bebek oyuncakları') \gset k_
select points = 700 as puan_duruyor,
       degerleme_at is not null as damga_duruyor,
       size_class = 'XL' as desi_degisti,
       location = 'Şişli, İstanbul' as konum_degisti
  from products where id = :'d_id';
\echo 'BEKLENEN: dördü de t'

\echo ''
\echo '=== 5) BAŞKASININ İLANI DÜZENLENEMİYOR ==='
-- "senin değil" değil "bulunamadı" diyoruz: ilkini demek, geçerli bir ilan
-- kimliğini doğrulamak olurdu.
do $$
declare pid text;
begin
  select id into pid from products where title = 'Yeni başlık';
  perform set_config('test.uid', 'cc33cc33-0000-0000-0000-00000000f002', false);
  perform update_listing(pid, 'Ele geçirildi', 'Oyun & Oyuncak', 'Yeni gibi', 'M',
                         p_sub_category => 'Bebek oyuncakları');
  raise notice 'SONUÇ: HATA — yabancı başkasının taslağını düzenleyebildi';
exception when others then
  raise notice 'SONUÇ: doğru — reddedildi (%)', sqlerrm;
end $$;
select title = 'Yeni başlık' as baslik_korundu from products where id = :'d_id';
\echo 'BEKLENEN: reddedildi, baslik_korundu = t'

\echo ''
\echo '=== 6) YAYINDAKİ İLAN DÜZENLENEMİYOR ==='
-- Yayındaki ilanın kondisyonunu değiştirmek puanını değiştirir ve o puanla
-- birinin sepetinde ya da açık bir takasında olabilir. Ayrı bir karar.
select set_config('test.uid', :'s', false);
insert into product_photos (product_id, slot, storage_path, moderation_status)
select :'d_id', s, :'s' || '/' || :'d_id' || '/' || s || '.jpg', 'approved'
  from unnest(array['front','back','left','right']::photo_slot[]) s;
select test_degerle(:'d_id', 700);
select publish_listing(:'d_id', 'front');
select status = 'ACTIVE' as yayinda from products where id = :'d_id';
do $$
declare pid text;
begin
  select id into pid from products where title = 'Yeni başlık';
  perform update_listing(pid, 'Yayındayken değişti', 'Oyun & Oyuncak', 'Hasarlı', 'M',
                         p_sub_category => 'Bebek oyuncakları');
  raise notice 'SONUÇ: HATA — yayındaki ilan düzenlenebildi';
exception when others then
  raise notice 'SONUÇ: doğru — reddedildi (%)', sqlerrm;
end $$;
select title = 'Yeni başlık' as baslik_korundu, points = 700 as puan_korundu
  from products where id = :'d_id';
\echo 'BEKLENEN: reddedildi, ikisi de t'

\echo ''
\echo '=== 7) GEÇERSİZ ALT KATEGORİ REDDEDİLİYOR ==='
-- `create_listing` bu kontrolü yapıyor; güncellemede unutulsaydı, geçerli
-- açılan bir ilan düzenlemeyle tutarsız hâle getirilebilirdi.
select set_config('test.uid', :'s', false);
select id from create_listing('İkinci taslak', 'Oyun & Oyuncak', 'İyi durumda', 'S',
                              p_sub_category => 'Yapı & inşa') \gset i_
do $$
declare pid text;
begin
  select id into pid from products where title = 'İkinci taslak';
  perform update_listing(pid, 'İkinci taslak', 'Oyun & Oyuncak', 'İyi durumda', 'S',
                         p_sub_category => 'Bebek arabaları');
  raise notice 'SONUÇ: HATA — yanlış ağaçtan alt kategori kabul edildi';
exception when others then
  raise notice 'SONUÇ: doğru — reddedildi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 8) FONKSİYON YETKİSİ ==='
select p.proname,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
       has_function_privilege('anon', p.oid, 'execute') as anon
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'update_listing';
\echo 'BEKLENEN: authenticated = t, anon = f'
