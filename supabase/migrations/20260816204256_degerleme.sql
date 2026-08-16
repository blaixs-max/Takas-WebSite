-- Değerleme: puan artık sunucuda hesaplanıyor.
--
-- ## Bulgu (2026-08-16, canlıda)
--
-- Puanı istemci hesaplıyordu, `mobile/app/add-listing.tsx`:
--
--     const BASE = 500;                  -- sabit, kategoriden bağımsız
--     const COND_MULT = { 'İyi durumda': 0.8, ... };
--     const total = Math.round(BASE * mult) + 20;
--
-- Üç ayrı sorun:
--
--  1. **Kategoriden habersiz.** Ekranda "Kategori taban puanı" yazıyordu ama
--     her kategori için sabit 500. ₺1599'luk bir figür ile ₺15.000'lik bir
--     bebek arabası aynı tabanı alıyordu. Etiket, olmayan bir zekâyı ima
--     ediyordu.
--  2. **Gerçekle bağlantısız.** İlk canlı ilan 420 puan aldı çünkü
--     500 × 0,8 + 20 öyle çıkıyor — ürünün ne olduğuyla ilgisi yok.
--  3. **Denetimsiz.** `create_listing` puanı parametre olarak alıyordu; formu
--     hiç açmadan `points: 50000` göndermek mümkündü. Kapalı devrede bu
--     doğrudan para basmaktır ve `TODO.md` bunu açık madde olarak taşıyordu.
--
-- ## Kurulan yapı
--
-- Fiyatı **yapay zekâ** bulur (sıfır fiyatı, Google Search grounding ile),
-- puana çeviren formül **burada** kalır. Ayrımın sebebi: formül
-- deterministik, denetlenebilir ve modeli yeniden çalıştırmadan
-- değiştirilebilir olmalı. Model fiyatı söyler, ekonomiyi biz yönetiriz.
--
-- Katsayılar tabloda, kodda değil: bir oranı değiştirmek göç yazmayı
-- gerektirmemeli. Değerleme ekonominin kalbi ve ilk aylarda ayarlanacak.
--
-- ## Oran nereden geldi
--
-- Tek gerçek çapa: ilk canlı ilan. Süperman figürü, sıfırı ₺1599, sahibi
-- "iyi durumda ₺1000 eder" dedi — yani sıfırın %62'si. Merdiven buna
-- oturtuldu. **1 puan = 1 ₺ ikinci el değeri**; kullanıcı "990 puan"
-- gördüğünde "₺990'lık bir şey" diye okuyor, açıklaması kolay.

create table if not exists public.valuation_settings (
  id                smallint primary key default 1 check (id = 1),
  /* 1 ₺ ikinci el değeri kaç puan. 1.0 = birebir. */
  puan_per_try      numeric(6,3) not null default 1.0,
  /* Sıfır fiyatının yüzdesi olarak ikinci el değeri. */
  oran_yeni_gibi    numeric(4,3) not null default 0.80,
  oran_az_kullanilmis numeric(4,3) not null default 0.70,
  oran_iyi_durumda  numeric(4,3) not null default 0.62,
  /* Hasar beyanı varsa ek indirim. Modelin gördüğü şiddet ayrıca çarpılır. */
  hasar_indirimi    numeric(4,3) not null default 0.15,
  /* Güvenlik bandı: bir ilan bu puanı aşarsa otomatik onaylanmaz. */
  tavan_puan        integer not null default 5000,
  taban_puan        integer not null default 50,
  guncellendi       timestamptz not null default now()
);

insert into public.valuation_settings (id) values (1) on conflict (id) do nothing;

alter table public.valuation_settings enable row level security;
/* Ayarlar istemciye kapalı: puan formülünün girdilerini okumak, onu nasıl
   oynayacağını okumaktır. Yönetici sarmalayıcıdan görür. */
revoke all on table public.valuation_settings from public, anon, authenticated;

/**
 * Sıfır fiyatından puan.
 *
 * **Deterministik ve saf.** Aynı girdi her zaman aynı puanı verir; model
 * yeniden çalıştırılmadan yeniden hesaplanabilir. Yuvarlama onluğa: 991
 * yerine 990 göstermek, hassas olmayan bir tahmini hassas göstermemek için.
 *
 * `p_hasar_siddeti` 0..1 arası; modelin karelerden okuduğu şiddet. Beyan var
 * ama şiddet bilinmiyorsa 1 (tam indirim) uygulanır — bilinmeyeni satıcının
 * lehine yorumlamak, hasarı gizlemeyi kârlı kılardı.
 */
create or replace function public.puan_hesapla(
  p_sifir_fiyat   numeric,
  p_condition     text,
  p_has_damage    boolean default false,
  p_hasar_siddeti numeric default 1.0
)
returns integer
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  a           public.valuation_settings;
  oran        numeric;
  ikinci_el   numeric;
  puan        numeric;
