-- ELDENELE — Elle onay: gönder, incele, onayla / reddet; avatar
--
-- 2026-09-08 kurgusunun kalbi. İlan artık yönetici onayıyla yayına giriyor.
-- Tamamı `bekle`/`bekle_esit` ile.
--
-- Kritik iddialar: 3 (sıradan kullanıcı kuyruğu göremez ve onaylayamaz — bu
-- düşerse herkes kendi ilanını yayına alır), 5 (onay puanı yazar, kareleri
-- onaylar, bildirim ve kampanya hakkı doğar), 6 (ret gerekçesizse geçmez ve
-- kareler silinmez), 9 (satıcı yayına alma yolunu tamamen kaybetti).

\set a '0910a0a0-0000-0000-0000-000000000001'
\set s '0910a0a0-0000-0000-0000-000000000002'
\set b '0910a0a0-0000-0000-0000-000000000003'

\echo ''
\echo '=== Hazırlık: yönetici, satıcı, alıcı ==='
insert into auth.users (id, email, phone, phone_confirmed_at, raw_user_meta_data)
values (:'a', 'onay-yonetici@example.com', '+905550910001', now(), '{"full_name":"Yönetici Kişi"}'::jsonb),
       (:'s', 'onay-satici@example.com',   '+905550910002', now(), '{"full_name":"Zeynep Demir"}'::jsonb),
       (:'b', 'onay-alici@example.com',    '+905550910003', now(), '{"full_name":"Ali Kaya"}'::jsonb)
on conflict (id) do nothing;
insert into admins (user_id, note) values (:'a', 'elle onay testi') on conflict do nothing;

-- Dört kare yüklü, onaya gönderilmiş ilan üretir.
create or replace function pg_temp.gonderilmis(p_baslik text)
returns text language plpgsql security definer as $$
declare pid text; sid text := '0910a0a0-0000-0000-0000-000000000002';
begin
  perform set_config('test.uid', sid, false);
  select id into pid from create_listing(p_baslik, 'Oyun & Oyuncak', 'İyi durumda', 'S', p_sub_category => 'Yapı & inşa');
  insert into product_photos (product_id, slot, storage_path)
  select pid, s, sid || '/' || pid || '/' || s || '.jpg'
    from unnest(array['front','back','left','right']::photo_slot[]) s;
  perform submit_listing(pid);
  return pid;
end; $$;

\echo ''
\echo '=== 1) Satıcı onaya gönderir: IN_REVIEW, damga, denetim kaydı ==='
select pg_temp.gonderilmis('İlk ilan') as pid \gset p1_
select bekle_esit('durum IN_REVIEW', (select status from products where id = :'p1_pid'), 'IN_REVIEW');
select bekle('gönderim damgası', (select submitted_at is not null from products where id = :'p1_pid'));
select bekle('denetim kaydı yazıldı',
             exists (select 1 from audit_logs where action = 'listing.submit' and subject = 'product:' || :'p1_pid'));
-- İkinci gönderim idempotent: hata yok, durum aynı.
set session role authenticated;
select set_config('test.uid', :'s', false);
select status from submit_listing(:'p1_pid');
select bekle_esit('çift dokunuş zararsız', (select status from products where id = :'p1_pid'), 'IN_REVIEW');

\echo ''
\echo '=== 2) Yönetici kuyruğu ilanı kareleriyle görür ==='
select set_config('test.uid', :'a', false);
select bekle('yönetici kuyrukta ilanı görür',
             exists (select 1 from admin_review_queue() where product_id = :'p1_pid'));
select bekle_esit('dört kare jsonb dizisinde',
                  (select jsonb_array_length(kareler) from admin_review_queue() where product_id = :'p1_pid'), 4);
select bekle_esit('satıcı adı geliyor',
                  (select seller_name from admin_review_queue() where product_id = :'p1_pid'), 'Zeynep Demir');
