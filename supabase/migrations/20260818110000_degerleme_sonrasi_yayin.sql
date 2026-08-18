/**
 * Değerleme tamamlanınca da yayın kapısı çalınıyor.
 *
 * ## Kusur
 *
 * Yayın kapısı dört koşula bakıyor: zorunlu kareler onaylı · değerleme
 * yapılmış · alt kategori dolu · metin denetimden geçmiş. Bugüne kadar bu
 * kapıyı **tek bir şey** çalıyordu: bir karenin kararı değiştiğinde
 * (`product_photos_karar_sonrasi`).
 *
 * Ama uygulamadaki sıra şöyle:
 *
 *   1. Kareler incelenir → onaylanır → KAPI ÇALINIR, değerleme henüz yok, geçmez
 *   2. Değerleme çalışır → puan yazılır → KİMSE ÇALMAZ
 *   3. Uygulama `publish_listing` çağırır → ilan çıkar
 *
 * Üçüncü adım normalde kurtarıyor. Kullanıcı o anda ekrandan çıkarsa, ağ
 * koparsa ya da uygulama arka plana atılırsa ilan **bütün koşulları sağlamış
 * hâlde** taslakta kalıyor ve onu oradan çıkaracak hiçbir yol yok.
 *
 * ## Canlıdaki kanıt
 *
 * Üç ilan tam bu durumdaydı; üçü de aynı kullanıcının ve ikisi **üç dakika
 * arayla açılmış aynı ürün**. Yani kişi "olmadı" deyip yeniden denemiş.
 * Kullanıcının gördüğü şey buydu: bütün adımları yaptın, hata almadın, ilan
 * yok, sebebi hiçbir yerde yazmıyor.
 *
 * ## Çözüm
 *
 * `degerleme_at` dolduğunda da aynı kapıyı çal. Sistem böylece kendi kendini
 * toparlıyor: hangi koşul en son tamamlanırsa tamamlansın, tamamlandığı anda
 * kapı çalınıyor.
 *
 * Yeni bir yayın yolu AÇILMIYOR — `ilan_otomatik_yayina_al` zaten vardı ve
 * bütün kontrolleri yapıyor. Değişen tek şey onun **ne zaman** çağrıldığı.
 * Kapı gevşemiyor, sadece daha sık çalınıyor.
 */

create or replace function public.products_degerleme_sonrasi()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  /* Yalnızca değerleme YENİ geldiğinde. `is distinct from` şart: her ikisi de
     null olduğunda `<>` null döner ve koşul sessizce atlanırdı. */
  if new.degerleme_at is not distinct from old.degerleme_at then
    return null;
  end if;
  if new.degerleme_at is null or new.status <> 'DRAFT' then
    return null;
  end if;

  /* Yeniden giriş kilidi — kare tarafındakiyle aynı gerekçe: yayın akışı
     `products` satırını da güncelliyor (`status`, `is_cover` zinciri) ve
     kilitsiz bırakılırsa bu tetikleyici kendini yeniden ateşler.
     Buradaki koşullar zaten ikinci turu eler (`degerleme_at` değişmiyor) ama
     kilide güvenmek, koşulların doğru yazıldığına güvenmekten sağlam. */
  if coalesce(current_setting('kt.otomatik_yayin', true), 'off') = 'on' then
    return null;
  end if;

  perform set_config('kt.otomatik_yayin', 'on', true);
  perform public.ilan_otomatik_yayina_al(new.id);
  perform set_config('kt.otomatik_yayin', 'off', true);

  return null;
end; $function$;

comment on function public.products_degerleme_sonrasi() is
  'Değerleme yazılınca yayın kapısını çalar. Kapıyı gevşetmez — '
  'ilan_otomatik_yayina_al bütün kontrolleri yapar; değişen tek şey kapının '
  'ne zaman çalındığı. Kare tarafındaki product_photos_karar_sonrasi ile '
  'aynı kilidi (kt.otomatik_yayin) paylaşır.';

drop trigger if exists products_degerleme_sonrasi on public.products;
create trigger products_degerleme_sonrasi
  after update on public.products
  for each row execute function public.products_degerleme_sonrasi();

