-- ELDENELE — Profil fotoğrafı
--
-- Tamamı `bekle`/`bekle_esit` ile: iddia tutmazsa test düşer.
--
-- Kritik iddialar: 2 (İSTEMCİ KENDİ AVATARINI ONAYLAYAMAZ) ve 3 (yeni dosya
-- yüklemek durumu `pending`e düşürüyor). İkincisi olmadan birincisi anlamsız:
-- masum bir fotoğrafı onaylatıp üstüne başkasını koymak denetimi atlatırdı.
--
-- Bu dosya 2026-08-17'deki kusurun tekrarını kolluyor: `product_photos`
-- tetikleyicisi yanlışlıkla `security definer` yazılmıştı, `current_user`
-- fonksiyonun sahibine çözüldü, kontrol hiç çalışmadı ve paket yine "geçti"
-- dedi. Aynı mekanik burada da var.

\set a 'cc33cc33-0000-0000-0000-00000000e001'

\echo ''
\echo '=== Hazırlık ==='
insert into auth.users (id, email, phone, phone_confirmed_at)
values (:'a', 'avatar@example.com', '+905558910001', now())
on conflict (id) do nothing;

set session role authenticated;
select set_config('test.uid', :'a', false);

\echo ''
\echo '=== 1) Yükleme durumu pending yapar ==='
insert into profiles (user_id, avatar_path) values (:'a', :'a' || '/1000-abc.jpg');
select bekle_esit('yeni avatar pending',
                  (select avatar_status from profiles where user_id = :'a'), 'pending');

\echo ''
\echo '=== 2) İSTEMCİ KENDİ AVATARINI ONAYLAYAMAZ ==='
-- Bu dosyanın varlık sebebi. Tetikleyici `security invoker` olmak zorunda;
-- `security definer` yazılsaydı `current_user` fonksiyonun sahibi olur,
-- koşul hiç tutmaz ve kontrol sessizce hiçbir şey yapmazdı.
update profiles set avatar_status = 'approved' where user_id = :'a';
select bekle_esit('istemci onayı yutuldu',
                  (select avatar_status from profiles where user_id = :'a'), 'pending');

\echo ''
\echo '=== 3) YENİ DOSYA DENETİMİ SIFIRLIYOR ==='
-- Denetimden geçmiş bir avatarın üstüne yenisini koymak, onayı devralmamalı.
reset role;
select avatar_karar(:'a', 'approved');
set session role authenticated;
select set_config('test.uid', :'a', false);
select bekle_esit('sunucu onayladı',
                  (select avatar_status from profiles where user_id = :'a'), 'approved');

update profiles set avatar_path = :'a' || '/2000-def.jpg' where user_id = :'a';
select bekle_esit('yeni yol pending yapar',
                  (select avatar_status from profiles where user_id = :'a'), 'pending');

\echo ''
\echo '=== 4) avatar_yolu YALNIZCA ONAYLIYI VERİR ==='
-- Kapının ikinci katmanı. Depolama politikası da aynı koşula bakıyor; ikisi
-- birden gerekli — biri gevşerse öteki tutar.
select bekle('pending avatarın yolu verilmiyor',
             avatar_yolu(:'a') is null);
reset role;
select avatar_karar(:'a', 'approved');
set session role authenticated;
select set_config('test.uid', :'a', false);
select bekle_esit('onaylı avatarın yolu veriliyor',
                  avatar_yolu(:'a'), :'a' || '/2000-def.jpg');

\echo ''
\echo '=== 5) Ret yolu boşaltıyor ==='
-- Dosya depodan siliniyor; satırda ölü bir yol bırakmak sonraki yüklemede
-- "yol değişmedi" diye okunup denetimi atlatabilirdi.
reset role;
select avatar_karar(:'a', 'rejected', 'Müstehcen içerik.');
set session role authenticated;
select set_config('test.uid', :'a', false);
select bekle('reddedilen avatarın yolu boş',
             (select avatar_path is null from profiles where user_id = :'a'));
