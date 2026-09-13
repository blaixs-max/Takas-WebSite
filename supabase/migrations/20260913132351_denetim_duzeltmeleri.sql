-- ============================================================================
-- Denetim düzeltmeleri (2026-09-13)
-- ============================================================================
--
-- 2026-09-08 göçü (`elle_onay`) yayına girdikten sonra bağımsız bir kod
-- denetimi yapıldı: sekiz boyut, her bulgu üç ayrı gözle çürütme denemesi
-- (`docs/denetim-2026-09-13.md`). Bu dosya oradan çıkan ve kodla doğrulanan
-- kusurları kapatıyor. Her bölüm önce kusuru, sonra düzeltmeyi anlatıyor;
-- iddiaların testleri `elle_onay_test.sql` §12+ ve `delivery_release_test.sql`
-- §13+ içinde.
--
-- Dersler, kısa:
--   * "İstemciye açılan fonksiyon çağıranını kendisi doğrular" kuralı bir
--     parametreyle deliniyordu: `create_trade(p_buyer_id)` alıcıyı istemciden
--     alıyordu. Eski imzadan miras kalan bir esneklik, adres kopyası eklenince
--     kişisel veri sızıntısına dönüştü.
--   * RLS satır düzeyindedir, kolon değil: `teslimat` bir satırın içindeyse ve
--     satır görünürse kolon da görünür. "Takas kapanınca görünmez olur"
--     taahhüdünü politika değil, kapanışta kolonu **silmek** yerine getirir.
--   * Bir tablo satırını kilitlemek, satırın gösterdiği depo nesnesini
--     kilitlemez. `product_photos` IN_REVIEW'da kilitliydi, `storage.objects`
--     değildi; onaylı kare aynı yola yeniden yazılabiliyordu.
-- ============================================================================

-- ============================================================================
-- 1) create_trade: alıcı yalnızca kendi adına takas açar
-- ============================================================================
-- `alici := coalesce(p_buyer_id, auth.uid())` çağıranla karşılaştırma
-- yapmıyordu. Oturumlu herhangi bir kullanıcı, kendi ilanı için başkasının
-- kimliğiyle takas açabilirdi: kurbanın varsayılan adresi `teslimat`a
-- kopyalanır (satıcıya görünür), puanı emanete alınır, uydurma bir takip
-- numarasıyla 7 gün sonra satıcıya geçer. Kurban kimliği gizli değil —
-- `products.seller_id` herkese açık.
--
-- `p_buyer_id` parametresi service_role/cron/test iskelesi için kalıyor
-- (`auth.uid()` boşken); oturumlu çağrıda kendisinden başkası olamaz.
create or replace function public.create_trade(
  p_product_id text,
  p_buyer_id   uuid default null,
  p_address_id uuid default null
)
returns public.trades
language plpgsql security definer set search_path = public as $$
declare p public.products; t public.trades; alici uuid; a public.addresses;
begin
  if auth.uid() is not null and p_buyer_id is not null and p_buyer_id <> auth.uid() then
    raise exception 'alıcı yalnızca kendi adına takas açar';
  end if;
  alici := coalesce(p_buyer_id, auth.uid());
  if alici is null then
    raise exception 'alıcı belirlenemedi';
  end if;

  select * into p from public.products where id = p_product_id for update;
  if not found then
    raise exception 'ilan % bulunamadı', p_product_id;
  end if;
  if p.status <> 'ACTIVE' then
    raise exception 'ilan satın alınabilir durumda değil (mevcut: %)', p.status;
  end if;
  if p.seller_id is null then
    raise exception 'ilanın satıcısı yok';
  end if;
  if p.seller_id = alici then
    raise exception 'kendi ilanınızı satın alamazsınız';
  end if;

  if p_address_id is not null then
    select * into a from public.addresses ad
     where ad.id = p_address_id and ad.user_id = alici;
    if not found then raise exception 'adres bulunamadı'; end if;
  else
    select * into a from public.addresses ad
     where ad.user_id = alici
     order by ad.varsayilan desc, ad.updated_at desc
     limit 1;
    if not found then
      raise exception 'teslimat adresi gerekli: takastan önce bir adres ekleyin';
    end if;
  end if;

  insert into public.trades (buyer_id, seller_id, product_id, points, teslimat)
  values (alici, p.seller_id, p.id, p.points,
          jsonb_build_object(
            'ad_soyad',   a.ad_soyad,
            'telefon',    a.telefon,
            'il',         a.il,
            'ilce',       a.ilce,
            'acik_adres', a.acik_adres))
  returning * into t;

  perform set_config('kt.bypass_product_guard', 'on', true);
  update public.products set status = 'RESERVED' where id = p.id;
  perform set_config('kt.bypass_product_guard', 'off', true);

  t := public.hold_points(t.id);
  return t;