select bekle_esit('puan önizlemesi formülden: 1599 TL → 910',
                  admin_puan_hesapla(1599, 'İyi durumda', false), 910);

\echo ''
\echo '=== 3) SIRADAN KULLANICI KUYRUĞU GÖREMEZ, ONAYLAYAMAZ, REDDEDEMEZ ==='
select set_config('test.uid', :'b', false);
select bekle_esit('kuyruk boş döner', (select count(*) from admin_review_queue()), 0::bigint);
select set_config('test.pid', :'p1_pid', false);
do $$
declare pid text := current_setting('test.pid');
begin
  perform admin_approve_listing(pid, 1599);
  raise notice 'SONUÇ: HATA — sıradan kullanıcı ilan onayladı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
do $$
declare pid text := current_setting('test.pid');
begin
  perform admin_reject_listing(pid, 'sırf denemek için');
  raise notice 'SONUÇ: HATA — sıradan kullanıcı ilan reddetti';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
do $$
begin
  perform admin_puan_hesapla(1599, 'İyi durumda', false);
  raise notice 'SONUÇ: HATA — sıradan kullanıcı formülü çalıştırdı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
-- Durum satıcı gözüyle okunuyor: alıcının RLS'i incelemedeki ilanı hiç göstermez
-- (bu da bir iddia — aşağıda ayrıca ölçülüyor).
select bekle_esit('alıcı incelemedeki ilanı göremez',
                  (select count(*) from products where id = :'p1_pid'), 0::bigint);
select set_config('test.uid', :'s', false);
select bekle_esit('ilan hâlâ incelemede', (select status from products where id = :'p1_pid'), 'IN_REVIEW');
-- Satıcı da kendi ilanını onaylayamaz.
do $$
declare pid text := current_setting('test.pid');
begin
  perform admin_approve_listing(pid, 1599);
  raise notice 'SONUÇ: HATA — satıcı kendi ilanını onayladı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 4) Satıcı incelemedeki ilanın karelerini değiştiremez ==='
-- RLS politikaları `status = 'DRAFT'` şartı taşıyor; incelemedeki ilana kare
-- eklenemez, silinemez. Yönetici baktığı şeyin altından değişmesin.
do $$
declare pid text := current_setting('test.pid');
begin
  insert into product_photos (product_id, slot, storage_path)
  values (pid, 'label', 'x/' || pid || '/label.jpg');
  raise notice 'SONUÇ: HATA — incelemedeki ilana kare eklendi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
delete from product_photos where product_id = :'p1_pid' and slot = 'front';
select bekle_esit('kare silinmedi (RLS sessizce 0 satır)',
                  (select count(*) from product_photos where product_id = :'p1_pid'), 4::bigint);

\echo ''
\echo '=== 5) YÖNETİCİ ONAYLAR: puan, kareler, bildirim, kampanya ==='
select set_config('test.uid', :'a', false);
select status, points, degerleme_kaynak, reviewed_by = :'a' as inceleyen_dogru
  from admin_approve_listing(:'p1_pid', 1599) \gset o_
select bekle_esit('ACTIVE', :'o_status'::text, 'ACTIVE');
select bekle_esit('puan formülden 910', :o_points, 910);
select bekle_esit('kaynak admin', :'o_degerleme_kaynak'::text, 'admin');
select bekle_esit('inceleyen kaydedildi', :'o_inceleyen_dogru'::text, 't');
reset role;
select bekle_esit('bekleyen kareler onaylandı',
                  (select count(*) from product_photos
                    where product_id = :'p1_pid' and moderation_status = 'approved'), 4::bigint);
select bekle('kapak işaretlendi',
             (select image_key is not null from products where id = :'p1_pid'));
select bekle('satıcıya yayın bildirimi gitti',
             exists (select 1 from notifications
                      where user_id = :'s' and kind = 'listing.published'
                        and body like '%910 puan%'));
select bekle('kampanya hakkı doğdu',
             exists (select 1 from campaign_grants where user_id = :'s' and kind = 'FIRST_LISTING'));
