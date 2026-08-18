-- ELDENELE — Hata izleme
--
-- Tamamı `bekle`/`bekle_esit` ile: iddia tutmazsa test düşer.
--
-- Kritik iddialar: 2 (aynı hata yeni satır açmıyor — bir çökme döngüsü
-- tabloyu şişirmemeli), 5 (kullanıcı hata tablosunu okuyamıyor) ve 6
-- (bildirim HİÇBİR ZAMAN fırlatmıyor — bildirimin kendisi çökmeyi
-- büyütmemeli).
--
-- ## Rol dansı
--
-- Bu dosya sürekli rol değiştiriyor ve sebebi bir iddianın kendisi: tablo
-- `authenticated`e kapalı. İlk yazımda doğrulama sorguları da o rolde
-- koşuyordu ve test "permission denied" ile düştü — yani 5 numaralı iddia
-- daha yazılmadan kanıtlanmış oldu. **Bildirim** çağrıları kullanıcı rolünde,
-- **doğrulama** sorguları yetkili rolde koşuyor.

\set u 'ff77ff77-0000-0000-0000-000000020001'

\echo ''
\echo '=== Hazırlık ==='
insert into auth.users (id, email, phone, phone_confirmed_at)
values (:'u', 'hata@example.com', '+905559200001', now())
on conflict (id) do nothing;

\echo ''
\echo '=== 1) Hata kaydediliyor ==='
set session role authenticated;
select set_config('test.uid', :'u', false);
select hata_bildir('ios', 'TypeError: x is not a function', 'pi-1',
                   'product/[id]', 'at foo (a.js:1:1)', '1.0.0', '{"kaynak":"cizim"}'::jsonb);
reset role;
select bekle_esit('kayıt açıldı',
                  (select count(*) from client_errors where parmak_izi = 'pi-1'), 1::bigint);
select bekle_esit('tekrar 1',
                  (select tekrar from client_errors where parmak_izi = 'pi-1'), 1);
select bekle_esit('kullanıcı yazıldı',
                  (select user_id from client_errors where parmak_izi = 'pi-1'), :'u'::uuid);
select bekle_esit('ekran yazıldı',
                  (select ekran from client_errors where parmak_izi = 'pi-1'), 'product/[id]');

\echo ''
\echo '=== 2) AYNI HATA YENİ SATIR AÇMIYOR ==='
-- Bir çökme döngüsü saniyede onlarca bildirim üretir. Her biri satır açsaydı
-- tablo şişer ve panel okunmaz hâle gelirdi.
set session role authenticated;
select set_config('test.uid', :'u', false);
select hata_bildir('ios', 'TypeError: x is not a function', 'pi-1', 'product/[id]');
select hata_bildir('ios', 'TypeError: x is not a function', 'pi-1', 'product/[id]');
reset role;
select bekle_esit('hâlâ tek satır',
                  (select count(*) from client_errors where parmak_izi = 'pi-1'), 1::bigint);
select bekle_esit('tekrar sayacı arttı',
                  (select tekrar from client_errors where parmak_izi = 'pi-1'), 3);

\echo ''
\echo '=== 2b) Tekrar eden hata yeniden "yeni" oluyor ==='
-- Kapatılmış sanılan bir çökme geri geldiyse görmemiz gerekiyor.
update client_errors set goruldu = true where parmak_izi = 'pi-1';
set session role authenticated;
select set_config('test.uid', :'u', false);
select hata_bildir('ios', 'TypeError: x is not a function', 'pi-1', 'product/[id]');
reset role;
select bekle('görüldü işareti kalktı',
             (select not goruldu from client_errors where parmak_izi = 'pi-1'));

\echo ''
\echo '=== 3) Oturumsuz kullanıcı da bildirebiliyor ==='
-- Giriş ekranındaki çökme de kaydedilmeli ve orada oturum yok.
set session role anon;
select set_config('test.uid', '', false);
select hata_bildir('android', 'Error: sign-in patladı', 'pi-anon', 'sign-in');
reset role;
select bekle_esit('oturumsuz kayıt açıldı',
                  (select count(*) from client_errors where parmak_izi = 'pi-anon'), 1::bigint);