end; $$;
revoke all on function public.create_trade(text, uuid, uuid) from public, anon;
grant execute on function public.create_trade(text, uuid, uuid) to authenticated, service_role;

-- ============================================================================
-- 2) Alıcının adres kopyası takas kapanınca silinir
-- ============================================================================
-- Gizlilik sayfası "takas kapanınca satıcıya görünmez olur" diyor. Kod bunu
-- yalnızca kargolanmadan iptal edilen takasta yapıyordu; COMPLETED ve kargo
-- sonrası REFUNDED satırlarda kopya süresiz duruyordu ve "taraf olduğun
-- takası gör" politikası durum süzmediği için satıcı aylar sonra da
-- okuyabiliyordu. Dokümanlarda anılan `my_trades()` RPC'si hiç yazılmamıştı;
-- gerçek mekanizma bu: satır RLS ile tarafa açık, kolon kapanışta siliniyor.
-- Kargo firması ve takip numarası kalıyor — sayfa onları "takas kaydı
-- süresince" diye ayrı yazıyor ve itirazda kanıt.
create or replace function public.trades_stamp_timeline()
returns trigger language plpgsql set search_path = public as $$
declare s public.trade_timings;
begin
  select * into s from public.trade_timings where id;

  if tg_op = 'INSERT' then
    if new.status in ('CREATED','POINTS_HELD') then
      new.deadline_at := now() + s.dropoff_window;
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  case new.status
    when 'POINTS_HELD' then
      new.deadline_at := now() + s.dropoff_window;

    when 'SHIPPED' then
      new.shipped_at := coalesce(new.shipped_at, now());
      if old.status = 'DISPUTED' then
        new.deadline_at        := now() + coalesce(old.deadline_remaining, s.confirm_window);
        new.deadline_remaining := null;
      else
        new.deadline_at := now() + s.confirm_window;
      end if;

    when 'DELIVERED' then
      new.delivered_at := coalesce(new.delivered_at, now());
      if old.status = 'DISPUTED' then
        new.deadline_at        := now() + coalesce(old.deadline_remaining, s.confirm_window);
        new.deadline_remaining := null;
      else
        new.deadline_at := now() + s.confirm_window;
      end if;

    when 'DISPUTED' then
      new.deadline_remaining := greatest(coalesce(old.deadline_at, now()) - now(), interval '0');
      new.deadline_at        := null;

    when 'COMPLETED' then
      new.completed_at       := coalesce(new.completed_at, now());
      new.deadline_at        := null;
      new.deadline_remaining := null;
      new.teslimat           := null;

    when 'REFUNDED' then
      new.deadline_at        := null;
      new.deadline_remaining := null;
      new.teslimat           := null;

    else
      null;
  end case;

  return new;
end; $$;

-- Kapanmış takaslarda duran kopyalar da silinir.
update public.trades set teslimat = null
 where status in ('COMPLETED','REFUNDED') and teslimat is not null;

-- İkinci kilit: anon'un `trades` tablosunda SELECT yetkisi vardı; politikalar
-- `to authenticated` olduğu için sıfır satır alıyordu ama bir gün biri
-- `to public` bir politika yazarsa kolon açığa çıkardı. Vitrin `trades`
-- okumuyor.
revoke select on public.trades from anon;

-- ============================================================================
-- 3) Depo nesnesi de satırla aynı kapıya bağlı: yalnızca DRAFT ilana yazılır
-- ============================================================================
-- `product_photos` politikaları IN_REVIEW/ACTIVE ilanda yazmayı reddediyor,
-- ama karenin dosyası `listing-photos/{uid}/{ilan}/{slot}.jpg` yolunda ve
-- depo politikaları yalnızca ilk klasörün `auth.uid()` olmasına bakıyordu.
-- İstemci `upsert: true` ile önce dosyayı yazıyor, satırı sonra güncelliyor:
-- onaylanmış ilanın karesi, yöneticinin gördüğü baytlar olmadan, aynı yola
-- yeni bir dosyayla değiştirilebiliyordu; satır `approved` kaldığı için
-- vitrin yeni dosyayı "onaylı" diye sunardı. Avatar için aynı delik 08-18'de
-- yol-her-yüklemede-yeni ile kapatılmıştı; ilan kareleri için kapatılmamıştı.
--
-- Yol biçimi tek: `{uid}/{ilan}/{slot}.jpg` — ikinci klasör ilan kimliği.
create or replace function public.kare_yazilabilir(p_name text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.products p
     where p.id = (storage.foldername(p_name))[2]
       and p.seller_id = auth.uid()
       and p.status = 'DRAFT')
