-- ============================================================================
-- Test yardımcısı: ilanı "değerlenmiş" say
-- ============================================================================
--
-- 2026-08-16'da yayın kapısına değerleme koşulu eklendi: puanı olmayan ilan
-- yayına giremiyor. Bu, değerlemeyle ilgisi olmayan on dört testi birden
-- kırdı — hepsi bir ilan açıp yayına alıyor ve konusu takas, mesajlaşma ya da
-- yaptırım.
--
-- Bu yardımcı o testlerin konusuna dönmesini sağlıyor: ilana istenen puanı
-- damgalıyor ve `degerleme_at`i dolduruyor. Gerçek formülü **atlıyor**, ve
-- atlaması doğru — formülün kendi testleri var (`degerleme_test.sql`,
-- `puan_sunucuda_test.sql`). Bir mesajlaşma testinin ayrıca değerleme
-- doğrulaması yapması, iki konuyu birbirine bağlamak olurdu.
--
-- **Yalnızca test iskelesinde.** Üretim göçlerine hiçbir zaman girmez: puanı
-- serbestçe yazabilen bir fonksiyon, puanı seçebilen bir istemci demektir.
create or replace function public.test_degerle(p_product_id text, p_puan integer default 300)
returns void
language plpgsql
as $$
begin
  perform set_config('kt.bypass_product_guard', 'on', true);
  update public.products
     set points              = p_puan,
         ai_suggested_points = p_puan,
         sifir_fiyat         = p_puan,
         degerleme_kaynak    = 'test',
         degerleme_guven     = 1.0,
         degerleme_model     = 'test',
         degerleme_at        = now()
   where id = p_product_id;
  perform set_config('kt.bypass_product_guard', 'off', true);
end; $$;

/* Yetki burada veriliyor, iskelede değil: `rpc_grants_final` göçü **bütün**
   fonksiyonlardan EXECUTE'u geri alıyor ve iskele göçlerden önce koştuğu için
   orada verilen yetki hemen siliniyordu. Bu dosya göçlerden SONRA uygulanıyor,
   yani sıra kritik ve `kosu.sh` onu koruyor. */
grant execute on function public.test_degerle(text, integer) to authenticated;

-- ============================================================================
-- Test yardımcısı: ilanı yönetici onayından geçirip yayına al
-- ============================================================================
--
-- 2026-09-08'den beri satıcı ilanı yayına alamıyor; yönetici onaylıyor
-- (`docs/plan-elle-onay-2026-09.md`). On sekiz test "ilan aç, yayına al,
-- konuya geç" desenindeydi ve hepsi `publish_listing` çağırıyordu. Bu yardımcı
-- o deseni tek satırda koruyor: taslağı incelemeye alır, iç onay gövdesini
-- (`ilan_onayla`) verilen puanla çağırır. Yönetici kimliği kurmaz — yetki
-- kontrolünün kendi testi var (`elle_onay_test.sql`).
--
-- `security definer` şart: `ilan_onayla` istemci rollerine kapalı; yardımcı
-- sahibinin (postgres) yetkisiyle çalışmalı ki `authenticated` rolündeki bir
-- testten de çağrılabilsin.
create or replace function public.test_yayinla(p_product_id text, p_puan integer default 300)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('kt.bypass_product_guard', 'on', true);
  update public.products
     set status = 'IN_REVIEW', submitted_at = now()
   where id = p_product_id and status = 'DRAFT';
  perform set_config('kt.bypass_product_guard', 'off', true);

  /* Sıfır fiyatı da puan olarak yazılıyor — `test_degerle` da öyle yapıyordu
     ve birkaç test `sifir_fiyat is not null` diye bakıyor. Elle puan verildiği
     için formül devreye girmiyor; puan tam olarak istenen sayı oluyor. */
  perform public.ilan_onayla(p_product_id, p_puan, p_puan, 'front', null);
end; $$;
grant execute on function public.test_yayinla(text, integer) to authenticated;

-- ============================================================================
-- Test yardımcısı: kullanıcıya varsayılan teslimat adresi
-- ============================================================================
--
-- 2026-09-08'den beri `create_trade` adres istiyor: satıcı ürünü bir yere
-- göndermek zorunda. On takas testi alıcıyı adres defteri olmadan kuruyordu.
-- Bu yardımcı bir varsayılan adres ekler; kullanıcı `auth.users`ta yoksa onu da
-- açar (adres tablosunun yabancı anahtarı var ve bazı testler alıcıyı başka
-- bir dosyanın açmış olmasına güveniyor).
create or replace function public.test_adres(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into auth.users (id, email) values (p_user, p_user::text || '@test.example')
  on conflict (id) do nothing;
  insert into public.addresses (user_id, baslik, ad_soyad, telefon, il, ilce, acik_adres, varsayilan)
  select p_user, 'Ev', 'Test Alıcı', '+905550000000', 'İstanbul', 'Kadıköy',
         'Test Mah. Deneme Sk. No:1', true
   where not exists (select 1 from public.addresses a where a.user_id = p_user);
end; $$;
grant execute on function public.test_adres(uuid) to authenticated;

-- ============================================================================
-- İddia yardımcıları — testler kendi kendini denetlesin
-- ============================================================================
--
-- 2026-08-17'de bu paketin kör noktası pahalıya patladı. `product_photos`
-- tetikleyicisi yanlışlıkla `security definer` yazılmıştı ve kontrol **hiç
-- çalışmıyordu**: kullanıcı kendi karesini `approved` yapabiliyordu. Paket
-- yine "24 test geçti" dedi.
--
-- Sebep: testler iddiayı `\echo 'BEKLENEN: pending'` diye yazıp sonucu ekrana
-- basıyor, ikisini **karşılaştırmıyor**. `kosu.sh` de yalnızca psql'in çıkış
-- kodunu görüyor. Yani "geçti" demek "çökmeden sonuna kadar gitti" demekti,
-- "doğru sonucu verdi" demek değil. Sınav kâğıdını okumadan, teslim edildiği
-- için geçmiş saymak.
--
-- Bu iki fonksiyon iddiayı makineye devrediyor: tutmazsa exception, exception
-- olunca `ON_ERROR_STOP=1` dosyayı düşürür ve `kosu.sh` testi başarısız sayar.

/** Koşul yanlışsa testi düşürür. */
create or replace function public.bekle(aciklama text, kosul boolean)
returns void language plpgsql as $$
begin
  /* `is not true` bilerek: `null` da düşmeli. Bir iddia "ne doğru ne yanlış"
     çıkıyorsa sorgu düşündüğün şeyi ölçmüyordur ve sessizce geçmesi, yanlış
     çıkmasından kötüdür. */
  if kosul is not true then
    raise exception 'İDDİA DÜŞTÜ: %  (sonuç: %)', aciklama, coalesce(kosul::text, 'null');
  end if;
end; $$;

/** İki değer eşit değilse testi düşürür; farkı da yazar. */
create or replace function public.bekle_esit(aciklama text, gercek anyelement, beklenen anyelement)
returns void language plpgsql as $$
begin
  if gercek is distinct from beklenen then
    raise exception 'İDDİA DÜŞTÜ: %  (beklenen: %, gerçek: %)',
      aciklama, coalesce(beklenen::text, 'null'), coalesce(gercek::text, 'null');
  end if;
end; $$;

grant execute on function public.bekle(text, boolean) to authenticated;
grant execute on function public.bekle_esit(text, anyelement, anyelement) to authenticated;
