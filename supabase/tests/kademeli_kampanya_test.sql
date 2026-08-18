-- ELDENELE — Kademeli kampanya (ilk 50: 1000+1000, kalanlar: 300+300)
--
-- Tamamı `bekle`/`bekle_esit` ile: iddia tutmazsa test düşer.
--
-- Kritik iddia **3**: kademe kullanıcıya kilitleniyor, ana değil. Erken
-- kademeden ilk hakkını almış biri, kontenjan dolduktan SONRA ikinci hakkını
-- alsa bile yine erken kademeden almalı. Bu bozulursa kullanıcıya "ilk
-- 50'desin" denir, sonra ikinci hakta sessizce kademe düşürülür.

\set a 'ee66ee66-0000-0000-0000-000000010001'
\set b 'ee66ee66-0000-0000-0000-000000010002'
\set c 'ee66ee66-0000-0000-0000-000000010003'

\echo ''
\echo '=== Hazırlık: kademe sınırı MEVCUT sayıya göre kuruluyor ==='
-- Elli kullanıcı üretmek yerine sınırı küçültüyoruz: test edilen şey sayı
-- değil, kademenin ANAHTARLANMA mantığı.
--
-- Sınır sabit yazılamaz. Testler tek veri tabanını paylaşıyor ve alfabetik
-- koşuyor; `campaign_test.sql` bizden önce hak dağıtıyor, yani sayaç sıfırdan
-- başlamıyor. İlk denemede sınır sabit `2` yazılmıştı ve ilk iddia düştü:
-- birinci kullanıcı 1000 yerine 300 aldı, çünkü kontenjan zaten doluydu.
--
-- Depo bu dersi daha önce de aldı ("vitrinde 1, taslak 2" iddiası 6 çıkmıştı):
-- **bir testin iddiası kendi kurduğu duruma bağlı olmalı**, global sayıma
-- değil. Sınır şimdi "mevcut + 2" — sonraki iki kullanıcı erken, üçüncü değil.
select (select count(distinct user_id)::integer from campaign_grants) as mevcut \gset
update campaign_settings
   set erken_kullanici_sayisi = :mevcut + 2,
       max_users              = :mevcut + 20,
       active                 = true
 where id;

insert into auth.users (id, email, phone, phone_confirmed_at)
values (:'a', 'kmp-a@example.com', '+905559100001', now()),
       (:'b', 'kmp-b@example.com', '+905559100002', now()),
       (:'c', 'kmp-c@example.com', '+905559100003', now())
on conflict (id) do nothing;

\echo ''
\echo '=== 1) İLK KULLANICILAR YÜKSEK KADEMEDEN ALIR ==='
select bekle('1. kullanıcı hak aldı', grant_campaign_points(:'a', 'FIRST_LISTING'));
select bekle_esit('1. kullanıcı 1000 puan',
                  (select points from campaign_grants
                    where user_id = :'a' and kind = 'FIRST_LISTING'), 1000);
select bekle('erken işareti kondu',
             (select erken from campaign_grants
               where user_id = :'a' and kind = 'FIRST_LISTING'));

select bekle('2. kullanıcı hak aldı', grant_campaign_points(:'b', 'FIRST_LISTING'));
select bekle_esit('2. kullanıcı da 1000 puan',
                  (select points from campaign_grants
                    where user_id = :'b' and kind = 'FIRST_LISTING'), 1000);

\echo ''
\echo '=== 2) KONTENJAN DOLUNCA NORMAL KADEMEYE DÜŞER ==='
-- Sınır 2 idi; üçüncü kullanıcı artık erken değil.
select bekle('3. kullanıcı hak aldı', grant_campaign_points(:'c', 'FIRST_LISTING'));
select bekle_esit('3. kullanıcı 300 puan',
                  (select points from campaign_grants
                    where user_id = :'c' and kind = 'FIRST_LISTING'), 300);
select bekle('erken işareti konmadı',
             (select not erken from campaign_grants
               where user_id = :'c' and kind = 'FIRST_LISTING'));

\echo ''
\echo '=== 3) KADEME KULLANICIYA KİLİTLİ — ikinci hak düşmüyor ==='
-- Bu dosyanın varlık sebebi. 1. kullanıcı ilk hakkını erken kademedeyken
-- aldı; ikinci hakkını kontenjan dolduktan SONRA alıyor ve yine 1000 almalı.
-- O anki sayıya bakılsaydı 300 alırdı ve bu bir sözden dönme olurdu.
select bekle('1. kullanıcı ikinci hakkını aldı',
             grant_campaign_points(:'a', 'FIRST_SALE'));
select bekle_esit('İKİNCİ HAK DA 1000 — kademe kullanıcıya kilitli',
                  (select points from campaign_grants
                    where user_id = :'a' and kind = 'FIRST_SALE'), 1000);
select bekle('erken işareti ikinci hakta da duruyor',
             (select erken from campaign_grants
               where user_id = :'a' and kind = 'FIRST_SALE'));

\echo ''
\echo '=== 3b) Ters yön: normal kademedeki ikinci hakta yükselmiyor ==='
select bekle('3. kullanıcı ikinci hakkını aldı',
             grant_campaign_points(:'c', 'FIRST_SALE'));
select bekle_esit('normal kademe ikinci hakta da 300',
                  (select points from campaign_grants
                    where user_id = :'c' and kind = 'FIRST_SALE'), 300);

\echo ''
\echo '=== 4) Cüzdana gerçekten yazıldı ==='
-- Hak kaydı ile defter ayrışmamalı: satır 1000 derken cüzdan 300 gösterirse
-- kullanıcı puanını göremez ve hangisinin doğru olduğu belirsiz kalır.
select bekle_esit('1. kullanıcının bakiyesi 2000',
                  (select available_points from wallets where user_id = :'a'), 2000);
select bekle_esit('3. kullanıcının bakiyesi 600',
                  (select available_points from wallets where user_id = :'c'), 600);

\echo ''
\echo '=== 5) Suistimal kontrolleri bozulmadı ==='
-- Kademe eklenirken sırası ya da koşulları bozulmuş olabilirdi.
select bekle('aynı hak ikinci kez verilmiyor',
             not grant_campaign_points(:'a', 'FIRST_LISTING'));

\set d 'ee66ee66-0000-0000-0000-000000010004'
insert into auth.users (id, email, phone, phone_confirmed_at)
values (:'d', 'kmp-d@example.com', '+905559100001', now())   -- A ile AYNI telefon
on conflict (id) do nothing;
select bekle('aynı telefonla ikinci hesap hak alamıyor',
             not grant_campaign_points(:'d', 'FIRST_LISTING'));

\set e 'ee66ee66-0000-0000-0000-000000010005'
insert into auth.users (id, email, phone) values (:'e', 'kmp-e@example.com', '+905559100005')
on conflict (id) do nothing;   -- phone_confirmed_at YOK
select bekle('telefonu doğrulanmamış kullanıcı hak alamıyor',
             not grant_campaign_points(:'e', 'FIRST_LISTING'));

\echo ''
\echo '=== 6) Kademe kaydı geriye dönük değiştirilemez ==='
-- campaign_grants değiştirilemez bir tablo; kademe de o korumanın içinde.
do $$
begin
  update public.campaign_grants set erken = false
   where user_id = 'ee66ee66-0000-0000-0000-000000010001' and kind = 'FIRST_SALE';
  raise notice 'SONUÇ: HATA — kademe geriye dönük değiştirildi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
select bekle('kademe hâlâ erken',
             (select erken from campaign_grants
               where user_id = :'a' and kind = 'FIRST_SALE'));