$$;
revoke all on function public.kare_yazilabilir(text) from public, anon;
grant execute on function public.kare_yazilabilir(text) to authenticated;

drop policy if exists "kendi klasörüne yükle" on storage.objects;
create policy "kendi klasörüne yükle"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos'
              and (storage.foldername(name))[1] = auth.uid()::text
              and public.kare_yazilabilir(name));

drop policy if exists "kendi klasöründe günceller" on storage.objects;
create policy "kendi klasöründe günceller"
  on storage.objects for update to authenticated
  using (bucket_id = 'listing-photos'
         and (storage.foldername(name))[1] = auth.uid()::text
         and public.kare_yazilabilir(name))
  with check (bucket_id = 'listing-photos'
              and (storage.foldername(name))[1] = auth.uid()::text
              and public.kare_yazilabilir(name));

-- Silme politikası olduğu gibi kalıyor (kendi klasörü, durum şartı yok):
-- kendi dosyasını silmek yalnızca kendine zarar verir ve hesap silinirken
-- istemcinin bütün kareleri temizleyebilmesi için gerekli. Yönetici ise
-- yalnızca REDDETTİĞİ karenin dosyasını silebilir — gizlilik sayfasının
-- "güvenlik gerekçesiyle reddedilen kare karar anında silinir" cümlesi bu
-- politikayla yerine geliyor; dosyayı `admin_moderate_photo` sonrası
-- istemci siliyor (avatar ile aynı kalıp).
drop policy if exists "yönetici reddettiği kareyi siler" on storage.objects;
create policy "yönetici reddettiği kareyi siler"
  on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos'
         and public.is_admin()
         and exists (select 1 from public.product_photos f
                      where f.storage_path = storage.objects.name
                        and f.moderation_status = 'rejected'));

-- ============================================================================
-- 4) İlan satırı da yalnızca DRAFT iken istemciden güncellenir
-- ============================================================================
-- "kendi ilanını güncelle" politikası durum şartı taşımıyordu; koruma
-- tetikleyicisi puan/durum/sahip/kategoriyi kilitliyor ama kondisyon, hasar,
-- set, desi, `submitted_at` ve inceleme kolonları serbestti. Satıcı "İyi
-- durumda" gönderip yönetici bakarken PostgREST ile "Yeni gibi"ye çevirirse
-- onay anında puan yeni beyandan hesaplanırdı (1599 TL: 910 → 1180);
-- `submitted_at`i geriye çekip kuyrukta öne geçebilirdi. Bütün yazma
-- RPC'leri `security definer` ve bypass bayrağını açıyor; politika onları
-- etkilemiyor. Mobil istemci tabloya doğrudan `update` yapmıyor.
alter policy "kendi ilanını güncelle" on public.products
  using (seller_id = auth.uid() and status = 'DRAFT')
  with check (seller_id = auth.uid() and status = 'DRAFT');

create or replace function public.products_guard_client_update()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null
     or coalesce(current_setting('kt.bypass_product_guard', true), 'off') = 'on' then
    return new;
  end if;

  if new.points is distinct from old.points then
    raise exception
      'İlan puanı doğrudan değiştirilemez; set_product_points() kullanın';
  end if;
  if new.status is distinct from old.status then
    raise exception
      'İlan durumu doğrudan değiştirilemez; durum takas akışıyla değişir';
  end if;
  if new.ai_suggested_points is distinct from old.ai_suggested_points then
    raise exception 'Değerleme sonucu değiştirilemez';
  end if;
  if new.seller_id is distinct from old.seller_id then
    raise exception 'İlan sahibi değiştirilemez';
  end if;
  if new.category is distinct from old.category
     or new.sub_category is distinct from old.sub_category then
    raise exception
      'Kategori doğrudan değiştirilemez; set_listing_category() kullanın';
  end if;
  /* İnceleme ve değerleme izi yalnızca sunucu fonksiyonlarının: taslakta bile
     istemci bunları yazamaz. Kondisyon/hasar/set/desi `update_listing`
     üzerinden değişir — o yol puanı ve değerleme izini birlikte bayatlatıyor,
     doğrudan yazım onu atlardı. */
  if new.submitted_at     is distinct from old.submitted_at
     or new.review_reason is distinct from old.review_reason
     or new.reviewed_by   is distinct from old.reviewed_by
     or new.reviewed_at   is distinct from old.reviewed_at
     or new.sifir_fiyat   is distinct from old.sifir_fiyat
     or new.market_value  is distinct from old.market_value
     or new.degerleme_at  is distinct from old.degerleme_at
     or new.degerleme_kaynak is distinct from old.degerleme_kaynak
     or new.degerleme_guven  is distinct from old.degerleme_guven
     or new.degerleme_model  is distinct from old.degerleme_model
     or new.taban_uygulandi  is distinct from old.taban_uygulandi then
    raise exception 'İnceleme ve değerleme alanları doğrudan değiştirilemez';
  end if;
  if new.condition is distinct from old.condition
     or new.has_damage is distinct from old.has_damage
     or new.is_set     is distinct from old.is_set
     or new.size_class is distinct from old.size_class then
    raise exception
      'Durum, hasar, set ve boyut doğrudan değiştirilemez; update_listing() kullanın';
  end if;

  return new;
