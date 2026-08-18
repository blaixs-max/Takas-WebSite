/**
 * Kondisyon katsayıları yaklaşık %8 düşürüldü.
 *
 * Karar kullanıcının (2026-08-18): puan ölçeği (`puan_per_try = 1`, yani
 * 1 TL = 1 puan) **aynı kalıyor**, yalnızca kondisyon katsayıları iniyor.
 * Somut hedef: 7600 puanlık ilan 7000 seviyesine gelsin.
 *
 * | Kondisyon      | Eski | Yeni |
 * |----------------|------|------|
 * | Yeni gibi      | 0.80 | 0.74 |
 * | Az kullanılmış | 0.70 | 0.65 |
 * | İyi durumda    | 0.62 | 0.57 |
 * | Hasarlı        | 0.45 | 0.41 |
 *
 * Hepsine aynı çarpan (≈0.92) uygulandı, sonra ikinci basamağa yuvarlandı.
 * Merdivenin **aralıkları korundu**: tek tek seçilmiş sayılar olsaydı
 * kondisyonlar arası fark keyfîleşir ve "az kullanılmış" ile "iyi durumda"
 * arasındaki mesafe bir turda daralıp öbüründe açılırdı.
 *
 * `hasar_indirimi` (0.15) DEĞİŞMEDİ: o bir katsayı değil, katsayının üstüne
 * binen ayrı bir kesinti. Onu da düşürmek indirimi iki kez uygulamak olurdu.
 *
 * ## Neden ölçek değil katsayı
 *
 * Masada üç seçenek vardı: oranı düşürmek (`puan_per_try`), kampanya puanını
 * yükseltmek, ya da dokunmamak. Kullanıcı üçüncüsünü seçti — ama katsayılarda
 * küçük bir düzeltmeyle.
 *
 * Ayrımın önemi şu: `puan_per_try` bütün sayıları ondalık basamak kaydırır
 * gibi değiştirirdi (7600 → 760) ve sistemin dengesine dokunmazdı.
 * Katsayıyı düşürmek ise **ikinci elin sıfıra göre değerini** düşürüyor,
 * yani gerçek bir fiyatlandırma kararı: "yeni gibi" bir ürün artık sıfırının
 * %80'i değil %74'ü ediyor.
 *
 * ## Mevcut ilanlar yeniden hesaplanıyor — ama hepsi değil
 *
 * Yalnızca `DRAFT` ve `ACTIVE`. Gerekçe:
 *
 *   · `SOLD` — o puan **gerçekten ödendi**. Geriye dönük değiştirmek, kapanmış
 *     bir takasın bedelini sonradan yazmak olur; cüzdan defteri o rakamı
 *     taşıyor ve ikisi ayrışır.
 *   · `RESERVED` — alıcının puanı şu anda havuzda kilitli. İlanın fiyatını
 *     altından çekmek, ödediğiyle ilan arasında fark açar.
 *
 * `sifir_fiyat` boş olanlara da dokunulmuyor: onların puanı bu formülden
 * gelmiyor (eski değerlemeler ve test verisi), taban fiyat olmadan yeniden
 * hesaplanamaz.
 */

update public.valuation_settings
   set oran_yeni_gibi      = 0.74,
       oran_az_kullanilmis = 0.65,
       oran_iyi_durumda    = 0.57,
       oran_hasarli        = 0.41,
       guncellendi         = now()
 where id = 1;

/**
 * Yeniden hesaplama.
 *
 * Oran `puan_orani()` üzerinden alınıyor, elle yazılmıyor: hasar beyanı ve
 * hasar şiddeti mantığı orada ve burada ikinci bir kopyasını tutmak, ilk
 * değişiklikte ikisinin ayrışması demek olurdu.
 *
 * Yuvarlama `degerleme_yaz` ile birebir aynı (`/10` → `*10`); farklı olsaydı
 * yeniden hesaplanan ilan ile yeni değerlenen ilan aynı girdide farklı puan
 * verirdi.
 *
 * Taban puan (50) burada da uygulanıyor — kelepçesiz bırakmak, katsayı
 * düşüşünün ucuz ürünleri tabanın altına itmesine izin vermek olurdu.
 */
do $$
declare
  taban integer;
  n     integer := 0;
begin
  select taban_puan into taban from public.valuation_settings where id = 1;

  perform set_config('kt.bypass_product_guard', 'on', true);

  with hesap as (
    select p.id,
           greatest(
             coalesce(taban, 0),
             (round((p.sifir_fiyat::numeric
                     * public.puan_orani(p.condition, p.has_damage, null)
                     * (select puan_per_try from public.valuation_settings where id = 1)
                    ) / 10) * 10)::integer
           ) as yeni
      from public.products p
     where p.sifir_fiyat is not null
       and p.sifir_fiyat::numeric > 0
       and p.status in ('DRAFT', 'ACTIVE')
  )
  update public.products p
     set points              = h.yeni,
         ai_suggested_points = h.yeni
    from hesap h
   where p.id = h.id and p.points is distinct from h.yeni;

  get diagnostics n = row_count;
  perform set_config('kt.bypass_product_guard', 'off', true);

  raise notice 'kondisyon katsayıları: % ilanın puanı yeniden hesaplandı', n;
end $$;
