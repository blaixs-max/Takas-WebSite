/**
 * Taban puan uygulandığında kullanıcı bunu bilsin.
 *
 * `taban_puan` 50 ve bir **kelepçe**, kapı değil: hesaplanan puan 50'nin
 * altında kalırsa `puan_hesapla` sessizce 50'ye yükseltiyor. Kimseyi
 * durdurmuyor, ama kimse de olup biteni görmüyordu — 25 TL'lik bir oyuncak
 * 16 puan hak ederken 50 puanla listeleniyor ve satıcı bunu hiçbir yerde
 * okumuyordu.
 *
 * İki tarafı da ilgilendiriyor:
 *
 *   - **Satıcı** ilanının neden "50 puan" dediğini bilmeli. Rakam aksi hâlde
 *     keyfî görünür ve değerlemeye güven aşınır.
 *   - **Biz** kimin sürüyle taban-altı ürün girdiğini görebilmeliyiz. Tavan
 *     kaldırıldıktan sonra taban, puanın yoktan var olduğu **tek** yer:
 *     10 TL'lik yirmi ürün 200 TL karşılığında 1000 puan üretir.
 *
 * ## Neden kolon, neden anlık hesap değil
 *
 * "Puan 50'ye eşitse taban uygulanmıştır" diye çıkarım yapılabilirdi ama
 * yanlış olurdu: 80 TL'lik bir ürün de tam 50 puan ediyor ve orada taban
 * uygulanmıyor. İkisini ayırmanın tek yolu ham değeri hesaplandığı anda
 * bilmek. Ayrıca oranlar veya taban ileride değişirse geçmiş ilanların
 * kaydı bugünkü ayarla yeniden yorumlanmamalı — o an ne olduğu yazılı kalsın.
 */

alter table public.products
  add column if not exists taban_uygulandi boolean not null default false;

comment on column public.products.taban_uygulandi is
  'Değerleme anında hesaplanan puan taban_puan''ın altında kalıp yükseltildi '
  'mi. Puanın 50 olmasından çıkarılamaz: 80 TL''lik ürün de 50 puan eder ama '
  'orada taban uygulanmaz.';

/**
 * Değerlemeyi yazar; taban devreye girdiyse işaretler.
 *
 * Ham puan `puan_hesapla`'nın kelepçesiz karşılığı. Formülü burada ikinci kez
 * yazmak yerine kelepçenin **etkisini** ölçüyoruz: aynı girdiyle hesaplanan
 * puan tabana eşitse ve ham değer tabanın altındaysa yükseltme olmuştur.
 * Formülün tek kopyası `puan_hesapla`'da kalıyor — iki kopya ilk oran
 * değişikliğinde ayrışırdı.
 */
/* Varsayılanlar mevcut imzayla birebir aynı olmak zorunda: `create or
   replace` varsayılan kaldırmayı reddediyor ve `drop` etmek çağıranları
   kırardı. Kopyalanan değerler: kaynak/güven/model null, hasar şiddeti 1.0. */
create or replace function public.degerleme_yaz(
  p_product_id   text,
  p_sifir_fiyat  numeric,
  p_kaynak       text default null,
  p_guven        numeric default null,
  p_model        text default null,
  p_hasar_siddeti numeric default 1.0
)
returns products
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  p          public.products;
  yeni_puan  integer;
  taban      integer;
  ham        numeric;
  yukseltildi boolean;
