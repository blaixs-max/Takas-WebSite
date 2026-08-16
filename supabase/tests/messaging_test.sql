-- KIDS TRADE — Mesajlaşma testleri
--
-- Kritik iddialar: 3 (kendi ilanına mesaj gönderilemez), 6 (üçüncü kişi
-- sohbeti okuyamaz ve yazamaz), 7 (gönderilmiş mesaj değiştirilemez —
-- uyuşmazlıkta kanıttır) ve 9 (her mesaja bildirim gitmez).

\set s '55ee55ee-55ee-55ee-55ee-55ee55ee55ee'
\set b '66ff66ff-66ff-66ff-66ff-66ff66ff66ff'
\set u '77aa77aa-77aa-77aa-77aa-77aa77aa77aa'

\echo ''
\echo '=== Hazırlık ==='
insert into auth.users (id, email, phone, phone_confirmed_at, raw_user_meta_data)
values (:'s', 'mesaj-satici@example.com', '+905559990001', now(),
        '{"full_name":"Zeynep Demir"}'::jsonb),
       (:'b', 'mesaj-alici@example.com',  '+905559990002', now(),
        '{"full_name":"Ali Kaya"}'::jsonb),
       (:'u', 'mesaj-yabanci@example.com', '+905559990003', now(),
        '{"full_name":"Üçüncü Kişi"}'::jsonb)
on conflict (id) do nothing;

create or replace function pg_temp.ilan(p_baslik text)
returns text language plpgsql as $$
declare pid text; sid text := '55ee55ee-55ee-55ee-55ee-55ee55ee55ee';
begin
  perform set_config('test.uid', sid, false);
  select id into pid from create_listing(p_baslik, 'Oyun & Oyuncak', 'Az kullanılmış', 'M', p_sub_category => 'Yapı & inşa');
  insert into product_photos (product_id, slot, storage_path, moderation_status)
  select pid, s, sid || '/' || pid || '/' || s || '.jpg', 'approved'
    from unnest(array['front','back','left','right','label']::photo_slot[]) s;
  perform test_degerle(pid);
  perform publish_listing(pid, 'front');
  return pid;
end; $$;

create temp table m_ids (ad text primary key, deger text);
grant all on m_ids to authenticated;

\echo ''
\echo '=== 1) Alıcı ilan üzerinden sohbet açar ==='
select pg_temp.ilan('Ahşap tren') as pid \gset p1_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from start_conversation(:'p1_pid') \gset c1_
insert into m_ids values ('c1', :'c1_id'), ('p1', :'p1_pid');
select buyer_id = :'b' as alici_dogru, seller_id = :'s' as satici_dogru
  from conversations where id = :'c1_id';
\echo 'BEKLENEN: her ikisi de t'

\echo ''
\echo '=== 2) İkinci kez açmak yeni sohbet yaratmaz ==='
select id from start_conversation(:'p1_pid') \gset c1b_
select count(*) as sohbet_sayisi from conversations where product_id = :'p1_pid';
select (:'c1_id' = :'c1b_id') as ayni_sohbet;
\echo 'BEKLENEN: 1 sohbet, aynı sohbet t'

\echo ''
\echo '=== 3) SATICI KENDİ İLANINA MESAJ GÖNDEREMEZ ==='
select set_config('test.uid', :'s', false);
do $$
declare pid text;
begin
  select deger into pid from m_ids where ad = 'p1';
  perform start_conversation(pid);
  raise notice 'SONUÇ: HATA — satıcı kendi ilanına sohbet açtı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 4) İki taraf da yazabiliyor, sıra korunuyor ==='
select set_config('test.uid', :'b', false);
select id from send_message(:'c1_id', 'Merhaba, kutusu var mı?') \gset m1_
select set_config('test.uid', :'s', false);
select id from send_message(:'c1_id', 'Var, kutusuyla birlikte gönderiyorum.') \gset m2_
reset role;
select count(*) as mesaj, min(created_at) <= max(created_at) as sira
  from messages where conversation_id = :'c1_id';
\echo 'BEKLENEN: 2 mesaj, sıra t'

