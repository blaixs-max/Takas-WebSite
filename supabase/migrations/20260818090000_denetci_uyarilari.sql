/**
 * Supabase denetçisinin iki uyarısı kapatılıyor.
 *
 * Bugünün üç göçü canlıya uygulandıktan sonra `get_advisors` çalıştırıldı;
 * yeni bir sorun çıkmadı ama **dünden kalan** ikisi görüldü. İkisi de küçük ve
 * ikisi de aynı sebeple duruyor: yeni bir nesne eklerken denetçiye
 * bakılmamıştı.
 *
 * ## 1) `yayinlanabilir_ad` — değişken search_path
 *
 * Fonksiyon `security definer` DEĞİL, yani bu bir yetki yükseltme yolu değil:
 * çağıran zaten kendi yetkisiyle koşuyor. Yine de `set search_path` yazmak
 * doğru, çünkü fonksiyon `create_listing` (o `security definer`) içinden
 * çağrılıyor ve orada davranışının şemaya göre değişmesi istenmez.
 *
 * `immutable` kalıyor: `set search_path` bir fonksiyonu değişken yapmıyor,
 * yalnızca çalışma ortamını sabitliyor.
 *
 * ## 2) `product_photos_karar_sonrasi` — anon'a açık
 *
 * Bir **tetikleyici fonksiyonu** ve `security definer`. Supabase yeni
 * fonksiyonlara varsayılan olarak `public`e EXECUTE veriyor; bu da onu
 * `/rest/v1/rpc/...` üzerinden çağrılabilir kılıyor.
 *
 * Doğrudan çağrı zaten çöküyor — tetikleyici bağlamı olmadan `new`/`old` yok.
 * Ama "çöküyor" ile "çağrılamıyor" aynı şey değil, ve bu depo aynı kararı
 * daha önce de verdi: yetki matrisi RLS'in yedeği değil, ikinci kilidi.
 *
 * **Tetikleyici bunun etkilenmiyor.** PostgreSQL EXECUTE yetkisini
 * `create trigger` anında denetliyor, tetikleyici ateşlenirken değil. Yerelde
 * doğrulandı: yetki geri alındıktan sonra da otomatik yayın çalışıyor
 * (`otomatik_yayin_test.sql` geçiyor).
 */

create or replace function public.yayinlanabilir_ad(p_ad text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select case
    when p_ad is null or btrim(p_ad) = '' then 'Üye'
    -- Boşluk içeriyorsa gerçek ad kabul ediliyor: "Zeynep Demir".
    when btrim(p_ad) like '% %' then btrim(p_ad)
    -- Tek kelimeyse: büyük harfle başlayan saf harf dizisi olmalı ("Ayşe").
    when btrim(p_ad) ~ '^[[:upper:]][[:alpha:]]*$' and length(btrim(p_ad)) <= 20
      then btrim(p_ad)
    else 'Üye'
  end;
$function$;

revoke all on function public.product_photos_karar_sonrasi() from public, anon, authenticated;
