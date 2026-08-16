-- ELDENELE — Kare denetimi ölçümü ve oran sınırı
--
-- Kritik iddia 2: **oran sınırı çağrıya bakıyor, kareye değil.** Reddedilen
-- kare yeniden çekilip yeniden gönderiliyor ve her deneme para; sınır kare
-- sayısına bağlansaydı aynı kareyi yüz kez göndermek bedava olurdu.
--
-- Kritik iddia 4: tablo istemciye tamamen kapalı. RLS açık ve **hiç politika
-- yok** — yani `service_role` dışında kimse okuyamaz. Politikasız ve RLS'siz
-- bir tablo ile politikasız ve RLS'li bir tablo arasındaki fark budur ve
-- ikincisini istiyoruz.

\set u 'cc33cc33-0000-0000-0000-00000000f001'
\set v 'cc33cc33-0000-0000-0000-00000000f002'

\echo ''
\echo '=== Hazırlık ==='
insert into auth.users (id, email, phone, phone_confirmed_at, raw_user_meta_data)
values (:'u', 'olcum-bir@example.com', '+905556660001', now(), '{"full_name":"Ayşe Yıldız"}'::jsonb),
       (:'v', 'olcum-iki@example.com', '+905556660002', now(), '{"full_name":"Can Öz"}'::jsonb)
on conflict (id) do nothing;

\echo ''
\echo '=== 1) Hak başlangıçta var ==='
select foto_denetim_hakki(:'u', 5) as hak_var;
\echo 'BEKLENEN: hak_var = t'

\echo ''
\echo '=== 2) ORAN SINIRI ÇAĞRIYA BAKIYOR, KAREYE DEĞİL ==='
-- Beş çağrı, hepsi AYNI kare. Sınır kareye bağlansaydı bu bir tek sayılır ve
-- aynı kareyi sonsuz kez göndermek bedava olurdu.
select foto_denetim_kaydet(:'u', '11111111-1111-1111-1111-111111111111'::uuid,
                           'gemini-2.5-flash', 'rejected', 'yanlis_aci')
  from generate_series(1, 5);
select foto_denetim_hakki(:'u', 5) as hak_bitti;
\echo 'BEKLENEN: hak_bitti = f (beş çağrı aynı kareye ait olsa da sınır doldu)'

\echo ''
\echo '=== 3) Sınır kullanıcıya özel ==='
select foto_denetim_hakki(:'v', 5) as digeri_etkilenmedi;
\echo 'BEKLENEN: digeri_etkilenmedi = t'

\echo ''
\echo '=== 4) TABLO İSTEMCİYE KAPALI ==='
select relrowsecurity as rls_acik,
       (select count(*) from pg_policy where polrelid = c.oid) as politika_sayisi
  from pg_class c where c.relname = 'photo_check_events';
\echo 'BEKLENEN: rls_acik = t, politika_sayisi = 0 (yani service_role dışı hiç kimse)'

select has_table_privilege('authenticated', 'public.photo_check_events', 'select') as auth_select,
       has_table_privilege('anon', 'public.photo_check_events', 'select') as anon_select;
\echo 'BEKLENEN: ikisi de f'

\echo ''
\echo '=== 5) Fonksiyon yetkileri ==='
select p.proname,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
       has_function_privilege('anon', p.oid, 'execute') as anon
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('foto_denetim_hakki','foto_denetim_kaydet','admin_foto_denetim_ozeti')
 order by p.proname;
\echo 'BEKLENEN: yalnızca admin_foto_denetim_ozeti authenticated = t; anon her yerde f'

\echo ''
\echo '=== 6) Eski çağrılar sınırı doldurmuyor ==='
-- Sınır "son bir saat". Bir saatten eski satırlar düşmeli, yoksa hesap
-- ömür boyu tek bir kotaya sıkışırdı.
update photo_check_events set created_at = now() - interval '2 hours' where user_id = :'u';
select foto_denetim_hakki(:'u', 5) as hak_geri_geldi;
\echo 'BEKLENEN: hak_geri_geldi = t'

\echo ''
\echo '=== 7) Özet yönetici olmayana kapalı ==='
set session role authenticated;
select set_config('test.uid', :'u', false);
do $$
begin
  perform admin_foto_denetim_ozeti(7);
  raise notice 'SONUÇ: HATA — yönetici olmayan özeti okudu';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
reset role;
\echo 'BEKLENEN: engellendi'
