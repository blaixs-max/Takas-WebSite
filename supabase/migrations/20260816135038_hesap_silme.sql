-- ============================================================================
-- Hesap silme — App Store 5.1.1(v) ve KVKK silme hakkı
-- ============================================================================
--
-- Hesap açtıran uygulama, hesabı **uygulama içinden** silmeyi sunmak zorunda.
-- Bu bir özellik isteği değil, mağaza reddi sebebi; ayrıca KVKK'nın silme
-- hakkının teknik karşılığı.
--
-- ## Kapalı devre puan burada bir tasarım sorusu doğuruyor
--
-- Hesap silinince bakiyeye ne olacak? Puan parayla satın alınmıyor ve nakde
-- çevrilmiyor, yani iade edilecek bir şey yok. Karar: **bakiye düşer ve bu
-- deftere yazılır.** Sessizce yok saymak çift girişli defteri bozardı; o
-- yüzden yeni bir hareket türü var: `CLOSE`.
--
-- ## Üç durumda silme reddediliyor
--
-- 1. **Açık takas.** Karşı tarafın puanı havuzda ya da kargo yolda. Silmek,
--    bir işlemi ortada bırakıp diğer kullanıcıyı mağdur etmek olurdu.
-- 2. **Rezerve ilan.** Birinin puanı o ilana karşı tutuluyor.
-- 3. **Ödenmemiş borç** (`seller_debts.status = 'OPEN'`). Hesap silerek
--    yükümlülükten kurtulmak mümkün olmamalı.
--
-- Reddetmek, "silemezsin" demek değil: kullanıcı takası tamamlayıp yeniden
-- deneyebiliyor. Ekran hangi engelin olduğunu ve ne yapması gerektiğini
-- söylüyor. Sessizce yarım silmektense açıkça reddetmek doğrusu.
--
-- ## Neyin silinmediği bilinçli
--
-- `auth.users` silinince yalnızca `profiles`, `favorites` ve `cart_items`
-- zincirleme gidiyor — ölçüldü, `auth.users`'a yabancı anahtarı olan başka
-- tablo yok.
--
-- Geride kalanlar **kasıtlı olarak** kalıyor:
--   · `wallet_entries` — çift girişli defter geriye dönük değiştirilemez.
--   · `audit_logs` — zaten değiştirilemez ve silinemez (tetikleyiciyle).
--   · `trades`, `cargo_payments` — tamamlanmış işlemler karşı tarafın da
--     kaydı; onun geçmişini silme hakkımız yok.
--   · `messages` — sohbet iki kişinin; karşı taraf kendi konuşmasını
--     görmeye devam ediyor.
--
-- Bu satırlarda kalan tek kişisel veri `uuid`; ad, e-posta ve fotoğraf
-- gidiyor. Yani kayıt kimliksizleşiyor ama muhasebe bütünlüğü duruyor.
--
-- İlanlar `REMOVED`'a çekiliyor: satıcısı olmayan ilan rafta durmamalı.
-- ============================================================================

-- ------------------------------------------------- 1) yeni defter hareketi

do $$
declare k text;
begin
  select conname into k
    from pg_constraint
   where conrelid = 'public.wallet_entries'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%EARN%';
  if k is not null then
    execute format('alter table public.wallet_entries drop constraint %I', k);
  end if;
end $$;

alter table public.wallet_entries
  add constraint wallet_entries_type_check
  check (type in ('EARN', 'HOLD', 'RELEASE_IN', 'RELEASE_OUT', 'REFUND', 'CLOSE'));

-- ------------------------------------------------------------ 2) fonksiyon

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

  /* Sunucu tarafı onay. Arayüz zaten yazdırıyor ama kapıyı burada da
     tutuyoruz: yanlışlıkla ya da başka bir istemciden gelen tek bir çağrı
     hesabı silememeli. Metinde Türkçe'ye özgü harf yok — kodlama ya da
     yerel ayar farkı yüzünden eşleşmemesi, silinemeyen hesap demek olurdu. */
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

  /* Havuzdaki puan yalnızca açık bir takasa karşı var olabilir ve onu
     yukarıda engelledik. Yine de sessizce geçmiyoruz: buraya düşülüyorsa
     tutarsız bir durum var demektir ve hesabı silmek onu gizlerdi. */
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

  /* Tetikleyici muafiyeti: durum değişimi normalde takas akışına ayrılmış.
     Kalıp `publish_listing` ile aynı. */
  perform set_config('kt.bypass_product_guard', 'on', true);
  update public.products
     set status = 'REMOVED'
   where seller_id = uid and status in ('DRAFT', 'ACTIVE');
  perform set_config('kt.bypass_product_guard', 'off', true);

  /* Denetim kaydı silmeden ÖNCE yazılıyor: `audit()` aktörü `auth.uid()`
     üzerinden alıyor ve kaydın kime ait olduğu sonradan türetilemez. */
  perform public.audit(
    'account.deleted',
    uid::text,
    jsonb_build_object('dusen_puan', puan)
  );

  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_own_account(text) from public;
grant execute on function public.delete_own_account(text) to authenticated;
