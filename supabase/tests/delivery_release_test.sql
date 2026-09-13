-- ELDENELE — Kargo, teslimat onayı, otomatik tamamlanma ve zaman aşımı
--
-- 2026-09-08 kurgusu: alıcı TL ödemez, satıcı kendi kargosunu öder. Puan
-- havuza girer; satıcı 4 gün içinde kargo firması + takip numarası girer
-- (`mark_shipped`); alıcı 7 gün içinde onaylar ya da itiraz eder. Süreler
-- dolarsa makine karar verir: 4 gün → iade, 7 gün → aktarım.
--
-- Kritik iddialar: 2 (satıcı kendi takasını onaylayamaz), 4 (kargo bilgisini
-- yalnızca satıcı girer ve boş takip numarası kabul edilmez), 6 (kargolanmayan
-- takas iade edilir ve teslimat kopyası silinir), 7 (itiraz sayacı durdurur),
-- 9 (itiraz reddedilince takas DELIVERED'a değil SHIPPED'e döner).

\set s '55555555-5555-5555-5555-555555555555'
\set b '66666666-6666-6666-6666-666666666666'
\set y '67676767-6767-6767-6767-676767676767'

\echo ''
\echo '=== Hazırlık: hesaplar, adres, bakiye ve yayında bir ilan ==='
insert into auth.users (id, email, raw_user_meta_data)
values (:'s', 'teslim-satici@example.com', '{"full_name":"Zeynep Demir"}'::jsonb),
       (:'b', 'teslim-alici@example.com',  '{"full_name":"Ali Kaya"}'::jsonb),
       (:'y', 'teslim-yabanci@example.com', '{}'::jsonb)
on conflict (id) do nothing;
select test_adres(:'b');

select available_points as alici_baslangic
  from earn_points(:'b', 2000, 'test:teslim-alici-bakiye');

create or replace function pg_temp.yayinda_ilan(p_baslik text, p_puan integer)
returns text language plpgsql as $$
declare pid text; sid text := '55555555-5555-5555-5555-555555555555';
begin
  perform set_config('test.uid', sid, false);
  select id into pid from create_listing(p_baslik, 'Oyun & Oyuncak', 'Az kullanılmış', 'M', p_sub_category => 'Yapı & inşa');
  insert into product_photos (product_id, slot, storage_path, moderation_status)
  select pid, s, sid || '/' || pid || '/' || s || '.jpg', 'approved'
    from unnest(array['front','back','left','right','label']::photo_slot[]) s;
  perform test_yayinla(pid, p_puan);
  return pid;
end; $$;

create temp table t_ids (ad text primary key, deger text);
grant all on t_ids to authenticated;

\echo ''
\echo '=== 1) Takas açılınca satıcının kargo sayacı başlar, adres kopyalanır ==='
select pg_temp.yayinda_ilan('Ahşap tren', 400) as pid \gset i1_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from create_trade(:'i1_pid', :'b') \gset t1_
insert into t_ids values ('t1', :'t1_id');
select bekle_esit('puan havuzda', (select status from trades where id = :'t1_id'), 'POINTS_HELD');
select bekle('sayaç 4 güne kurulu',
             (select deadline_at between now() + interval '3 days 23 hours'
                                    and now() + interval '4 days 1 hour'
                from trades where id = :'t1_id'));
select bekle('teslimat adresi kopyalandı',
             (select teslimat ->> 'acik_adres' is not null from trades where id = :'t1_id'));
-- Satıcı adresi görüyor: RLS "taraf olduğun takası gör" satırı açıyor.
select set_config('test.uid', :'s', false);
select bekle_esit('satıcı alıcının ilçesini görüyor',
                  (select teslimat ->> 'ilce' from trades where id = :'t1_id'), 'Kadıköy');
-- Yabancı hiçbir şey görmüyor.
select set_config('test.uid', :'y', false);
select bekle_esit('yabancı takası görmüyor',
                  (select count(*) from trades where id = :'t1_id'), 0::bigint);