begin
  select * into p from public.products where id = p_product_id for update;
  if not found then raise exception 'ilan % bulunamadı', p_product_id; end if;

  yeni_puan := public.puan_hesapla(p_sifir_fiyat, p.condition, p.has_damage, p_hasar_siddeti);

  select vs.taban_puan into taban from public.valuation_settings vs where vs.id = 1;

  /* Ham değer: kelepçeden önceki, yuvarlanmış puan. `puan_hesapla` içindeki
     oran seçimini burada tekrarlamıyoruz — sonucu tersine çeviriyoruz.
     `yeni_puan` tabana eşitse ve oraya yükselterek geldiyse işaret konur. */
  ham := round((p_sifir_fiyat * public.puan_orani(p.condition, p.has_damage, p_hasar_siddeti)
                * (select puan_per_try from public.valuation_settings where id = 1)) / 10) * 10;
  yukseltildi := p_sifir_fiyat is not null and p_sifir_fiyat > 0
                 and taban is not null and ham < taban;

  perform set_config('kt.bypass_product_guard', 'on', true);

  update public.products
     set sifir_fiyat        = p_sifir_fiyat,
         points             = yeni_puan,
         ai_suggested_points = yeni_puan,
         market_value       = case when p_sifir_fiyat is null then null
                                   else round(p_sifir_fiyat)::text end,
         degerleme_kaynak   = p_kaynak,
         degerleme_guven    = p_guven,
         degerleme_model    = p_model,
         degerleme_at       = now(),
         taban_uygulandi    = coalesce(yukseltildi, false)
   where id = p_product_id
  returning * into p;

  perform set_config('kt.bypass_product_guard', 'off', true);

  return p;
end; $function$;

/**
 * Kondisyon ve hasara göre ikinci el oranı.
 *
 * `puan_hesapla` içindeki oran seçimi buraya çıkarıldı: `degerleme_yaz` ham
 * değeri hesaplayabilmek için aynı orana ihtiyaç duyuyor ve mantığı ikinci
 * kez yazmak, ilk oran değişikliğinde ikisinin ayrışması demekti.
 */
create or replace function public.puan_orani(
  p_condition text,
  p_has_damage boolean default false,
  p_hasar_siddeti numeric default null
)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare a public.valuation_settings; oran numeric; siddet numeric;
begin
  select * into a from public.valuation_settings where id = 1;
  siddet := greatest(0, least(1, coalesce(p_hasar_siddeti, 1)));

  if p_condition = 'Hasarlı' then
    return a.oran_iyi_durumda - (a.oran_iyi_durumda - a.oran_hasarli) * siddet;
  end if;

  oran := case p_condition
            when 'Yeni gibi'      then a.oran_yeni_gibi
            when 'Az kullanılmış' then a.oran_az_kullanilmis
            when 'İyi durumda'    then a.oran_iyi_durumda
            else a.oran_iyi_durumda
          end;
  if p_has_damage then
    oran := oran * (1 - a.hasar_indirimi * siddet);
  end if;
  return oran;
end; $function$;

revoke all on function public.puan_orani(text, boolean, numeric) from public, anon, authenticated;

/**
 * `puan_hesapla` artık oranı ortak fonksiyondan alıyor.
 *
 * Davranışı değişmiyor — aynı oranlar, aynı kelepçe, aynı yuvarlama. Değişen
 * tek şey oran seçiminin tek yerde durması.
 */
/* Varsayılanlar mevcut imzayla aynı — `degerleme_yaz`daki ile aynı gerekçe. */
create or replace function public.puan_hesapla(
  p_sifir_fiyat numeric,
  p_condition text,
  p_has_damage boolean default false,
  p_hasar_siddeti numeric default 1.0
)
returns integer
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare a public.valuation_settings; ikinci_el numeric; puan numeric;
begin
  if p_sifir_fiyat is null or p_sifir_fiyat <= 0 then
    return null;
  end if;

  select * into a from public.valuation_settings where id = 1;
  ikinci_el := p_sifir_fiyat * public.puan_orani(p_condition, p_has_damage, p_hasar_siddeti);
  puan := ikinci_el * a.puan_per_try;

  return greatest(a.taban_puan, round(puan / 10) * 10)::integer;
end; $function$;

revoke all on function public.puan_hesapla(numeric, text, boolean, numeric)
  from public, anon, authenticated;