end; $function$;

-- ============================================================================
-- 5) mark_shipped: kargo bilgisi bildirime gömülüyor, biçimi sınırlı olmalı
-- ============================================================================
-- Firma alanı "Diğer" seçilince serbest metindi ve takip numarası yalnızca
-- uzunluk denetimliydi; ikisi de alıcıya giden "Ürününüz yolda" bildiriminin
-- içine giriyordu. Satıcı oraya "kargo için 250 TL'yi TR.. IBAN'a gönderin"
-- yazabilirdi ve alıcı bunu platformun kendi bildirimi diye okurdu.
-- Ayrıca göç öncesi açık takaslarda teslimat boş kalabiliyordu; adressiz
-- takas kargoya verilemez.
create or replace function public.mark_shipped(
  p_trade_id      uuid,
  p_kargo_firmasi text,
  p_takip_no      text
)
returns public.trades
language plpgsql security definer set search_path = public as $$
declare t public.trades; firma text; takip text;
begin
  if auth.uid() is null then raise exception 'oturum bulunamadı'; end if;

  firma := btrim(coalesce(p_kargo_firmasi, ''));
  if firma = '' then
    raise exception 'kargo firması zorunludur';
  end if;
  if length(firma) > 40 or firma !~ '^[[:alnum:] ğüşöçıİĞÜŞÖÇâîû.&''-]+$' then
    raise exception 'kargo firması adı en fazla 40 harf; yalnızca harf, rakam, boşluk, nokta, & ve tire';
  end if;

  takip := regexp_replace(coalesce(p_takip_no, ''), '\s+', '', 'g');
  if takip !~ '^[A-Za-z0-9-]{4,64}$' then
    raise exception 'takip numarası 4–64 karakter; yalnızca harf, rakam ve tire';
  end if;

  select * into t from public.trades where id = p_trade_id for update;
  if not found then raise exception 'takas bulunamadı'; end if;
  if t.seller_id <> auth.uid() then
    raise exception 'kargo bilgisini yalnızca satıcı girer';
  end if;
  if t.status <> 'POINTS_HELD' then
    raise exception 'bu durumda kargoya verilemez (mevcut: %)', t.status;
  end if;
  if t.teslimat is null then
    raise exception 'teslimat adresi yok; alıcıdan adres eklemesi istenmeli';
  end if;

  update public.trades
     set kargo_firmasi = firma,
         takip_no      = takip,
         status        = 'SHIPPED',
         updated_at    = now()
   where id = t.id
  returning * into t;
  return t;
end; $$;
revoke all on function public.mark_shipped(uuid, text, text) from public, anon;
grant execute on function public.mark_shipped(uuid, text, text) to authenticated;

