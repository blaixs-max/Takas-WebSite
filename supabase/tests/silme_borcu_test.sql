-- ELDENELE — Reddedilen karenin silme borcu
--
-- Kritik iddia 3: **borç alındığında damga tazeleniyor.** Tazelemeseydi iki
-- eşzamanlı `photo-check` çağrısı aynı kareyi alır ve sıra israf olurdu;
-- daha kötüsü, en eski borç her turda ilk sırada kalıp diğerlerini
-- kuyrukta bekletirdi.
--
-- İddia 5, dosyanın var olma sebebi: borç `service_role` dışına kapalı.
-- `silme_borcu_al` depo yolunu döndürüyor ve o yol satıcının kullanıcı
-- kimliğiyle başlıyor — istemciye açık olsaydı, herkes başkasının
-- kimliklerini toplayabilirdi.

\set s 'bb22bb22-0000-0000-0000-00000000d001'

\echo ''
\echo '=== Hazırlık ==='
insert into auth.users (id, email, phone, phone_confirmed_at, raw_user_meta_data)
values (:'s', 'borc-satici@example.com', '+905557770001', now(),
        '{"full_name":"Zeynep Demir"}'::jsonb)
on conflict (id) do nothing;

select set_config('test.uid', :'s', false);
select id from create_listing('Borçlu ilan', 'Oyun & Oyuncak', 'Az kullanılmış', 'M', 300,
                              p_sub_category => 'Yapı & inşa') \gset b_
insert into product_photos (product_id, slot, storage_path, moderation_status)
select :'b_id', s, :'s' || '/' || :'b_id' || '/' || s || '.jpg', 'pending'
  from unnest(array['front','back','left']::photo_slot[]) s;

\echo ''
\echo '=== 1) Borçsuz başlangıç ==='
select silme_borcu_sayisi() = 0 as bos_baslangic;
\echo 'BEKLENEN: bos_baslangic = t'

\echo ''
\echo '=== 2) Borç açılıyor ==='
select silme_borcu_ac(id) from product_photos where product_id = :'b_id' and slot = 'front';
select silme_borcu_ac(id) from product_photos where product_id = :'b_id' and slot = 'back';
select silme_borcu_sayisi() = 2 as iki_borc;
\echo 'BEKLENEN: iki_borc = t'

\echo ''
\echo '=== 3) BORÇ ALININCA DAMGA TAZELENİYOR ==='
-- Alınan satırın damgası ileri gidiyor; tazelenmeseydi aynı kare her turda
-- yeniden ilk sırada çıkar ve kuyruk hiç ilerlemezdi.
update product_photos set deletion_pending_at = now() - interval '1 hour'
 where product_id = :'b_id' and deletion_pending_at is not null;
select count(*) = 1 as bir_tane_alindi from silme_borcu_al(1);
select count(*) = 1 as damga_tazelendi
  from product_photos
 where product_id = :'b_id' and deletion_pending_at > now() - interval '1 minute';
\echo 'BEKLENEN: bir_tane_alindi = t, damga_tazelendi = t'

\echo ''
\echo '=== 4) Borç kapanıyor ==='
select silme_borcu_kapat(id) from product_photos where product_id = :'b_id' and slot = 'front';
select silme_borcu_kapat(id) from product_photos where product_id = :'b_id' and slot = 'back';
select silme_borcu_sayisi() = 0 as borc_kalmadi;
\echo 'BEKLENEN: borc_kalmadi = t'

\echo ''
\echo '=== 5) BORÇ FONKSİYONLARI İSTEMCİYE KAPALI ==='
-- `silme_borcu_al` depo yolunu döndürüyor; o yol satıcının UUID'siyle
-- başlıyor. İstemciye açık olsaydı herkes başkalarının kimliklerini
-- toplayabilirdi. Sayaç da kapalı — yalnızca `admin_silme_borcu_sayisi()`
-- açık ve o kendi `is_admin()` denetimini yapıyor.
select p.proname,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
       has_function_privilege('anon', p.oid, 'execute') as anon
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('silme_borcu_al','silme_borcu_ac','silme_borcu_kapat',
                     'silme_borcu_sayisi','admin_silme_borcu_sayisi')
 order by p.proname;
\echo 'BEKLENEN: yalnızca admin_silme_borcu_sayisi authenticated = t; anon her yerde f'