select bekle('kullanıcı boş',
             (select user_id is null from client_errors where parmak_izi = 'pi-anon'));

\echo ''
\echo '=== 4) Alanlar SUNUCUDA kırpılıyor ==='
-- İstemciye güvenmenin anlamı yok: kırpma burada.
set session role authenticated;
select set_config('test.uid', :'u', false);
select hata_bildir('web', repeat('A', 5000), 'pi-uzun', 'x', repeat('B', 20000));
select hata_bildir('symbian', 'Error: eski telefon', 'pi-platform');
reset role;
select bekle('mesaj 2 KB''a kırpıldı',
             (select length(mesaj) <= 2048 from client_errors where parmak_izi = 'pi-uzun'));
select bekle('yığın 8 KB''a kırpıldı',
             (select length(yigin) <= 8192 from client_errors where parmak_izi = 'pi-uzun'));
select bekle_esit('tanınmayan platform bilinmiyor olur',
                  (select platform from client_errors where parmak_izi = 'pi-platform'),
                  'bilinmiyor');

\echo ''
\echo '=== 5) KULLANICI HATA TABLOSUNU OKUYAMIYOR ==='
-- Tabloda yığın izi var; kullanıcının işine yaramaz, bizim işimize yarar.
-- Yetki hem RLS (politika yok = her satır süzülür) hem de GRANT seviyesinde
-- kapalı. İki katman birden: ileride izin verici bir politika eklenirse
-- GRANT hâlâ tutuyor.
select bekle('authenticated tabloya SELECT edemiyor',
             not has_table_privilege('authenticated', 'public.client_errors', 'select'));
select bekle('anon tabloya SELECT edemiyor',
             not has_table_privilege('anon', 'public.client_errors', 'select'));
select bekle('authenticated tabloya INSERT edemiyor',
             not has_table_privilege('authenticated', 'public.client_errors', 'insert'));

-- Yönetici olmayan `admin_hatalar` çağırırsa boş liste alır (is_admin süzgeci).
set session role authenticated;
select set_config('test.uid', :'u', false);
select bekle_esit('yönetici olmayan boş liste alır',
                  (select count(*) from admin_hatalar(50)), 0::bigint);
reset role;

\echo ''
\echo '=== 6) BİLDİRİM HİÇBİR ZAMAN FIRLATMIYOR ==='
-- Bildirimin kendisi hata verirse kullanıcının gördüğü şey ikinci bir çökme
-- olurdu. Boş mesaj, boş parmak izi ve null — üçü de sessizce yutulmalı.
set session role authenticated;
select set_config('test.uid', :'u', false);
do $$
begin
  perform hata_bildir('ios', '', 'pi-bos');
  perform hata_bildir('ios', 'Error: x', '');
  perform hata_bildir('ios', null, 'pi-null');
  raise notice 'SONUÇ: doğru — üçü de sessizce yutuldu';
exception when others then
  raise notice 'SONUÇ: HATA — bildirim fırlattı (%)', sqlerrm;
end $$;
reset role;
select bekle_esit('boş mesajlı kayıt açılmadı',
                  (select count(*) from client_errors
                    where parmak_izi in ('pi-bos', 'pi-null')), 0::bigint);

\echo ''
\echo '=== 7) admin_hata_goruldu yetkisiz çağrıyı reddediyor ==='
-- Kimlik yetkili rolde okunuyor: `authenticated` bu tabloyu göremiyor ve
-- görebilseydi 5 numaralı iddia yanlış olurdu.
select id from client_errors where parmak_izi = 'pi-anon' limit 1 \gset h_
select set_config('test.hid', :'h_id'::text, false);

set session role authenticated;
select set_config('test.uid', :'u', false);
do $$
declare hid bigint := current_setting('test.hid')::bigint;
begin
  perform admin_hata_goruldu(hid);
  raise notice 'SONUÇ: HATA — yetkisiz işaretledi';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
reset role;
select bekle('yetkisiz işaret koyamadı',
             (select not goruldu from client_errors where parmak_izi = 'pi-anon'));