-- ============================================================================
-- 6) Bildirimler: itirazdan dönüş yeni kargolama değil; iptal metni duruma göre
-- ============================================================================
-- İtiraz reddedilince takas SHIPPED'e dönüyor ve tetikleyici bunu yeni bir
-- kargolama sanıp alıcıya ikinci kez "Ürününüz yolda … 7 gün içinde"
-- gönderiyordu — sayaç kaldığı yerden sürdüğü için süre de yanlıştı;
-- `dispute.rejected` zaten gidiyor. REFUNDED'da satıcıya "ilan yeniden
-- vitrinde" deniyordu; ürün alıcıda kalan iadede (REFUND_KEEP) bu, satıcıyı
-- elinde olmayan malı satmaya davet ederdi.
create or replace function public.trades_notify()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare urun text; s public.trade_timings; kargo_gun int; onay_gun int; vitrinde boolean;
begin
  select p.title into urun from public.products p where p.id = new.product_id;
  urun := coalesce(urun, 'ürününüz');
  select * into s from public.trade_timings where id;
  kargo_gun := (extract(epoch from s.dropoff_window) / 86400)::int;
  onay_gun  := (extract(epoch from s.confirm_window) / 86400)::int;

  if tg_op = 'INSERT' then
    perform public.notify(new.seller_id, 'trade.created',
      'Ürününüz alındı',
      urun || ' için takas başladı; alıcının puanı güvenli havuzda. Ürünü ' ||
        kargo_gun || ' gün içinde kargoya verip takip numarasını girin. Kargo ücreti size ait.',
      jsonb_build_object('trade', new.id));
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  /* İtirazdan dönüş bir durum değişikliği ama yeni bir olay değil; haberi
     `disputes_notify` veriyor. */
  if old.status = 'DISPUTED' and new.status in ('SHIPPED','DELIVERED') then
    return new;
  end if;

  case new.status
    when 'SHIPPED' then
      perform public.notify(new.buyer_id, 'trade.shipped',
        'Ürününüz yolda',
        urun || ' kargoya verildi: ' || coalesce(new.kargo_firmasi, 'kargo') || ' · ' ||
          coalesce(new.takip_no, '') || '. Elinize ulaşınca onaylayın; ' || onay_gun ||
          ' gün içinde onay ya da itiraz gelmezse puan satıcıya geçer.',
        jsonb_build_object('trade', new.id));
      perform public.notify(new.seller_id, 'trade.shipped',
        'Kargo bilgisi kaydedildi',
        urun || ' için takip numarası alıcıya iletildi. Alıcı onaylayınca puan hesabınıza geçer.',
        jsonb_build_object('trade', new.id));

    when 'DELIVERED' then
      perform public.notify(new.buyer_id, 'trade.delivered',
        'Teslim edildi — onayınızı bekliyoruz',
        urun || ' elinize ulaştıysa onaylayın. Süre dolunca puan satıcıya otomatik geçer.',
        jsonb_build_object('trade', new.id));

    when 'COMPLETED' then
      perform public.notify(new.seller_id, 'trade.completed',
        'Puanınız hesabınızda',
        new.points || ' puan cüzdanınıza geçti.',
        jsonb_build_object('trade', new.id));
      perform public.notify(new.buyer_id, 'trade.completed',
        'Takas tamamlandı',
        urun || ' için takas kapandı. İyi günlerde kullanın.',
        jsonb_build_object('trade', new.id));

    when 'REFUNDED' then
      /* İlan yalnızca kargolanmamış iptalde vitrine döner; ürün alıcıda kalan
         iadede (REFUND_KEEP) satıcının elinde mal yok. */
      select (p.status = 'ACTIVE') into vitrinde from public.products p where p.id = new.product_id;
      perform public.notify(new.buyer_id, 'trade.refunded',
        'Puanınız iade edildi',
        new.points || ' puan hesabınıza geri döndü.',
        jsonb_build_object('trade', new.id));
      perform public.notify(new.seller_id, 'trade.refunded',
        'Takas iptal edildi',
        urun || ' için açılan takas kapandı' ||
          case when coalesce(vitrinde, false) then ', ilan yeniden vitrinde.' else '.' end,
        jsonb_build_object('trade', new.id));

    else
      null;
  end case;

  return new;
end; $function$;

-- ============================================================================
-- 7) REFUND_KEEP: ürün alıcıda kaldıysa ilan vitrine dönmez
-- ============================================================================
-- `refund_points` → REFUNDED → ürün otomatik ACTIVE. Düşük puanlı iadede ürün
-- fiziksel olarak alıcıda; ilan vitrine çıksa başka bir alıcı olmayan ürüne
-- takas açar, puanı 4 gün emanette bekler, sonra iade döngüsü. Ürün REMOVED
-- olur; satıcı isterse yeniden ekler.
--
-- Bildirim tetikleyicisi (6) ürünün durumuna bakıyor; bu yüzden ürün
-- REFUNDED yazılmadan ÖNCE değil, hemen SONRA ama aynı işlemde REMOVED'a
-- çekiliyor — ve bildirim `after` tetikleyicide, satır güncellemesiyle aynı
-- işlemde, yani REMOVED'ı görüyor.
create or replace function public.resolve_dispute(
  p_dispute_id uuid, p_kabul boolean, p_not text default null,
  p_kargo_hasari boolean default false, p_iade_kargo_tl numeric default null,
  p_karar_veren uuid default null
)
returns disputes
language plpgsql security definer set search_path = public as $$
declare d public.disputes; t public.trades; esik integer; sonuc text;
begin
  select return_threshold_points into esik from public.dispute_policy where id;

  select * into d from public.disputes where id = p_dispute_id for update;
  if not found then raise exception 'itiraz bulunamadı'; end if;
  if d.status not in ('OPEN','NEEDS_EVIDENCE') then
    raise exception 'itiraz zaten sonuçlanmış (%)', d.status;
  end if;

  select * into t from public.trades where id = d.trade_id for update;

  if not p_kabul then
    update public.trades set status = public.itiraz_oncesi_durum(t), updated_at = now()
     where id = t.id;
    update public.disputes
       set status = 'REJECTED', resolution = 'REJECTED', decision_note = p_not,
           decided_by = p_karar_veren, decided_at = now(), deadline_at = null
     where id = d.id
    returning * into d;
    return d;
  end if;

  sonuc := case when t.points >= esik then 'REFUND_RETURN' else 'REFUND_KEEP' end;

  if sonuc = 'REFUND_KEEP' then
    /* Önce ürün: `refund_points` REFUNDED yazınca `trades_sync_product_status`
       RESERVED → ACTIVE yapıyor; ürünü REMOVED'a çekersek o dal (`status =
       'RESERVED'` şartı) hiç dokunmaz ve bildirim de "vitrinde değil" görür. */
    perform set_config('kt.bypass_product_guard', 'on', true);
    update public.products set status = 'REMOVED' where id = t.product_id;
    perform set_config('kt.bypass_product_guard', 'off', true);
  end if;

  perform public.refund_points(
    t.id,
    case when sonuc = 'REFUND_RETURN'
         then 'İade kabul edildi — ürün satıcıya geri gönderiliyor'
         else 'İade kabul edildi — ürün alıcıda kalıyor' end);

  if sonuc = 'REFUND_RETURN' and coalesce(p_iade_kargo_tl, 0) > 0 then
    insert into public.seller_debts (seller_id, trade_id, dispute_id, amount_tl, reason)
    values (t.seller_id, t.id, d.id, p_iade_kargo_tl, 'İade kargosu');
  end if;

  update public.disputes
     set status = 'RESOLVED', resolution = sonuc, carrier_claim = p_kargo_hasari,
         decision_note = p_not, decided_by = p_karar_veren, decided_at = now(),
         deadline_at = null
   where id = d.id
  returning * into d;
  return d;