\echo ''
\echo '=== 5) Boş mesaj reddedilir ==='
set session role authenticated;
select set_config('test.uid', :'b', false);
do $$
declare cid uuid;
begin
  select deger::uuid into cid from m_ids where ad = 'c1';
  perform send_message(cid, '    ');
  raise notice 'SONUÇ: HATA — boş mesaj gönderildi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 6) ÜÇÜNCÜ KİŞİ SOHBETİ NE OKUR NE YAZAR ==='
select set_config('test.uid', :'u', false);
select count(*) as yabanci_kac_mesaj_goruyor from messages;
select count(*) as yabanci_kac_sohbet_goruyor from conversations;
do $$
declare cid uuid;
begin
  select deger::uuid into cid from m_ids where ad = 'c1';
  perform send_message(cid, 'Araya girdim');
  raise notice 'SONUÇ: HATA — yabancı sohbete yazdı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
\echo 'BEKLENEN: 0 mesaj, 0 sohbet, yazma engellendi'

\echo ''
\echo '=== 7) GÖNDERİLMİŞ MESAJ DEĞİŞTİRİLEMEZ VE SİLİNEMEZ ==='
reset role;
do $$
begin
  update messages set body = 'Bunu ben yazmadım' where body like 'Merhaba%';
  raise notice 'SONUÇ: HATA — mesaj içeriği değiştirildi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
do $$
begin
  delete from messages;
  raise notice 'SONUÇ: HATA — mesaj silindi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 8) Okundu işaretlemek yalnızca karşı tarafın mesajını kapsar ==='
set session role authenticated;
select set_config('test.uid', :'b', false);
select mark_conversation_read(:'c1_id') as okundu_yapilan;
reset role;
select count(*) filter (where sender_id = :'s' and read_at is not null) as saticininki_okundu,
       count(*) filter (where sender_id = :'b' and read_at is null)     as alicininki_okunmamis
  from messages where conversation_id = :'c1_id';
\echo 'BEKLENEN: satıcınınki okundu 1, alıcınınki okunmamış 1'

\echo ''
\echo '=== 9) HER MESAJA BİLDİRİM GİTMEZ ==='
-- Alıcı üst üste üç mesaj yazıyor; satıcı hiçbirini okumadı. Tek bildirim
-- olmalı, üç değil.
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from send_message(:'c1_id', 'Bir de şunu sorayım') \gset m3_
select id from send_message(:'c1_id', 'Ve şunu') \gset m4_
select id from send_message(:'c1_id', 'Bir de bu') \gset m5_
reset role;
select count(*) as saticiya_giden_bildirim
  from notifications where user_id = :'s' and kind = 'message.received';
\echo 'BEKLENEN: 1 — okunmamış mesaj varken ikinci bildirim gönderilmez'

\echo ''
\echo '=== 10) Sohbet listesi okunmamış sayısıyla geliyor ==='
set session role authenticated;
select set_config('test.uid', :'s', false);
select product_title, ben_aliciyim, okunmamis, son_mesaj
  from my_conversations() where conversation_id = :'c1_id';
-- Okunmamış 4: satıcı alıcının ilk mesajını da hiç okumadı (8'de okundu
-- işaretleyen alıcıydı ve o yalnızca satıcının mesajlarını kapsıyordu).
\echo 'BEKLENEN: Ahşap tren, ben alıcı değilim (f), 4 okunmamış, son mesaj "Bir de bu"'

\echo ''
\echo '=== 11) Taslak ilana sohbet açılamaz ==='
reset role;
select set_config('test.uid', :'s', false);
select id as pid from create_listing('Taslak ürün', 'Oyun & Oyuncak', 'İyi durumda', 'S', p_sub_category => 'Yapı & inşa') \gset p2_
insert into m_ids values ('p2', :'p2_pid');
set session role authenticated;
select set_config('test.uid', :'b', false);
do $$
declare pid text;
begin
  select deger into pid from m_ids where ad = 'p2';
  perform start_conversation(pid);
  raise notice 'SONUÇ: HATA — taslak ilana sohbet açıldı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

reset role;
