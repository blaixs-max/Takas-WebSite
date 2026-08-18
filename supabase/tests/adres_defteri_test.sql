-- ELDENELE — Adres defteri
--
-- Tamamı `bekle`/`bekle_esit` ile: iddia tutmazsa test düşer.
--
-- Kritik iddialar: 5 (BAŞKASININ ADRESİ GÖRÜLEMEZ) ve 6 (yabancı adres
-- güncelleyemez). Geri kalanı varsayılan işaretinin tutarlılığı — tek başına
-- güvenlik değil ama bozulduğunda ödeme formu sessizce boş açılıyor.

\set a 'bb22bb22-0000-0000-0000-00000000d001'
\set b 'bb22bb22-0000-0000-0000-00000000d002'

\echo ''
\echo '=== Hazırlık ==='
insert into auth.users (id, email, phone, phone_confirmed_at)
values (:'a', 'adresa@example.com', '+905558900001', now()),
       (:'b', 'adresb@example.com', '+905558900002', now())
on conflict (id) do nothing;

set session role authenticated;
select set_config('test.uid', :'a', false);

\echo ''
\echo '=== 1) İlk adres kendiliğinden varsayılan olur ==='
-- Olmasaydı tek adresi olan kullanıcının ödeme formu boş açılırdı ve
-- "varsayılan seç" diye bir adım öğrenmesi gerekirdi.
insert into addresses (user_id, baslik, ad_soyad, il, ilce, acik_adres)
values (:'a', 'Ev', 'Deniz Arı', 'İstanbul', 'Kadıköy', 'Caferağa Mah. 1. Sok. No:3 D:5');
select bekle('ilk adres varsayılan',
             (select varsayilan from addresses where user_id = :'a' and baslik = 'Ev'));

\echo ''
\echo '=== 2) İkinci adres varsayılan OLMAZ ==='
insert into addresses (user_id, baslik, ad_soyad, il, ilce, acik_adres)
values (:'a', 'Ofis', 'Deniz Arı', 'İstanbul', 'Şişli', 'Mecidiyeköy Mah. 5. Cad. No:11');
select bekle_esit('yalnızca bir varsayılan var',
                  (select count(*) from addresses where user_id = :'a' and varsayilan), 1::bigint);
select bekle('varsayılan hâlâ Ev',
             (select varsayilan from addresses where user_id = :'a' and baslik = 'Ev'));

\echo ''
\echo '=== 3) Varsayılan devredilince eskisi bırakılır ==='
-- Kısmi indeks bunu zaten dayatıyor ama tek başına HATA üretirdi; kullanıcının
-- gördüğü şey "kaydedilemedi" olurdu. Trigger eskisini bırakıyor.
update addresses set varsayilan = true where user_id = :'a' and baslik = 'Ofis';
select bekle_esit('hâlâ tek varsayılan',
                  (select count(*) from addresses where user_id = :'a' and varsayilan), 1::bigint);
select bekle_esit('varsayılan Ofis oldu',
                  (select baslik from addresses where user_id = :'a' and varsayilan), 'Ofis');

\echo ''
\echo '=== 4) Varsayılan silinince başkası devralır ==='
-- Yoksa defterde adres kalır ama hiçbiri varsayılan olmaz; ödeme formu boş
-- açılır ve kullanıcı sebebini anlamaz.
delete from addresses where user_id = :'a' and baslik = 'Ofis';
select bekle_esit('kalan adres varsayılan oldu',
                  (select baslik from addresses where user_id = :'a' and varsayilan), 'Ev');

\echo ''
\echo '=== 5) BAŞKASININ ADRESİ GÖRÜLEMEZ ==='
-- Bu dosyanın varlık sebebi. Adres, ilan başlığı gibi açık bir veri değil.
select set_config('test.uid', :'b', false);
insert into addresses (user_id, baslik, ad_soyad, il, ilce, acik_adres)
values (:'b', 'Ev', 'Yabancı Kişi', 'Ankara', 'Çankaya', 'Kızılay Mah. 9. Sok. No:2');
select bekle_esit('yabancı yalnızca kendi adresini görüyor',
                  (select count(*) from addresses), 1::bigint);
select bekle_esit('gördüğü adres kendisinin',
                  (select ad_soyad from addresses), 'Yabancı Kişi');

\echo ''
\echo '=== 6) Yabancı, başkasının adresini güncelleyemez ==='
-- RLS `using` kaydı hiç görmediği için update sıfır satır etkiler; hata değil
-- ama değişiklik de olmaz. Sessiz başarısızlık burada doğru davranış:
-- "böyle bir adres yok" ile "bu adres senin değil" aynı cevabı vermeli.
update addresses set acik_adres = 'ele geçirildi' where user_id = :'a';
select set_config('test.uid', :'a', false);
select bekle('adres değişmedi',
             (select acik_adres from addresses where user_id = :'a')
               like 'Caferağa%');

\echo ''
\echo '=== 7) Kimlik numarası kolonu YOK ==='
-- Kolon eklenmediği sürece sızdırılamaz. Bu iddia bir davranışı değil, bir
-- kararı koruyor: ileride biri "fatura için lazım" diye ekleyecek olursa
-- test düşsün ve karar yeniden konuşulsun.
select bekle('tckn/kimlik kolonu yok',
             not exists (select 1 from information_schema.columns
                          where table_name = 'addresses'
                            and column_name ~ '(tckn|kimlik|identity)'));

\echo ''
\echo '=== 8) Boş alanlar reddediliyor ==='
select set_config('test.pid', :'a', false);
do $$
declare uid uuid := current_setting('test.pid')::uuid;
begin
  insert into addresses (user_id, baslik, ad_soyad, il, ilce, acik_adres)
  values (uid, '   ', 'Deniz Arı', 'İstanbul', 'Kadıköy', 'Bir yer');
  raise notice 'SONUÇ: HATA — boş başlıkla adres yazıldı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
select bekle_esit('boş başlıklı adres yazılmadı',
                  (select count(*) from addresses where user_id = :'a'), 1::bigint);
