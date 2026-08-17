/**
 * Puan tavanı kaldırıldı — ürün sınırı yok.
 *
 * Canlıda çıktı (2026-08-17). Test kullanıcısı ~9500 TL'lik bir bebek dinleme
 * telsizi girdi; dört karesi onaylandı, değerleme 7600 puan hesapladı ve ilan
 * yayına **girmedi**: `tavan_puan` 5000'di.
 *
 * Üç ilan aynı duvara çarptı (7600, 7600, 7260) ve kullanıcı sebebini
 * bilemedi — etiketi atladığı için hatanın etiketten geldiğini sandı.
 *
 * ## Ürün kararı
 *
 * Tavan kaldırıldı: platform her fiyat aralığındaki ürüne açık. Karar iş
 * tarafına ait ve alındı.
 *
 * ## Kaldırılan şeyin ne olduğu — kayda geçsin
 *
 * Tavan bir **ürün politikası** değildi, **değerleme hatasına karşı emniyet
 * frenıydı**. Model bir ürünü yanlış tanır ya da fiyatı yanlış okursa
 * (₺950 yerine ₺95.000) o hata doğrudan puana dönüşür; puan kapalı devrede
 * para gibi davranır ve basılmış puan geri alınamaz. Tavan bu tür bir hatayı
 * yayın kapısında durduruyordu.
 *
 * Artık durduran bir şey yok. Bu, tavanın yakaladığı hata sınıfının ortadan
 * kalktığı anlamına gelmiyor — yalnızca **görülmediği** anlamına geliyor.
 * İleride şunlardan biri gerekebilir ve gerektiğinde bu not hatırlatsın:
 *
 *   - engellemeyen bir işaret (yüksek değerlemeyi yönetim ekranında göstermek),
 *   - `degerleme_guven` düşükken insan onayı,
 *   - kullanıcı başına günlük puan üretim sınırı.
 *
 * ## Neden `null`, neden büyük bir sayı değil
 *
 * `tavan_puan = 999999` yazmak da işi görürdü ama o bir sınırdır — yalnızca
 * uzaktadır. Biri bir gün ona çarpar ve sebebini yine anlamaz. `null` "sınır
 * yok" demenin tek dürüst yolu, ve kolon artık `null` kabul ediyor.
 *
 * `p_puan is null` hâlâ bandın dışı sayılıyor: puanı olmayan ilan yayına
 * giremez. O tavanla ilgili değil, değerlemenin yapılmış olmasıyla ilgili.
 */

alter table public.valuation_settings alter column tavan_puan drop not null;

comment on column public.valuation_settings.tavan_puan is
  'Yayın için üst puan sınırı. NULL = sınır yok (2026-08-17''den beri böyle). '
  'Bir değer yazılırsa üstündeki ilanlar yayına giremez ve KUYRUĞA DA '
  'DÜŞMEZ — taslakta kalırlar. Yeniden sınır koyacaksan önce o kuyruğu kur.';

/**
 * Puan yayına uygun mu.
 *
 * `tavan_puan` null ise üst sınır yok. Null kontrolü olmadan karşılaştırma
 * null döner ve `if` yanlış sayardı — kazara doğru sonuç, ama okuyanın
 * çıkaramayacağı bir gerekçeyle. Açıkça yazılıyor.
 */
create or replace function public.puan_bandi_disinda(p_puan integer)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select p_puan is null
      or exists (
           select 1 from public.valuation_settings
            where id = 1 and tavan_puan is not null and p_puan > tavan_puan
         );
$function$;

update public.valuation_settings set tavan_puan = null, guncellendi = now() where id = 1;