select bekle('denetim kaydı: listing.approve',
             exists (select 1 from audit_logs where action = 'listing.approve' and subject = 'product:' || :'p1_pid'));
-- Kuyruktan düştü.
set session role authenticated;
select set_config('test.uid', :'a', false);
select bekle('onaylanan ilan kuyrukta değil',
             not exists (select 1 from admin_review_queue() where product_id = :'p1_pid'));
-- Alıcı vitrinde görüyor.
select set_config('test.uid', :'b', false);
select bekle('alıcı vitrinde görüyor',
             exists (select 1 from products where id = :'p1_pid' and status = 'ACTIVE'));

\echo ''
\echo '=== 6) YÖNETİCİ REDDEDER: gerekçe zorunlu, taslağa döner, kareler DURUR ==='
reset role;
select pg_temp.gonderilmis('Bulanık ilan') as pid \gset p2_
set session role authenticated;
select set_config('test.uid', :'a', false);
select set_config('test.pid', :'p2_pid', false);
do $$
declare pid text := current_setting('test.pid');
begin
  perform admin_reject_listing(pid, '   ');
  raise notice 'SONUÇ: HATA — gerekçesiz ret geçti';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
select status, review_reason from admin_reject_listing(:'p2_pid', 'Arka kare bulanık, yeniden çek.') \gset r_
select bekle_esit('DRAFT', :'r_status'::text, 'DRAFT');
select bekle_esit('gerekçe satırda', :'r_review_reason'::text, 'Arka kare bulanık, yeniden çek.');
reset role;
select bekle('gönderim damgası silindi', (select submitted_at is null from products where id = :'p2_pid'));
select bekle_esit('kareler silinmedi — satıcı yalnızca söyleneni yeniden çeker',
                  (select count(*) from product_photos where product_id = :'p2_pid'), 4::bigint);
select bekle('satıcıya ret bildirimi gerekçeyle gitti',
             exists (select 1 from notifications
                      where user_id = :'s' and kind = 'listing.rejected'
                        and body like '%Arka kare bulanık%'));
select bekle('kampanya hakkı DOĞMADI',
             (select count(*) from campaign_grants where user_id = :'s' and kind = 'FIRST_LISTING') = 1);

\echo ''
\echo '=== 7) Reddedilen ilan düzeltilip yeniden gönderilebilir; gerekçe temizlenir ==='
set session role authenticated;
select set_config('test.uid', :'s', false);
select status from submit_listing(:'p2_pid');
select bekle_esit('yeniden incelemede', (select status from products where id = :'p2_pid'), 'IN_REVIEW');
select bekle('eski gerekçe silindi', (select review_reason is null from products where id = :'p2_pid'));

\echo ''
\echo '=== 8) Onay yalnızca incelemedeki ilana; yayındaki ikinci kez onaylanamaz ==='
select set_config('test.uid', :'a', false);
select set_config('test.pid', :'p1_pid', false);
do $$
declare pid text := current_setting('test.pid');
begin
  perform admin_approve_listing(pid, 2000);
  raise notice 'SONUÇ: HATA — yayındaki ilan yeniden onaylandı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
select bekle_esit('puan değişmedi', (select points from products where id = :'p1_pid'), 910);

\echo ''
\echo '=== 9) SATICI YAYINA ALMA YOLUNU TAMAMEN KAYBETTİ ==='
select set_config('test.uid', :'s', false);
select bekle('publish_listing authenticated''a kapalı',
             not has_function_privilege('authenticated', 'public.publish_listing(text, public.photo_slot)', 'execute'));
select bekle('ilan_yayina_al authenticated''a kapalı',
             not has_function_privilege('authenticated', 'public.ilan_yayina_al(text, public.photo_slot)', 'execute'));
select bekle('ilan_onayla authenticated''a kapalı',
             not has_function_privilege('authenticated', 'public.ilan_onayla(text, numeric, integer, public.photo_slot, uuid)', 'execute'));