begin
  if p_sifir_fiyat is null or p_sifir_fiyat <= 0 then
    return null;   -- fiyat yoksa puan da yok; çağıran insan kuyruğuna atar
  end if;

  select * into a from public.valuation_settings where id = 1;

  oran := case p_condition
            when 'Yeni gibi'      then a.oran_yeni_gibi
            when 'Az kullanılmış' then a.oran_az_kullanilmis
            when 'İyi durumda'    then a.oran_iyi_durumda
            else a.oran_iyi_durumda   -- tanınmayan durum en muhafazakâr banda
          end;

  ikinci_el := p_sifir_fiyat * oran;

  if p_has_damage then
    ikinci_el := ikinci_el * (1 - a.hasar_indirimi * greatest(0, least(1, coalesce(p_hasar_siddeti, 1))));
  end if;

  puan := ikinci_el * a.puan_per_try;

  /* Bant dışına taşanı kırpmıyoruz — kırpmak, 50.000 puanlık bir hatayı
     sessizce 5.000 yapıp geçirmek olurdu. Çağıran tavanı aşan değeri görüp
     ilanı insan onayına düşürür. Burada yalnızca tabanı uyguluyoruz: çok
     ucuz ürünün puanı sıfıra yuvarlanmasın. */
  return greatest(a.taban_puan, round(puan / 10) * 10)::integer;
end;
$function$;

/** Puan güvenlik bandının dışında mı — otomatik onay verilmemeli. */
create or replace function public.puan_bandi_disinda(p_puan integer)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select p_puan is null or p_puan > (select tavan_puan from public.valuation_settings where id = 1);
$function$;

revoke all on function public.puan_hesapla(numeric, text, boolean, numeric) from public, anon, authenticated;
revoke all on function public.puan_bandi_disinda(integer) from public, anon, authenticated;

/**
 * Yöneticiye ayarları okutur ve değiştirtir.
 *
 * Tek satırlık tablo, tek fonksiyon: oranları değiştirmek göç yazmayı
 * gerektirmesin. Değerleme ilk aylarda ayarlanacak ve her ayar için deploy
 * beklemek, ayarı hiç yapmamak demek olur.
 */
create or replace function public.admin_degerleme_ayarla(
  p_puan_per_try        numeric default null,
  p_oran_yeni_gibi      numeric default null,
  p_oran_az_kullanilmis numeric default null,
  p_oran_iyi_durumda    numeric default null,
  p_hasar_indirimi      numeric default null,
  p_tavan_puan          integer default null
)
returns public.valuation_settings
language plpgsql
security definer
set search_path to 'public'
as $function$
declare sonuc public.valuation_settings;
begin
  if not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  update public.valuation_settings set
    puan_per_try        = coalesce(p_puan_per_try, puan_per_try),
    oran_yeni_gibi      = coalesce(p_oran_yeni_gibi, oran_yeni_gibi),
    oran_az_kullanilmis = coalesce(p_oran_az_kullanilmis, oran_az_kullanilmis),
    oran_iyi_durumda    = coalesce(p_oran_iyi_durumda, oran_iyi_durumda),
    hasar_indirimi      = coalesce(p_hasar_indirimi, hasar_indirimi),
    tavan_puan          = coalesce(p_tavan_puan, tavan_puan),
    guncellendi         = now()
  where id = 1
  returning * into sonuc;
  return sonuc;
end;
$function$;

revoke all on function public.admin_degerleme_ayarla(numeric, numeric, numeric, numeric, numeric, integer)
  from public, anon;
grant execute on function public.admin_degerleme_ayarla(numeric, numeric, numeric, numeric, numeric, integer)
  to authenticated;

/* Değerlemenin kaynağı ilanla birlikte saklanıyor: "bu puan nereden çıktı"
   sorusunun cevabı olmadan hiçbir itiraz çözülemez. */
alter table public.products
  add column if not exists sifir_fiyat      numeric,
  add column if not exists degerleme_kaynak text,
  add column if not exists degerleme_guven  numeric(3,2),
  add column if not exists degerleme_model  text,
  add column if not exists degerleme_at     timestamptz;

comment on column public.products.sifir_fiyat is
  'Yapay zekânın bulduğu sıfır (perakende) fiyatı, ₺. Puan bundan türetilir.';
comment on column public.products.degerleme_kaynak is
  'Fiyatın alındığı kaynak (URL ya da kısa açıklama). İtirazda tek dayanak.';
comment on column public.products.degerleme_guven is
  '0..1 — modelin kendi güveni. Düşükse ilan insan onayına düşer.';