\echo ''
\echo '=== 2) SATICI KENDİ TAKASINI ONAYLAYAMAZ ==='
select set_config('test.uid', :'s', false);
do $$
declare tid uuid;
begin
  select deger::uuid into tid from t_ids where ad = 't1';
  perform confirm_delivery(tid);
  raise notice 'SONUÇ: HATA — satıcı kendi takasını onayladı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
select bekle_esit('durum değişmedi', (select status from trades where id = :'t1_id'), 'POINTS_HELD');

\echo ''
\echo '=== 3) Kargolanmamış takas onaylanamaz ==='
select set_config('test.uid', :'b', false);
do $$
declare tid uuid;
begin
  select deger::uuid into tid from t_ids where ad = 't1';
  perform confirm_delivery(tid);
  raise notice 'SONUÇ: HATA — POINTS_HELD durumunda onaylandı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 4) KARGO BİLGİSİNİ YALNIZCA SATICI GİRER ==='
-- Alıcı giremez: girebilseydi satıcı göndermeden "kargoda" görünürdü.
do $$
declare tid uuid;
begin
  select deger::uuid into tid from t_ids where ad = 't1';
  perform mark_shipped(tid, 'Yurtiçi Kargo', '1234567890');
  raise notice 'SONUÇ: HATA — alıcı kargo bilgisi girdi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
-- Yabancı giremez.
select set_config('test.uid', :'y', false);
do $$
declare tid uuid;
begin
  select deger::uuid into tid from t_ids where ad = 't1';
  perform mark_shipped(tid, 'Yurtiçi Kargo', '1234567890');
  raise notice 'SONUÇ: HATA — yabancı kargo bilgisi girdi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
-- Satıcı, boş takip numarasıyla giremez.
select set_config('test.uid', :'s', false);
do $$
declare tid uuid;
begin
  select deger::uuid into tid from t_ids where ad = 't1';
  perform mark_shipped(tid, 'Yurtiçi Kargo', '   ');
  raise notice 'SONUÇ: HATA — boş takip numarası kabul edildi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
select bekle_esit('üç deneme sonunda hâlâ POINTS_HELD',
                  (select status from trades where id = :'t1_id'), 'POINTS_HELD');

\echo ''
\echo '=== 4b) Satıcı kargo bilgisini girer: SHIPPED, 7 günlük onay sayacı ==='
select status from mark_shipped(:'t1_id', 'Yurtiçi Kargo', 'YK-1234567890');
select bekle_esit('SHIPPED', (select status from trades where id = :'t1_id'), 'SHIPPED');
select bekle('shipped_at damgalandı', (select shipped_at is not null from trades where id = :'t1_id'));
select bekle_esit('takip numarası saklı',
                  (select takip_no from trades where id = :'t1_id'), 'YK-1234567890');
select bekle('sayaç 7 güne kurulu',
             (select deadline_at between now() + interval '6 days 23 hours'
                                    and now() + interval '7 days 1 hour'
                from trades where id = :'t1_id'));
reset role;
select bekle('alıcının bildirimi takip numarasını içeriyor',
             exists (select 1 from notifications
                      where user_id = :'b' and kind = 'trade.shipped'
                        and body like '%YK-1234567890%'));
-- İkinci kez girilemez: durum makinesi yalnızca ileri gider.
set session role authenticated;
select set_config('test.uid', :'s', false);
do $$
declare tid uuid;
begin
  select deger::uuid into tid from t_ids where ad = 't1';
  perform mark_shipped(tid, 'Aras Kargo', 'AR-999');
  raise notice 'SONUÇ: HATA — kargo bilgisi ikinci kez yazıldı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 5) Alıcı onaylar: puan satıcıya geçer, ilan SOLD olur ==='