end; $$;

-- ============================================================================
-- 8) expire_stale_trades: CREATED satır bütün koşuyu düşürmesin
-- ============================================================================
-- Döngü CREATED için `refund_points` çağırıyordu; o fonksiyon CREATED'ı
-- reddedip istisna atıyor ve tek satır bütün saatlik koşuyu (4 gün iadeleri,
-- 7 gün aktarımları) durduruyordu. `create_trade` atomik olduğu için üretimde
-- CREATED kalıcı değil; risk doğrudan insert eden yollarla sınırlı — ama bir
-- cron görevinin tek satırla susması kabul edilemez.
create or replace function public.expire_stale_trades()
returns table (kargolanmadi integer, otomatik_onay integer)
language plpgsql security definer set search_path = public as $$
declare t public.trades;
begin
  kargolanmadi := 0; otomatik_onay := 0;

  for t in
    select * from public.trades
     where deadline_at is not null and deadline_at <= now()
     order by deadline_at
     for update
  loop
    if t.status = 'POINTS_HELD' then
      perform public.refund_points(t.id, 'Satıcı ürünü süresinde kargoya vermedi');
      kargolanmadi := kargolanmadi + 1;

    elsif t.status in ('SHIPPED','DELIVERED') then
      perform public.release_points(t.id);
      otomatik_onay := otomatik_onay + 1;

    else
      if t.status = 'CREATED' then
        raise warning '[expire_stale_trades] emanete hiç girmemiş CREATED takas: %', t.id;
      end if;
      update public.trades set deadline_at = null where id = t.id;
    end if;
  end loop;

  return next;
end; $$;
revoke all on function public.expire_stale_trades() from public, anon, authenticated;

-- ============================================================================
-- 9) taban_uygulandi: kolonun kendi tanımıyla aynı hesap
-- ============================================================================
-- `ilan_onayla` ham değeri TL×oran diye karşılaştırıyordu; `degerleme_yaz` ve
-- kolonun yorumu ham değeri `round(TL×oran×puan_per_try / 10) × 10` olarak
-- tanımlıyor ("80 TL de 50 puan eder ama orada taban uygulanmaz"). Yeni
-- ifadeyle 80–87 TL bandı yanlış işaretleniyordu.
create or replace function public.ilan_onayla(
  p_product_id  text,
  p_sifir_fiyat numeric,
  p_puan        integer,
  p_cover_slot  public.photo_slot,
  p_reviewer    uuid
)
returns products
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  p     public.products;
  puan  integer;
  taban integer;
  ham   numeric;
