-- KIDS TRADE — Bildirim kuyruğu testleri
--
-- Kritik iddialar: 4 (teslimat bildirimi gerçekten gidiyor — 48 saatlik sayacın
-- anlamı buna bağlı), 7 (kimse başkasının bildirimini göremez) ve 8 (okundu
-- işaretlemek başkasının kaydına dokunamaz).

\set s '11aa11aa-11aa-11aa-11aa-11aa11aa11aa'
\set b '22bb22bb-22bb-22bb-22bb-22bb22bb22bb'

\echo ''
\echo '=== Hazırlık ==='
insert into auth.users (id, email, phone, phone_confirmed_at, raw_user_meta_data)
values (:'s', 'bildirim-satici@example.com', '+905557770001', now(),
        '{"full_name":"Zeynep Demir"}'::jsonb),
       (:'b', 'bildirim-alici@example.com',  '+905557770002', now(),
        '{"full_name":"Ali Kaya"}'::jsonb)
on conflict (id) do nothing;

select available_points from earn_points(:'b', 3000, 'test:bildirim-alici-bakiye');

create or replace function pg_temp.ilan(p_baslik text)
returns text language plpgsql as $$
declare pid text; sid text := '11aa11aa-11aa-11aa-11aa-11aa11aa11aa';
begin
  perform set_config('test.uid', sid, false);
  select id into pid from create_listing(p_baslik, 'Oyuncak', 'Az kullanılmış', 'M', 300);
  insert into product_photos (product_id, slot, storage_path, moderation_status)
  select pid, s, sid || '/' || pid || '/' || s || '.jpg', 'approved'
    from unnest(array['front','back','left','right','label']::photo_slot[]) s;
  perform publish_listing(pid, 'front');
  return pid;
end; $$;

\echo ''
\echo '=== 1) İlan yayına girince satıcıya bildirim gider ==='
select pg_temp.ilan('Ahşap tren') as pid \gset p1_
select kind, title from notifications
 where user_id = :'s' and kind = 'listing.published';
\echo 'BEKLENEN: listing.published — İlanınız yayında'

\echo ''
\echo '=== 2) Kampanya puanı da bildirilir ==='
select kind, title from notifications
 where user_id = :'s' and kind = 'campaign.granted';
\echo 'BEKLENEN: campaign.granted — 250 kampanya puanı hesabınızda'

\echo ''
\echo '=== 3) Takas açılınca satıcıya haber gider ==='
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from create_trade(:'p1_pid', :'b') \gset t1_
reset role;
select kind from notifications where user_id = :'s' and kind = 'trade.created';
\echo 'BEKLENEN: trade.created'

\echo ''
\echo '=== 4) TESLİMAT BİLDİRİMİ — 48 saatlik sayacın anlamı buna bağlı ==='
update trades set status = 'SHIPPED' where id = :'t1_id';
select status from mark_delivered(:'t1_id');
select body from notifications where user_id = :'b' and kind = 'trade.delivered';
\echo 'BEKLENEN: 48 saat uyarısını içeren metin alıcıya gitti'

\echo ''
\echo '=== 5) Kargo bildirimi iki tarafa da gider ==='
select count(*) filter (where user_id = :'s') as saticiya,
       count(*) filter (where user_id = :'b') as aliciya
  from notifications where kind = 'trade.shipped';
\echo 'BEKLENEN: 1 ve 1'

\echo ''
\echo '=== 6) Tamamlanınca satıcıya puan bildirimi gider ==='
set session role authenticated;
select set_config('test.uid', :'b', false);
select status from confirm_delivery(:'t1_id');
reset role;
select body from notifications where user_id = :'s' and kind = 'trade.completed';
\echo 'BEKLENEN: 300 puan cüzdanınıza geçti'

\echo ''
\echo '=== 7) KİMSE BAŞKASININ BİLDİRİMİNİ GÖREMEZ ==='
set session role authenticated;
select set_config('test.uid', :'b', false);
select count(*) as alicinin_gordugu from notifications;
select count(*) as saticinin_kayitlari_gorunur_mu
  from notifications where user_id = :'s';
\echo 'BEKLENEN: alıcı yalnızca kendi kayıtlarını görür, satıcınınkiler 0'

\echo ''
\echo '=== 8) OKUNDU İŞARETLEMEK BAŞKASININ KAYDINA DOKUNAMAZ ==='
select mark_notifications_read() as okundu_yapilan;
reset role;
select count(*) as saticinin_okunmamislari
  from notifications where user_id = :'s' and read_at is null;
\echo 'BEKLENEN: alıcının hepsi okundu, satıcınınkiler dokunulmadan duruyor'

\echo ''
\echo '=== 9) Okunmamış sayacı doğru ==='
set session role authenticated;
select set_config('test.uid', :'b', false);
select unread_notification_count() as alici_okunmamis;
select set_config('test.uid', :'s', false);
select unread_notification_count() > 0 as saticinin_okunmamisi_var;
\echo 'BEKLENEN: alıcı 0, satıcının okunmamışı var'

\echo ''
\echo '=== 10) Reddedilen kare satıcıya bildirilir ==='
reset role;
select set_config('test.uid', :'s', false);
select id as pid from create_listing('Taslak ilan', 'Oyuncak', 'İyi durumda', 'S', 150) \gset p2_
insert into product_photos (product_id, slot, storage_path)
values (:'p2_pid', 'front', :'s' || '/' || :'p2_pid' || '/front.jpg');
update product_photos set moderation_status = 'rejected', moderation_reason = 'Kare bulanık'
 where product_id = :'p2_pid' and slot = 'front';
select body from notifications where user_id = :'s' and kind = 'photo.rejected';
\echo 'BEKLENEN: gerekçeyi içeren metin — Kare bulanık'

\echo ''
\echo '=== 11) İtiraz açılınca satıcı haberdar olur ==='
select pg_temp.ilan('İtirazlık ürün') as pid \gset p3_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from create_trade(:'p3_pid', :'b') \gset t3_
reset role;
update trades set status = 'SHIPPED' where id = :'t3_id';
select status from mark_delivered(:'t3_id');
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from open_dispute(:'t3_id', 'Ürün kırık geldi') \gset d3_
reset role;
select title from notifications where user_id = :'s' and kind = 'dispute.opened';
\echo 'BEKLENEN: Alıcı bir sorun bildirdi'

reset role;
