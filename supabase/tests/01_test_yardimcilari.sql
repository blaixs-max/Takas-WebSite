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
