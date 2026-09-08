-- ELDENELE — Puan sunucuda, ve onu yönetici belirliyor
--
-- Kritik iddia 1: `create_listing` puan **kabul etmiyor**. Eski imza
-- düşürülmeseydi PostgreSQL aşırı yükleme yapar, güncel olmayan istemci
-- eskisini çağırmaya devam eder ve hiçbir şey değişmezdi.
--
-- Kritik iddia 3: puansız onay yok. Yöneticinin "onayla"ya basıp fiyat
-- girmeyi unutması, değeri belirsiz bir ilanı rafa koymak olurdu.
--
-- Kritik iddia 7: onay gövdesi istemciye kapalı. Puanı yazabilen istemci,
-- puanı seçebilen istemcidir.

\set s 'dd44dd44-0000-0000-0000-00000000a001'

\echo ''
\echo '=== Hazırlık ==='
insert into auth.users (id, email, phone, phone_confirmed_at, raw_user_meta_data)
values (:'s', 'deger-satici@example.com', '+905555550001', now(),
        '{"full_name":"Deniz Kaya"}'::jsonb)
on conflict (id) do nothing;

-- Onaya hazır ilan: dört kare yüklü, satıcı onaya göndermiş. Onayı iç gövdeyle
-- (`ilan_onayla`) yetkili rolde çağırıyoruz; yönetici yetkisinin kendi testi var.
create or replace function pg_temp.onaya_hazir(p_baslik text, p_kondisyon text)
returns text language plpgsql security definer as $$
declare pid text; sid text := 'dd44dd44-0000-0000-0000-00000000a001';
begin
  perform set_config('test.uid', sid, false);
  select id into pid from create_listing(p_baslik, 'Oyun & Oyuncak', p_kondisyon, 'S', p_sub_category => 'Yapı & inşa');
  insert into product_photos (product_id, slot, storage_path)
  select pid, s, sid || '/' || pid || '/' || s || '.jpg'
    from unnest(array['front','back','left','right']::photo_slot[]) s;
  perform submit_listing(pid);
  return pid;
end; $$;

set session role authenticated;
select set_config('test.uid', :'s', false);

\echo ''
\echo '=== 1) ESKİ İMZA YOK ==='
select bekle('puanı istemciden alan eski imza düşürüldü',
             (select count(*) = 0
                from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'create_listing'
                 and pg_get_function_identity_arguments(p.oid) like '%integer%'));

\echo ''
\echo '=== 2) Yeni ilan puansız doğuyor ==='
select id, points is null as puan_bos, degerleme_at is null as degerleme_yok
  from create_listing('Ahşap tren seti', 'Oyun & Oyuncak', 'İyi durumda', 'M',
                      p_sub_category => 'Yapı & inşa') \gset y_
select bekle_esit('ilan puansız doğar', :'y_puan_bos'::text, 't');
select bekle_esit('ilan değerlemesiz doğar', :'y_degerleme_yok'::text, 't');

\echo ''
\echo '=== 3) PUANSIZ ONAY YOK ==='
reset role;
select pg_temp.onaya_hazir('Fiyatsız onay', 'İyi durumda') as pid \gset f_
select set_config('test.pid', :'f_pid', false);
do $$
declare pid text := current_setting('test.pid');
begin
  perform ilan_onayla(pid, null, null, 'front', null);
  raise notice 'SONUÇ: HATA — fiyatsız ve puansız onay geçti';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
select bekle_esit('ilan incelemede kaldı',
                  (select status from products where id = :'f_pid'), 'IN_REVIEW');

\echo ''
\echo '=== 4) SIFIR FİYATLA ONAY: FORMÜL PUANI HESAPLAR ==='
select pg_temp.onaya_hazir('Süperman figürü', 'İyi durumda') as pid \gset sp_
select points, sifir_fiyat, degerleme_kaynak, status
  from ilan_onayla(:'sp_pid', 1599, null, 'front', null) \gset o_
-- 1599 × %57 = 910. Sabit sayı bilerek: formül değişirse bu test düşmeli.
select bekle_esit('İyi durumda oranı puanı doğru veriyor', :o_points, 910);
select bekle_esit('sıfır fiyatı saklanır', :o_sifir_fiyat::numeric, 1599::numeric);
select bekle_esit('kaynak yönetici', :'o_degerleme_kaynak'::text, 'admin');
select bekle_esit('ilan yayında', :'o_status'::text, 'ACTIVE');
select bekle('kareler onaylandı',
             (select count(*) = 0 from product_photos
               where product_id = :'sp_pid' and moderation_status <> 'approved'));