select bekle_esit('gerekçe saklanıyor',
                  (select avatar_reason from profiles where user_id = :'a'),
                  'Müstehcen içerik.');
select bekle('reddedilenin yolu verilmiyor', avatar_yolu(:'a') is null);

\echo ''
\echo '=== 6) İstemci gerekçeyi silemez ==='
-- Reddi görmezden gelip gerekçeyi temizlemek, kullanıcıya neyin neden
-- engellendiğini gizlerdi — ve bir sonraki denemede aynı hatayı yaptırırdı.
update profiles set avatar_reason = null where user_id = :'a';
select bekle_esit('gerekçe duruyor',
                  (select avatar_reason from profiles where user_id = :'a'),
                  'Müstehcen içerik.');

\echo ''
\echo '=== 7) update_profile avatar alanlarına dokunmuyor ==='
-- `update_profile` `security definer`, yani tetikleyici muafiyeti var. Adı
-- kaydetmenin avatarı sıfırlaması, ayrı iki işi birbirine bağlamak olurdu.
insert into profiles (user_id, avatar_path) values (:'a', :'a' || '/3000-ghi.jpg')
  on conflict (user_id) do update set avatar_path = excluded.avatar_path;
reset role;
select avatar_karar(:'a', 'approved');
set session role authenticated;
select set_config('test.uid', :'a', false);
select update_profile('Deniz Arı', 'Kadıköy, İstanbul', 'Merhaba');
select bekle_esit('ad kaydedildikten sonra avatar hâlâ onaylı',
                  (select avatar_status from profiles where user_id = :'a'), 'approved');
select bekle_esit('avatar yolu korundu',
                  (select avatar_path from profiles where user_id = :'a'),
                  :'a' || '/3000-ghi.jpg');

\echo ''
\echo '=== 8) avatar_karar istemciye kapalı ==='
select bekle('authenticated avatar_karar çalıştıramaz',
             not has_function_privilege('authenticated',
               'public.avatar_karar(uuid, text, text)', 'execute'));

\echo ''
\echo '=== 9) REDDEDİLEN AVATAR KALDIRILABİLİYOR ==='
-- Canlıda çıkışı olmayan bir durum bırakmıştı: `avatar_karar` reddederken
-- yolu zaten boşaltıyor, bu yüzden istemcinin `avatar_path = null` yazması
-- hiçbir alanı değiştirmiyor, tetikleyici de `rejected`i olduğu gibi
-- bırakıyordu. Gerekçe kutusunu kapatmanın hiçbir yolu yoktu.
reset role;
select avatar_karar(:'a', 'rejected', 'Müstehcen içerik.');
set session role authenticated;
select set_config('test.uid', :'a', false);
select bekle_esit('ret durumu yazıldı',
                  (select avatar_status from profiles where user_id = :'a'), 'rejected');
select bekle('ret yolu boşalttı',
             (select avatar_path is null from profiles where user_id = :'a'));

select avatar_kaldir();
select bekle('kaldırdıktan sonra durum boş',
             (select avatar_status is null from profiles where user_id = :'a'));
select bekle('kaldırdıktan sonra gerekçe boş',
             (select avatar_reason is null from profiles where user_id = :'a'));

\echo ''
\echo '=== 10) Kaldırma eski yolu döndürüyor — dosya silinebilsin ==='
-- İstemci depodaki nesneyi bu değerle siliyor; null dönseydi dosya öksüz
-- kalırdı.
insert into profiles (user_id, avatar_path) values (:'a', :'a' || '/4000-jkl.jpg')
  on conflict (user_id) do update set avatar_path = excluded.avatar_path;
select bekle_esit('kaldırma eski yolu veriyor',
                  avatar_kaldir(), :'a' || '/4000-jkl.jpg');
select bekle('yol da temizlendi',
             (select avatar_path is null from profiles where user_id = :'a'));