-- Kalan tek yol, açık bir ret mesajı.
reset role;
do $$
begin
  perform publish_listing('herhangi', 'front');
  raise notice 'SONUÇ: HATA — publish_listing çalıştı';
exception when others then
  raise notice 'SONUÇ: doğru — (%)', sqlerrm;
end $$;
select bekle('otomatik yayın tetikleyicisi kalktı',
             not exists (select 1 from pg_trigger where tgname = 'product_photos_karar_sonrasi'));
select bekle('değerleme sonrası yayın tetikleyicisi kalktı',
             not exists (select 1 from pg_trigger where tgname = 'products_degerleme_sonrasi'));

\echo ''
\echo '=== 10) Yabancı incelemedeki ilanı geri çekemez ==='
set session role authenticated;
select set_config('test.uid', :'b', false);
select set_config('test.pid', :'p2_pid', false);
do $$
declare pid text := current_setting('test.pid');
begin
  perform withdraw_listing(pid);
  raise notice 'SONUÇ: HATA — yabancı ilanı geri çekti';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
reset role;
select bekle_esit('ilan hâlâ incelemede', (select status from products where id = :'p2_pid'), 'IN_REVIEW');

\echo ''
\echo '=== 11) AVATAR ELLE: kuyruk, onay, ret ==='
reset role;
insert into profiles (user_id, full_name) values (:'b', 'Ali Kaya') on conflict (user_id) do nothing;
set session role authenticated;
select set_config('test.uid', :'b', false);
insert into profiles (user_id, avatar_path) values (:'b', :'b' || '/1000-abc.jpg')
  on conflict (user_id) do update set avatar_path = excluded.avatar_path;
select bekle_esit('yüklenen avatar pending',
                  (select avatar_status from profiles where user_id = :'b'), 'pending');
-- Sıradan kullanıcı kuyruğu göremez, karar veremez.
select bekle_esit('sıradan kullanıcıya avatar kuyruğu boş',
                  (select count(*) from admin_avatar_queue()), 0::bigint);
do $$
begin
  perform admin_avatar_karar('0910a0a0-0000-0000-0000-000000000003', true);
  raise notice 'SONUÇ: HATA — sıradan kullanıcı avatar onayladı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
-- Yönetici görür ve onaylar.
select set_config('test.uid', :'a', false);
select bekle('yönetici bekleyen avatarı görür',
             exists (select 1 from admin_avatar_queue() where user_id = :'b'));
select admin_avatar_karar(:'b', true);
-- Profil satırını yalnızca sahibi okur; iddia yetkili rolde ölçülüyor.
reset role;
select bekle_esit('avatar onaylandı',
                  (select avatar_status from profiles where user_id = :'b'), 'approved');
set session role authenticated;
-- Yeni yükleme → pending → gerekçesiz ret geçmez → gerekçeli ret yolu döndürür.
select set_config('test.uid', :'b', false);
update profiles set avatar_path = :'b' || '/2000-def.jpg' where user_id = :'b';
select set_config('test.uid', :'a', false);
do $$
begin
  perform admin_avatar_karar('0910a0a0-0000-0000-0000-000000000003', false, '');
  raise notice 'SONUÇ: HATA — gerekçesiz avatar reddi geçti';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
select bekle_esit('ret eski yolu döndürür (istemci dosyayı silecek)',
                  admin_avatar_karar(:'b', false, 'Uygunsuz içerik.'), :'b' || '/2000-def.jpg');
reset role;
select bekle_esit('durum rejected',
                  (select avatar_status from profiles where user_id = :'b'), 'rejected');
select bekle('yol boşaltıldı', (select avatar_path is null from profiles where user_id = :'b'));
select bekle_esit('gerekçe saklandı',
                  (select avatar_reason from profiles where user_id = :'b'), 'Uygunsuz içerik.');
