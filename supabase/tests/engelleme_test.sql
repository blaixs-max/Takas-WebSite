-- ELDENELE — Kullanıcı engelleme testleri
--
-- Kritik iddialar: 2 (engel **iki yönlü** kesiyor — engelleyen de yazamaz,
-- yoksa engelleme tek taraflı bir susturma aracına dönerdi), 4 (liste
-- yalnızca kendi engellerini gösteriyor) ve 6 (başkasının engeli
-- kaldırılamıyor). 3 numaralı iddia listenin **ad değil bağlam** verdiğini
-- sabitliyor: uygulama karşı tarafın kimliğini başka hiçbir yerde
-- göstermiyor, bu ekran da göstermemeli.

\set s 'aa11aa11-0000-0000-0000-00000000e001'
\set b 'aa11aa11-0000-0000-0000-00000000e002'
\set u 'aa11aa11-0000-0000-0000-00000000e003'

\echo ''
\echo '=== Hazırlık ==='
insert into auth.users (id, email, phone, phone_confirmed_at, raw_user_meta_data)
values (:'s', 'engel-satici@example.com',  '+905558880001', now(),
        '{"full_name":"Zeynep Demir"}'::jsonb),
       (:'b', 'engel-alici@example.com',   '+905558880002', now(),
        '{"full_name":"Ali Kaya"}'::jsonb),
       (:'u', 'engel-yabanci@example.com', '+905558880003', now(),
        '{"full_name":"Üçüncü Kişi"}'::jsonb)
on conflict (id) do nothing;

create or replace function pg_temp.engel_ilan(p_baslik text)
returns text language plpgsql as $$
declare pid text; sid text := 'aa11aa11-0000-0000-0000-00000000e001';
begin
  perform set_config('test.uid', sid, false);
  select id into pid from create_listing(p_baslik, 'Oyun & Oyuncak', 'Az kullanılmış', 'M', 300,
                                         p_sub_category => 'Yapı & inşa');
  insert into product_photos (product_id, slot, storage_path, moderation_status)
  select pid, s, sid || '/' || pid || '/' || s || '.jpg', 'approved'
    from unnest(array['front','back','left','right','label']::photo_slot[]) s;
  perform publish_listing(pid, 'front');
  return pid;
end; $$;

create temp table e_ids (ad text primary key, deger text);
grant all on e_ids to authenticated;

select pg_temp.engel_ilan('Suluk') as pid \gset e_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from start_conversation(:'e_pid') \gset c_
insert into e_ids values ('c', :'c_id'), ('p', :'e_pid');
select send_message(:'c_id', 'Merhaba, hâlâ duruyor mu?');
reset role;
/* Mesaj sayısıyla doğrulanıyor, `send_message(...) is not null` ile değil:
   `send_message` bileşik bir satır döndürüyor ve Postgres'te
   `satır IS NOT NULL` "bütün alanlar dolu" demek. `read_at` başlangıçta
   null olduğu için o ifade mesaj gitse bile `f` veriyor — testi bir tur
   yanlış yere baktırdı. */
select count(*) = 1 as mesaj_gitti from messages where conversation_id = :'c_id';
\echo 'BEKLENEN: mesaj_gitti = t'
set session role authenticated;
select set_config('test.uid', :'b', false);

\echo ''
\echo '=== 1) Alıcı, sohbet üzerinden satıcıyı engeller ==='
select block_conversation_peer(:'c_id');
reset role;
select count(*) = 1 as kayit_var
  from user_blocks where blocker_id = :'b' and blocked_id = :'s';
\echo 'BEKLENEN: kayit_var = t'

\echo ''
\echo '=== 2) ENGEL İKİ YÖNDE DE KESİYOR ==='
-- Engelleyen taraf da yazamaz. Tek yönlü olsaydı engelleme, karşı tarafı
-- susturup kendisi konuşmaya devam etmenin yolu olurdu.
set session role authenticated;
select set_config('test.uid', :'b', false);
do $$
declare cid uuid;
begin
  select deger::uuid into cid from e_ids where ad = 'c';
  perform send_message(cid, 'Yine ben');
  raise notice 'SONUÇ: HATA — engelleyen hâlâ yazabiliyor';
exception when others then
  raise notice 'SONUÇ: doğru — engelleyen de yazamıyor (%)', sqlerrm;
end $$;
select set_config('test.uid', :'s', false);
do $$
declare cid uuid;
begin
  select deger::uuid into cid from e_ids where ad = 'c';
  perform send_message(cid, 'Evet duruyor');
  raise notice 'SONUÇ: HATA — engellenen yazabiliyor';
exception when others then
  raise notice 'SONUÇ: doğru — engellenen yazamıyor (%)', sqlerrm;
end $$;
\echo 'BEKLENEN: iki yönde de reddedildi'

\echo ''
\echo '=== 3) Liste kimliği değil bağlamı veriyor ==='
select set_config('test.uid', :'b', false);
select blocked_id = :'s' as dogru_kisi,
       baglam = 'Suluk ilanının satıcısı' as baglam_dogru
  from my_blocks();
\echo 'BEKLENEN: dogru_kisi = t, baglam_dogru = t (ad değil, ilan bağlamı)'

\echo ''
\echo '=== 4) Başkasının engelleri görünmüyor ==='
select set_config('test.uid', :'u', false);
select count(*) = 0 as bos from my_blocks();
\echo 'BEKLENEN: bos = t'

\echo ''
\echo '=== 5) Engel kaldırılıyor, mesajlaşma geri geliyor ==='
select set_config('test.uid', :'b', false);
select unblock_user(:'s');
select send_message(:'c_id', 'Pardon, yanlışlıkla olmuş');
reset role;
select count(*) = 2 as tekrar_yazabiliyor from messages where conversation_id = :'c_id';
select count(*) = 0 as kayit_gitti
  from user_blocks where blocker_id = :'b' and blocked_id = :'s';
\echo 'BEKLENEN: tekrar_yazabiliyor = t, kayit_gitti = t'

\echo ''
\echo '=== 6) BAŞKASININ ENGELİ KALDIRILAMIYOR ==='
-- `unblock_user` yalnızca çağıranın kendi satırını silmeli. Silmeseydi,
-- engellenen kişi kendi engelini kaldırıp yazmaya devam edebilirdi.
set session role authenticated;
select set_config('test.uid', :'b', false);
select block_conversation_peer(:'c_id');
select set_config('test.uid', :'s', false);
select unblock_user(:'b');
select unblock_user(:'s');
reset role;
select count(*) = 1 as engel_duruyor
  from user_blocks where blocker_id = :'b' and blocked_id = :'s';
\echo 'BEKLENEN: engel_duruyor = t'