begin
  select * into p from public.products where id = p_product_id for update;
  if not found then raise exception 'ilan bulunamadı'; end if;
  if p.status <> 'IN_REVIEW' then
    raise exception 'yalnızca incelemedeki ilan onaylanır (mevcut: %)', p.status;
  end if;
  /* Hesabı silinmiş satıcının ilanı kuyrukta kalmış olabilir (§12 öncesi
     silinen hesaplar); onaylanırsa sahipsiz ilan vitrine ve siteye düşer. */
  if not exists (select 1 from auth.users u where u.id = p.seller_id) then
    raise exception 'ilan sahibi silinmiş; ilan onaylanamaz';
  end if;

  if p_puan is not null then
    if p_puan <= 0 then raise exception 'puan sıfırdan büyük olmalı'; end if;
    puan := p_puan;
  elsif p_sifir_fiyat is not null and p_sifir_fiyat > 0 then
    puan := public.puan_hesapla(p_sifir_fiyat, p.condition, p.has_damage, 1.0);
  else
    raise exception 'onay için sıfır fiyatı ya da puan gerekir';
  end if;

  select vs.taban_puan into taban from public.valuation_settings vs where vs.id = 1;
  if p_puan is null then
    ham := round((p_sifir_fiyat * public.puan_orani(p.condition, p.has_damage, 1.0)
                  * (select puan_per_try from public.valuation_settings where id = 1)) / 10) * 10;
  end if;

  update public.product_photos
     set moderation_status = 'approved', moderation_reason = null
   where product_id = p_product_id and moderation_status = 'pending';

  perform set_config('kt.bypass_product_guard', 'on', true);
  update public.products
     set points              = puan,
         ai_suggested_points = null,
         sifir_fiyat         = p_sifir_fiyat,
         market_value        = case when p_sifir_fiyat is null then market_value
                                    else round(p_sifir_fiyat)::text end,
         degerleme_kaynak    = 'admin',
         degerleme_guven     = null,
         degerleme_model     = null,
         degerleme_at        = now(),
         taban_uygulandi     = (p_puan is null and taban is not null and ham < taban),
         review_reason       = null,
         reviewed_by         = p_reviewer,
         reviewed_at         = now()
   where id = p_product_id;
  perform set_config('kt.bypass_product_guard', 'off', true);

  p := public.ilan_yayina_al(p_product_id, p_cover_slot);

  perform public.audit('listing.approve', 'product:' || p_product_id,
    jsonb_build_object('sifir_fiyat', p_sifir_fiyat, 'puan', puan, 'elle', p_puan is not null));
  return p;
end; $function$;
revoke all on function public.ilan_onayla(text, numeric, integer, public.photo_slot, uuid) from public, anon, authenticated;

-- ============================================================================
-- 10) Avatar kararı bildirim üretir; yönetici yalnızca öksüz dosyayı siler
-- ============================================================================
-- `uploadAvatar`ın yorumu "sonuç bildirimle gelir" diyordu, hiçbir yer
-- göndermiyordu; kullanıcı reddi profil ekranına girince öğreniyordu. "Yeni
-- durum eklenirken bildirimi aynı göçte gelir" kuralı burada uygulanmamıştı.
create or replace function public.admin_avatar_karar(
  p_user_id uuid,
  p_uygun   boolean,
  p_gerekce text default null
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare eski text;
begin
  if not public.is_admin() then
    raise exception 'bu işlem için yönetici yetkisi gerekir';
  end if;
  if not p_uygun and (p_gerekce is null or btrim(p_gerekce) = '') then
    raise exception 'ret gerekçesi zorunludur';
  end if;

  select pr.avatar_path into eski from public.profiles pr where pr.user_id = p_user_id;
  if eski is null then
    raise exception 'bekleyen avatar yok';
  end if;

  perform public.avatar_karar(p_user_id,
    case when p_uygun then 'approved' else 'rejected' end,
    case when p_uygun then null else btrim(p_gerekce) end);

  if p_uygun then
    perform public.notify(p_user_id, 'avatar.approved',
      'Profil fotoğrafın yayında',
      'Fotoğrafın onaylandı; artık diğer üyeler de görüyor.',
      jsonb_build_object('profile', true));
  else
    perform public.notify(p_user_id, 'avatar.rejected',
      'Profil fotoğrafın kullanılamadı',
      btrim(p_gerekce) || ' Başka bir fotoğraf yükleyebilirsin.',
      jsonb_build_object('profile', true));
  end if;

  perform public.audit(
    case when p_uygun then 'avatar.approve' else 'avatar.reject' end,
    'user:' || p_user_id::text,
    jsonb_build_object('gerekce', p_gerekce));

  return eski;
end; $function$;
revoke all on function public.admin_avatar_karar(uuid, boolean, text) from public, anon;
grant execute on function public.admin_avatar_karar(uuid, boolean, text) to authenticated;

-- Yönetici silme politikası kovadaki her nesneyi kapsıyordu; meşru silme
-- yalnızca ret yolundan geliyor ve o anda dosya artık hiçbir profilde
-- referanslı değil. Referanslı dosyayı silmek onaylı bir profili kırık
-- görsele bağlardı, denetim kaydı da düşmezdi.
drop policy if exists "yönetici avatar kovasından siler" on storage.objects;
create policy "yönetici avatar kovasından siler" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars'
         and public.is_admin()
         and not exists (select 1 from public.profiles p where p.avatar_path = storage.objects.name));

