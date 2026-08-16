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