select set_config('test.uid', :'b', false);
select status from confirm_delivery(:'t1_id');
reset role;
select bekle_esit('satıcı puanı aldı',
                  (select available_points from wallets where user_id = :'s'), 400);
select bekle_esit('alıcının havuzu boşaldı',
                  (select held_points from wallets where user_id = :'b'), 0);
select bekle_esit('ilan SOLD', (select status from products where id = :'i1_pid'), 'SOLD');
select bekle('sayaç kapandı', (select deadline_at is null from trades where id = :'t1_id'));

\echo ''
\echo '=== 6) 4 GÜNDE KARGOLANMAZSA İADE — ilan vitrine döner, adres kopyası silinir ==='
select pg_temp.yayinda_ilan('Denge bisikleti', 300) as pid \gset i2_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from create_trade(:'i2_pid', :'b') \gset t2_
reset role;
update trades set deadline_at = now() - interval '1 minute' where id = :'t2_id';
select * from expire_stale_trades();
select bekle_esit('takas REFUNDED', (select status from trades where id = :'t2_id'), 'REFUNDED');
select bekle_esit('ilan yeniden ACTIVE', (select status from products where id = :'i2_pid'), 'ACTIVE');
select bekle_esit('alıcının puanı geri döndü (2000 − 400)',
                  (select available_points from wallets where user_id = :'b'), 1600);
select bekle('kargolanmayan takasın adres kopyası silindi',
             (select teslimat is null from trades where id = :'t2_id'));

\echo ''
\echo '=== 7) İTİRAZ SAYACI DURDURUR — otomatik aktarım itirazlıyı ödemez ==='
select pg_temp.yayinda_ilan('Kitaplık', 250) as pid \gset i3_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from create_trade(:'i3_pid', :'b') \gset t3_
select set_config('test.uid', :'s', false);
select status from mark_shipped(:'t3_id', 'MNG Kargo', 'MNG-555555');
select set_config('test.uid', :'b', false);
select status from open_dispute(:'t3_id', 'Ürün açıklamadaki gibi değil');
reset role;
select bekle('sayaç durdu', (select deadline_at is null from trades where id = :'t3_id'));
select * from expire_stale_trades();
select bekle_esit('DISPUTED kaldı', (select status from trades where id = :'t3_id'), 'DISPUTED');
select bekle_esit('satıcı puanı sabit (400)',
                  (select available_points from wallets where user_id = :'s'), 400);

\echo ''
\echo '=== 8) 7 GÜN DOLUNCA PUAN SATICIYA OTOMATİK GEÇER ==='
select pg_temp.yayinda_ilan('Lego seti', 150) as pid \gset i5_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from create_trade(:'i5_pid', :'b') \gset t5_
select set_config('test.uid', :'s', false);
select status from mark_shipped(:'t5_id', 'PTT Kargo', 'PTT-0001');
reset role;
update trades set deadline_at = now() - interval '1 minute' where id = :'t5_id';
select * from expire_stale_trades();
select bekle_esit('COMPLETED', (select status from trades where id = :'t5_id'), 'COMPLETED');
select bekle_esit('satıcı 550 (400 + 150)',
                  (select available_points from wallets where user_id = :'s'), 550);

\echo ''
\echo '=== 9) İTİRAZ REDDEDİLİNCE TAKAS SHIPPED''E DÖNER, DELIVERED''A DEĞİL ==='
-- Eski kod ret sonrası 'DELIVERED' yazıyordu; teslim bildirilmemişken bu,
-- alıcının hiç görmediği bir teslimi kayda geçirmek olurdu. Kalan süre
-- korunmalı: itiraz açmak sayacı sıfırlamaz.
select pg_temp.yayinda_ilan('Peluş ayı', 200) as pid \gset i6_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from create_trade(:'i6_pid', :'b') \gset t6_
select set_config('test.uid', :'s', false);
select status from mark_shipped(:'t6_id', 'Sürat Kargo', 'SR-424242');
reset role;
update trades set deadline_at = now() + interval '2 days' where id = :'t6_id';
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from open_dispute(:'t6_id', 'Kutu ezik geldi') \gset d6_
reset role;
select status from resolve_dispute(:'d6_id', false, 'Ürün fotoğraflarla uyumlu');
select bekle_esit('SHIPPED''e döndü', (select status from trades where id = :'t6_id'), 'SHIPPED');
select bekle('kalan süre korundu (~2 gün)',
             (select deadline_at between now() + interval '47 hours' and now() + interval '49 hours'
                from trades where id = :'t6_id'));