-- ============================================================================
-- 11) Kare reddi bildirimi taslaklara götürür
-- ============================================================================
-- `photo.rejected` verisi `{product}` taşıyordu ve uygulama onu ürün sayfasına
-- yönlendiriyordu; reddedilen karenin ilanı DRAFT/IN_REVIEW olduğundan doğru
-- varış yeri taslaklar (`listing.rejected` ile aynı `draft` bayrağı).
create or replace function public.photos_notify()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare satici uuid; baslik text;
begin
  if new.moderation_status <> 'rejected' or old.moderation_status = 'rejected' then
    return new;
  end if;

  select p.seller_id, p.title into satici, baslik
    from public.products p where p.id = new.product_id;

  perform public.notify(satici, 'photo.rejected',
    'Bir kare yeniden çekilmeli',
    coalesce(baslik, 'İlanınız') || ' — ' ||
      coalesce(new.moderation_reason, 'kare incelemeden geçmedi') || '.',
    jsonb_build_object('product', new.product_id, 'photo', new.id, 'draft', true));
  return new;
end; $function$;

-- ============================================================================
-- 12) Hesap silme: incelemedeki ilan da kalkar, adres kopyaları kesin silinir
-- ============================================================================
-- `delete_own_account` yalnızca DRAFT ve ACTIVE ilanı REMOVED yapıyordu;
-- 2026-09-08'de gelen IN_REVIEW listede yoktu. Silinmiş kullanıcının ilanı
-- kuyrukta kalıyor, yönetici onaylarsa vitrine ve pazarlama sitesine
-- düşüyordu (§9'daki kontrol ikinci kilit). Gizlilik sayfası "kayıtlı
-- adresleriniz silinir" ve "kalan kayıtlarda adınız yer almaz" diyor:
-- kapanmış takaslardaki adres kopyası §2 ile zaten siliniyor, açık takas
-- varken silme reddediliyor — yine de burada bir kez daha boşaltılıyor ki
-- iki kural birbirinden bağımsız dursun.
create or replace function public.delete_own_account(p_onay text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  uid   uuid := auth.uid();
  w     public.wallets;
  n     integer;
  puan  integer := 0;
begin
  if uid is null then
    raise exception 'oturum gerekli';
  end if;

  if p_onay is distinct from 'HESABIMI SIL' then
    raise exception 'silme onayi eksik';
  end if;

  select count(*) into n
    from public.trades
   where (buyer_id = uid or seller_id = uid)
     and status in ('CREATED', 'POINTS_HELD', 'SHIPPED', 'DELIVERED', 'DISPUTED');
  if n > 0 then
    raise exception 'acik takas var: %', n;
  end if;

  select count(*) into n
    from public.products
   where seller_id = uid and status = 'RESERVED';
  if n > 0 then
    raise exception 'rezerve ilan var: %', n;
  end if;

  select count(*) into n
    from public.seller_debts
   where seller_id = uid and status = 'OPEN';
  if n > 0 then
    raise exception 'odenmemis borc var: %', n;
  end if;

  select * into w from public.wallets where user_id = uid for update;

  if found and w.held_points > 0 then
    raise exception 'havuzda tutulan puan var: %', w.held_points;
  end if;

  if found and w.available_points > 0 then
    puan := w.available_points;
    update public.wallets
       set available_points = 0, updated_at = now()
     where user_id = uid;

    insert into public.wallet_entries
      (user_id, type, amount, available_after, held_after, memo)
    values
      (uid, 'CLOSE', puan, 0, 0, 'Hesap kapatildi — puanlar dustu');
  end if;

  perform set_config('kt.bypass_product_guard', 'on', true);
  update public.products
     set status = 'REMOVED'
   where seller_id = uid and status in ('DRAFT', 'IN_REVIEW', 'ACTIVE');
  perform set_config('kt.bypass_product_guard', 'off', true);

  /* Kapanmış takaslardaki adres kopyası (zaten null olmalı) — ikinci kilit. */
  update public.trades set teslimat = null where buyer_id = uid and teslimat is not null;

  perform public.audit(
    'account.deleted',
    uid::text,
    jsonb_build_object('dusen_puan', puan)
  );

  delete from auth.users where id = uid;
end $$;
revoke all on function public.delete_own_account(text) from public, anon;
grant execute on function public.delete_own_account(text) to authenticated;