\echo ''
\echo '=== 5) ELLE PUAN: FORMÜL DEVRE DIŞI, TAVAN YOK ==='
-- Yönetici sayıyı kendisi yazarsa o yazılır. Tavan bilerek yok: platform her
-- fiyat aralığındaki ürüne açık ve kararı veren zaten insan.
select pg_temp.onaya_hazir('Çok pahalı şey', 'Yeni gibi') as pid \gset b_
select points from ilan_onayla(:'b_pid', 100000, 74000, 'front', null) \gset x_
select bekle_esit('elle yazılan puan aynen', :x_points, 74000);
select bekle_esit('yüksek puanlı ilan yayına girer',
                  (select status from products where id = :'b_pid'), 'ACTIVE');
select pg_temp.onaya_hazir('Formülü ezen', 'İyi durumda') as pid \gset e_
select points from ilan_onayla(:'e_pid', 1599, 1200, 'front', null) \gset ez_
select bekle_esit('elle puan formülün önüne geçer (910 değil 1200)', :ez_points, 1200);

\echo ''
\echo '=== 6) Sıfır elle puan reddedilir ==='
select pg_temp.onaya_hazir('Sıfır puan', 'İyi durumda') as pid \gset z_
select set_config('test.pid', :'z_pid', false);
do $$
declare pid text := current_setting('test.pid');
begin
  perform ilan_onayla(pid, null, 0, 'front', null);
  raise notice 'SONUÇ: HATA — sıfır puanla onaylandı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
select bekle_esit('sıfır puan denemesi ilanı incelemede bıraktı',
                  (select status from products where id = :'z_pid'), 'IN_REVIEW');

\echo ''
\echo '=== 7) ONAY GÖVDESİ İSTEMCİYE KAPALI ==='
select bekle('ilan_onayla authenticated''a kapalı',
             not has_function_privilege('authenticated',
               'public.ilan_onayla(text, numeric, integer, public.photo_slot, uuid)', 'execute'));
select bekle('ilan_onayla anon''a kapalı',
             not has_function_privilege('anon',
               'public.ilan_onayla(text, numeric, integer, public.photo_slot, uuid)', 'execute'));
select bekle('set_product_points istemciye kapandı',
             not has_function_privilege('authenticated',
               'public.set_product_points(text, integer)', 'execute'));
select bekle('publish_listing istemciye kapandı',
             not has_function_privilege('authenticated',
               'public.publish_listing(text, public.photo_slot)', 'execute'));

\echo ''
\echo '=== 8) TABAN UYGULANINCA İŞARETLENİR ==='
-- Taban (50) bir kelepçe: hesaplanan puan altında kalırsa sessizce yükseltir.
-- Satıcı ilanının neden 50 puan dediğini bilmeli, yoksa rakam keyfî görünür.
select pg_temp.onaya_hazir('Ucuz oyuncak', 'İyi durumda') as pid \gset u_
select points from ilan_onayla(:'u_pid', 25, null, 'front', null) \gset uc_
select bekle_esit('25 TL tabana yükseltilir', :uc_points, 50);
select bekle('taban işareti konur',
             (select taban_uygulandi from products where id = :'u_pid'));

\echo ''
\echo '=== 8b) KELEPÇESİZ TAM 50''DE İŞARET KONMAZ ==='
-- 88 TL × 0,57 = 50,16 → 50. Tabana yuvarlamayla ulaşıyor, yükseltilmiyor.
select pg_temp.onaya_hazir('Tam tabanda', 'İyi durumda') as pid \gset tt_
select points from ilan_onayla(:'tt_pid', 88, null, 'front', null) \gset tp_
select bekle_esit('88 TL zaten 50 puan eder', :tp_points, 50);
select bekle('yükseltme olmadığı için işaret konmaz',
             (select not taban_uygulandi from products where id = :'tt_pid'));

\echo ''
\echo '=== 8c) Elle puanda taban işareti hiç konmaz ==='
select pg_temp.onaya_hazir('Elle elli', 'İyi durumda') as pid \gset el_
select points from ilan_onayla(:'el_pid', 25, 50, 'front', null) \gset elp_
select bekle_esit('elle 50', :elp_points, 50);
select bekle('elle puanda işaret yok — yönetici sayıyı kendisi seçti',
             (select not taban_uygulandi from products where id = :'el_pid'));

\echo ''
\echo '=== 9) TABAN ÜSTÜ ÜRÜNDE İŞARET YOK ==='
select pg_temp.onaya_hazir('Normal ürün', 'İyi durumda') as pid \gset n_
select points from ilan_onayla(:'n_pid', 1000, null, 'front', null) \gset np_
select bekle_esit('1000 TL × %57 = 570 puan', :np_points, 570);
select bekle('taban devreye girmedi',
             (select not taban_uygulandi from products where id = :'n_pid'));
