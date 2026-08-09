-- KIDS TRADE — Mesaj şikâyeti ve moderasyonu testleri
--
-- Kritik iddialar: 2 (telefon numarası işaretlenir ama MESAJ ENGELLENMEZ),
-- 5 (kendi mesajını şikâyet edemezsin), 8 (açık şikâyet skoru düşürmez —
-- yalnızca onaylanmış ihlal düşürür) ve 9 (yönetici olmayan karar veremez).

\set s '88bb88bb-88bb-88bb-88bb-88bb88bb88bb'
\set b '99cc99cc-99cc-99cc-99cc-99cc99cc99cc'
\set y 'aabbaabb-aabb-aabb-aabb-aabbaabbaabb'

\echo ''
\echo '=== Hazırlık ==='
insert into auth.users (id, email, phone, phone_confirmed_at, raw_user_meta_data)
values (:'s', 'sikayet-satici@example.com', '+905551230001', now(),
        '{"full_name":"Zeynep Demir"}'::jsonb),
       (:'b', 'sikayet-alici@example.com',  '+905551230002', now(),
        '{"full_name":"Ali Kaya"}'::jsonb),
       (:'y', 'sikayet-yonetici@example.com', '+905551230003', now(), '{}'::jsonb)
on conflict (id) do nothing;

insert into admins (user_id, note) values (:'y', 'şikâyet testi')
on conflict (user_id) do nothing;

create or replace function pg_temp.ilan(p_baslik text)
returns text language plpgsql as $$
declare pid text; sid text := '88bb88bb-88bb-88bb-88bb-88bb88bb88bb';
begin
  perform set_config('test.uid', sid, false);
  select id into pid from create_listing(p_baslik, 'Oyuncak', 'Az kullanılmış', 'M', 300);
  insert into product_photos (product_id, slot, storage_path, moderation_status)
  select pid, s, sid || '/' || pid || '/' || s || '.jpg', 'approved'
    from unnest(array['front','back','left','right','label']::photo_slot[]) s;
  perform publish_listing(pid, 'front');
  return pid;
end; $$;

create temp table r_ids (ad text primary key, deger text);
grant all on r_ids to authenticated;

\echo ''
\echo '=== 1) Sıradan mesaj işaretlenmez ==='
select pg_temp.ilan('Ahşap tren') as pid \gset p1_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from start_conversation(:'p1_pid') \gset c1_
select id from send_message(:'c1_id', 'Merhaba, 0-3 yaş için uygun mu? 12 parça yazıyor.') \gset m1_
reset role;
select count(*) as isaret from message_reports where message_id = :'m1_id';
\echo 'BEKLENEN: 0 — masum rakamlar işaret üretmemeli'

\echo ''
\echo '=== 2) TELEFON İŞARETLENİR AMA MESAJ ENGELLENMEZ ==='
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from send_message(:'c1_id', 'Şu numaradan yazayım: 0532 111 22 33') \gset m2_
reset role;
insert into r_ids values ('m2', :'m2_id');
select (select count(*) from messages where id = :'m2_id') as mesaj_kaydedildi,
       (select reason from message_reports where message_id = :'m2_id') as isaret,
       (select reported_by is null from message_reports where message_id = :'m2_id') as sistem;
\echo 'BEKLENEN: mesaj kaydedildi 1, OFF_PLATFORM, sistem işareti t'

\echo ''
\echo '=== 3) IBAN da işaretlenir ==='
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from send_message(:'c1_id', 'TR330006100519786457841326 buraya atabilirsin') \gset m3_
reset role;
select reason from message_reports where message_id = :'m3_id';
\echo 'BEKLENEN: OFF_PLATFORM'

\echo ''
\echo '=== 4) Karşı taraf mesajı şikâyet edebilir ==='
set session role authenticated;
select set_config('test.uid', :'s', false);
select id, reason from report_message(:'m2_id', 'OFF_PLATFORM', 'Beni dışarı çekmeye çalışıyor') \gset r1_
insert into r_ids values ('r1', :'r1_id');
select status from message_reports where id = :'r1_id';
\echo 'BEKLENEN: OPEN'