select bekle('kalan süre alanı temizlendi',
             (select deadline_remaining is null from trades where id = :'t6_id'));

\echo ''
\echo '=== 10) Gerekçesiz itiraz açılamaz ==='
set session role authenticated;
select set_config('test.uid', :'b', false);
do $$
declare tid uuid;
begin
  select deger::uuid into tid from t_ids where ad = 't1';
  perform open_dispute(tid, '   ');
  raise notice 'SONUÇ: HATA — boş gerekçeyle itiraz açıldı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;

\echo ''
\echo '=== 11) Adressiz alıcı takas açamaz ==='
-- Satıcının göndereceği yer takas anında belli olmalı; "sonra sorarız" onu
-- 4 günlük sayacın altında adres beklerken bırakırdı.
select pg_temp.yayinda_ilan('Adres testi', 100) as pid \gset i7_
reset role;
select available_points from earn_points(:'y', 500, 'test:teslim-yabanci-bakiye');
set session role authenticated;
select set_config('test.uid', :'y', false);
select set_config('test.pid', :'i7_pid', false);
do $$
declare pid text := current_setting('test.pid');
begin
  perform create_trade(pid);
  raise notice 'SONUÇ: HATA — adressiz takas açıldı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
select bekle_esit('ilan hâlâ ACTIVE — geri sarıldı',
                  (select status from products where id = :'i7_pid'), 'ACTIVE');

\echo ''
\echo '=== 12) Defter dengede: havuzda asılı puan kalmadı ==='
reset role;
select bekle_esit('alıcının havuzu = açık takasların toplamı',
                  (select held_points from wallets where user_id = :'b'),
                  (select coalesce(sum(points),0)::integer from trades
                    where buyer_id = :'b'
                      and status in ('CREATED','POINTS_HELD','SHIPPED','DELIVERED','DISPUTED')));
select bekle_esit('kapanmış takasta asılı sayaç yok',
                  (select count(*) from trades
                    where (buyer_id = :'b' or seller_id = :'s')
                      and deadline_at is not null
                      and status in ('COMPLETED','REFUNDED','DISPUTED')), 0::bigint);

-- ============================================================================
-- 2026-09-13 denetim düzeltmeleri (`20260913132351_denetim_duzeltmeleri.sql`)
-- ============================================================================

\echo ''
\echo '=== 13) BAŞKASININ ADINA TAKAS AÇILAMAZ ==='
-- `p_buyer_id` istemciden geliyordu ve çağıranla karşılaştırılmıyordu: satıcı
-- kendi ilanı için kurbanın kimliğiyle takas açıp adresini ve puanını
-- alabilirdi. Düşerse gizlilik sayfasının "başka hiçbir üye görmez" cümlesi
-- yalan olur.
select pg_temp.yayinda_ilan('Sahte alıcı denemesi', 100) as pid \gset i8_
set session role authenticated;
select set_config('test.uid', :'y', false);
select set_config('test.pid', :'i8_pid', false);
do $$
declare pid text := current_setting('test.pid');
begin
  perform create_trade(pid, '66666666-6666-6666-6666-666666666666');
  raise notice 'SONUÇ: HATA — yabancı, alıcı adına takas açtı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