/**
 * `publish_listing` artık fikirsiz (idempotent).
 *
 * Bu, tetikleyicinin **zorunlu** ikinci yarısı ve testler onu hemen yakaladı:
 * on altı test birden düştü, hepsi aynı hatayla — "yalnızca taslak ilan yayına
 * alınır (mevcut: ACTIVE)".
 *
 * Sebep şu yeni sıra:
 *
 *   1. Değerleme yazılır  → TETİKLEYİCİ ilanı yayına alır
 *   2. Uygulama `publish_listing` çağırır → "zaten yayında" diye PATLAR
 *
 * Yani kullanıcı ilanını başarıyla yayınlar ve ekranda **hata mesajı görür**.
 * Testler olmasaydı bu kusur cihazda ortaya çıkacaktı ve sebebi
 * anlaşılmayacaktı: ilan rafta duruyor, uygulama "yayına alınamadı" diyor.
 *
 * Çözüm `delete_listing`teki ile aynı ve aynı gerekçeyle: **istenen sonuç
 * zaten oluşmuşsa bu bir hata değildir.** Sahibi kendi yayındaki ilanı için
 * `publish_listing` çağırırsa satır dönüyor, exception atılmıyor.
 *
 * Gevşeme yok, üç sebeple:
 *   · Sahiplik kontrolü aynen duruyor — başkası çağıramıyor.
 *   · Yalnızca `ACTIVE` için geçerli. `RESERVED`, `SOLD` ve `REMOVED` hâlâ
 *     hata veriyor; onlar "zaten yaptın" değil, "artık yapılamaz".
 *   · Kapının kendisi (`ilan_yayina_al`) katı kalıyor. Fikirsizlik yalnızca
 *     kullanıcıya bakan sarmalayıcıda — kapı gövdesinde olsaydı otomatik
 *     yayın yolu da sessizleşirdi ve bir daha hiçbir şey söylemezdi.
 */
create or replace function public.publish_listing(
  p_product_id text,
  p_cover_slot public.photo_slot default 'front'
)
returns products
language plpgsql
security definer
set search_path to 'public'
as $function$
declare p public.products;
begin
  select * into p from public.products where id = p_product_id;
  if not found then raise exception 'ilan % bulunamadı', p_product_id; end if;
  if p.seller_id is distinct from auth.uid() then
    raise exception 'yalnızca ilan sahibi yayına alabilir';
  end if;

  /* Zaten yayında: tetikleyici bizden önce davranmış. Sonuç istenen sonuç. */
  if p.status = 'ACTIVE' then
    return p;
  end if;

  return public.ilan_yayina_al(p_product_id, p_cover_slot);
end; $function$;

/**
 * Halihazırda mahsur kalmış ilanlar kurtarılıyor.
 *
 * Tetikleyici bundan sonrasını çözüyor ama geçmişte sıkışanları çözmüyor —
 * onların `degerleme_at`i çoktan yazılmış, yani bir daha değişmeyecek ve
 * tetikleyici hiç ateşlenmeyecek.
 *
 * Kapı yine `ilan_otomatik_yayina_al`: burada elle `status = 'ACTIVE'`
 * yazmıyoruz. Yazsaydık kontrolleri atlamış olurduk ve bu göç, kapının
 * geçirmeyeceği bir ilanı yayına sokabilirdi. Hangi ilanın geçeceğine yine
 * kapı karar veriyor; biz yalnızca çalıyoruz.
 *
 * Hata yutuluyor: bir ilan geçmezse (kapı haklı bir sebeple reddederse) göç
 * düşmemeli, sıradakine geçmeli.
 */
do $$
declare r record; n integer := 0;
begin
  perform set_config('kt.otomatik_yayin', 'on', true);

  for r in
    select id, title from public.products
     where status = 'DRAFT' and degerleme_at is not null
     order by created_at
  loop
    begin
      perform public.ilan_otomatik_yayina_al(r.id);
      if (select status from public.products where id = r.id) = 'ACTIVE' then
        n := n + 1;
        raise notice 'kurtarıldı: %', r.title;
      end if;
    exception when others then
      raise notice 'geçemedi (%): %', r.title, sqlerrm;
    end;
  end loop;

  perform set_config('kt.otomatik_yayin', 'off', true);
  raise notice 'değerleme sonrası yayın: % ilan kurtarıldı', n;
end $$;