\echo ''
\echo '=== 5) KENDİ MESAJINI ŞİKÂYET EDEMEZSİN ==='
select set_config('test.uid', :'b', false);
do $$
declare mid uuid;
begin
  select deger::uuid into mid from r_ids where ad = 'm2';
  perform report_message(mid, 'OTHER', 'Kendi mesajım');
  raise notice 'SONUÇ: HATA — kendi mesajını şikâyet etti';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 6) Aynı mesajı ikinci kez şikâyet ikinci kayıt açmaz ==='
select set_config('test.uid', :'s', false);
select id from report_message(:'m2_id', 'OFF_PLATFORM', 'Tekrar bildiriyorum') \gset r1b_
reset role;
select count(*) as kullanici_sikayeti
  from message_reports where message_id = :'m2_id' and reported_by = :'s';
\echo 'BEKLENEN: 1'

\echo ''
\echo '=== 7) Kuyrukta kullanıcı şikâyeti sistem işaretinden önce ==='
set session role authenticated;
select set_config('test.uid', :'y', false);
select sistem_isareti from admin_report_queue() limit 1;
\echo 'BEKLENEN: f — önce insanın bildirdiği'

\echo ''
\echo '=== 8) AÇIK ŞİKÂYET SKORU DÜŞÜRMEZ ==='
-- Şikâyet edilmekle skor düşseydi, şikâyet bir silaha dönüşürdü.
reset role;
select mesaj_ihlali, skor is null as skor_yok from user_trust(:'b');
\echo 'BEKLENEN: 0 ihlal, skor yok (henüz işlemi yok)'

\echo ''
\echo '=== 9) YÖNETİCİ OLMAYAN KARAR VEREMEZ ==='
set session role authenticated;
select set_config('test.uid', :'s', false);
do $$
declare rid uuid;
begin
  select deger::uuid into rid from r_ids where ad = 'r1';
  perform admin_resolve_report(rid, true, 'Ben karar verdim');
  raise notice 'SONUÇ: HATA — yetkisiz kullanıcı karar verdi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 10) Gerekçesiz karar reddedilir ==='
select set_config('test.uid', :'y', false);
do $$
declare rid uuid;
begin
  select deger::uuid into rid from r_ids where ad = 'r1';
  perform admin_resolve_report(rid, true, '   ');
  raise notice 'SONUÇ: HATA — gerekçesiz karar geçti';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 11) ONAYLANAN İHLAL SKORU DÜŞÜRÜR VE KAYDA GEÇER ==='
select status from admin_resolve_report(:'r1_id', true, 'Platform dışına yönlendirme tespit edildi.');
reset role;
select (select mesaj_ihlali from user_trust(:'b'))                          as ihlal,
       (select skor from user_trust(:'b'))                                  as skor,
       (select count(*) from messages where id = :'m2_id')                  as mesaj_duruyor,
       (select action from audit_logs where subject = 'report:' || :'r1_id') as kayit;
\echo 'BEKLENEN: 1 ihlal, skor 80, mesaj silinmedi (1), message.actioned'

\echo ''
\echo '=== 12) İhlal bildirimi gönderene ve şikâyet edene gider ==='
select count(*) filter (where user_id = :'b' and kind = 'message.actioned') as gonderene,
       count(*) filter (where user_id = :'s' and kind = 'report.actioned')  as sikayet_edene
  from notifications;
\echo 'BEKLENEN: 1 ve 1'

\echo ''
\echo '=== 13) Sonuçlanmış şikâyet tekrar karara bağlanamaz ==='
set session role authenticated;
select set_config('test.uid', :'y', false);
do $$
declare rid uuid;
begin
  select deger::uuid into rid from r_ids where ad = 'r1';
  perform admin_resolve_report(rid, false, 'Fikrimi değiştirdim');
  raise notice 'SONUÇ: HATA — kapanmış şikâyet yeniden karara bağlandı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

reset role;