reset role;
select bekle_esit('ilan hâlâ ACTIVE, alıcı adına takas yok',
                  (select count(*) from trades where product_id = :'i8_pid'), 0::bigint);
select bekle('anon trades tablosunu okuyamaz',
             not has_table_privilege('anon', 'public.trades', 'select'));
-- Kendi adına (parametre açıkça verilmiş) açabilir.
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from create_trade(:'i8_pid', :'b') \gset t8_
select bekle_esit('kendi adına açıldı', (select status from trades where id = :'t8_id'), 'POINTS_HELD');

\echo ''
\echo '=== 14) KARGO BİLGİSİ BİÇİMLİ: firma sınırlı, takip numarası harf-rakam ==='
-- İkisi de alıcıya giden bildirime gömülüyor; serbest metin platform ağzından
-- dolandırıcılık mesajı taşırdı.
select set_config('test.uid', :'s', false);
select set_config('test.tid', :'t8_id', false);
do $$
declare tid uuid := current_setting('test.tid')::uuid;
begin
  perform mark_shipped(tid, 'Yurtiçi Kargo. Kargo ücreti için 250 TL yi TR12 3456 IBAN a gönderin', '1234567890');
  raise notice 'SONUÇ: HATA — uzun firma metni geçti';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
do $$
declare tid uuid := current_setting('test.tid')::uuid;
begin
  perform mark_shipped(tid, 'Aras', 'http://x.y/z?takip=1');
  raise notice 'SONUÇ: HATA — bağlantı takip numarası diye geçti';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
select bekle_esit('hâlâ POINTS_HELD', (select status from trades where id = :'t8_id'), 'POINTS_HELD');
select status from mark_shipped(:'t8_id', 'Aras Kargo', 'ABC 123 456');
select bekle_esit('boşluklar ayıklandı', (select takip_no from trades where id = :'t8_id'), 'ABC123456');

\echo ''
\echo '=== 15) KAPANAN TAKASTA ADRES KOPYASI SİLİNİR ==='
-- Gizlilik sayfası: "takas kapanınca satıcıya görünmez olur". Politika
-- kolon süzemez; kopya kapanışta siliniyor.
select set_config('test.uid', :'b', false);
select status from confirm_delivery(:'t8_id');
reset role;
select bekle_esit('takas tamamlandı', (select status from trades where id = :'t8_id'), 'COMPLETED');
select bekle('teslimat kopyası silindi', (select teslimat is null from trades where id = :'t8_id'));
select bekle('kargo bilgisi kaldı (kanıt)', (select takip_no is not null from trades where id = :'t8_id'));

\echo ''
\echo '=== 16) İTİRAZDAN DÖNÜŞ İKİNCİ "YOLDA" BİLDİRİMİ ÜRETMEZ ==='
select pg_temp.yayinda_ilan('İtiraz sessizliği', 300) as pid \gset i9_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from create_trade(:'i9_pid', :'b') \gset t9_
select set_config('test.uid', :'s', false);
select status from mark_shipped(:'t9_id', 'MNG', 'MNG-4455');
select set_config('test.uid', :'b', false);
select id from open_dispute(:'t9_id', 'Kutu ezik geldi, içi kırık.') \gset d9_
reset role;
select status from resolve_dispute(:'d9_id', false, 'Kanıt yetersiz');
select bekle_esit('takas SHIPPED''e döndü', (select status from trades where id = :'t9_id'), 'SHIPPED');
select bekle_esit('alıcıya tek "yolda" bildirimi',
                  (select count(*) from notifications
                    where user_id = :'b' and kind = 'trade.shipped'
                      and data ->> 'trade' = :'t9_id'), 1::bigint);

\echo ''
\echo '=== 17) REFUND_KEEP: ürün alıcıda kaldıysa ilan vitrine dönmez ==='
-- Eşik (dispute_policy.return_threshold_points) altındaki iadede ürün
-- alıcıda kalır; ilan ACTIVE olsaydı satıcı elinde olmayan malı satardı.
select pg_temp.yayinda_ilan('Ucuz kırık oyuncak', 100) as pid \gset i10_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from create_trade(:'i10_pid', :'b') \gset t10_
select set_config('test.uid', :'s', false);
select status from mark_shipped(:'t10_id', 'PTT', 'PTT-9900');
select set_config('test.uid', :'b', false);
select id from open_dispute(:'t10_id', 'Ürün tarifle uyuşmuyor, parçası eksik.') \gset d10_
reset role;
select resolution from resolve_dispute(:'d10_id', true, 'Alıcı haklı');
select bekle_esit('karar REFUND_KEEP', (select resolution from disputes where id = :'d10_id'), 'REFUND_KEEP');
select bekle_esit('takas iade edildi', (select status from trades where id = :'t10_id'), 'REFUNDED');
select bekle_esit('ilan vitrine dönmedi', (select status from products where id = :'i10_pid'), 'REMOVED');
select bekle('satıcıya "vitrinde" denmedi',
             not exists (select 1 from notifications
                          where user_id = :'s' and kind = 'trade.refunded'
                            and data ->> 'trade' = :'t10_id' and body like '%vitrinde%'));
select bekle('kargo sonrası iadede de adres kopyası silindi',
             (select teslimat is null from trades where id = :'t10_id'));

\echo ''
\echo '=== 18) expire_stale_trades: CREATED satır koşuyu düşürmez ==='
-- Emanete hiç girmemiş bir satır (doğrudan insert) süresi dolunca
-- `refund_points` istisnasıyla bütün saatlik koşuyu durduruyordu.
select pg_temp.yayinda_ilan('Yarım kalmış takas', 100) as pid \gset i11_
insert into trades (buyer_id, seller_id, product_id, points, status)
values (:'b', :'s', :'i11_pid', 100, 'CREATED')
returning id \gset t11_
-- Damga tetikleyicisi INSERT'te sayacı 4 güne kurar; süresi dolmuş gibi geri çekiyoruz.
update trades set deadline_at = now() - interval '1 hour' where id = :'t11_id';
select * from expire_stale_trades();
select bekle('CREATED satır sayaçsız kaldı, koşu düşmedi',
             (select deadline_at is null and status = 'CREATED' from trades where id = :'t11_id'));
delete from trades where id = :'t11_id';

\echo ''
\echo '=== 19) mark_shipped: 65 karakter takip numarası ve adressiz takas reddedilir ==='
select pg_temp.yayinda_ilan('Uzun takip', 100) as pid \gset i12_
set session role authenticated;
select set_config('test.uid', :'b', false);
select id from create_trade(:'i12_pid', :'b') \gset t12_
select set_config('test.uid', :'s', false);
select set_config('test.tid', :'t12_id', false);
do $$
declare tid uuid := current_setting('test.tid')::uuid;
begin
  perform mark_shipped(tid, 'Yurtiçi Kargo', repeat('A', 65));
  raise notice 'SONUÇ: HATA — 65 karakter takip numarası geçti';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
reset role;
select bekle_esit('hâlâ POINTS_HELD', (select status from trades where id = :'t12_id'), 'POINTS_HELD');
-- Göç öncesi açılmış, adres kopyası olmayan takas: kargoya verilemez.
update trades set teslimat = null where id = :'t12_id';
set session role authenticated;
select set_config('test.uid', :'s', false);
do $$
declare tid uuid := current_setting('test.tid')::uuid;
begin
  perform mark_shipped(tid, 'Yurtiçi Kargo', 'YK-12345');
  raise notice 'SONUÇ: HATA — adressiz takas kargoya verildi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
reset role;
select bekle_esit('adressiz takas POINTS_HELD kaldı', (select status from trades where id = :'t12_id'), 'POINTS_HELD');
select bekle('takip numarası yazılmadı', (select takip_no is null from trades where id = :'t12_id'));
