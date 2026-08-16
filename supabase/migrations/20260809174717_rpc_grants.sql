-- KIDS TRADE — RPC yetkileri ve ciro görünümü
--
-- Bu göç, şema ilk kez gerçek bir Supabase projesine uygulandıktan sonra
-- yapılan denetimin sonucudur. Yerel test koşumunda PostgREST yok; bu iki
-- açığın ikisi de yalnızca canlıda görünüyordu.
--
-- 1) HER fonksiyon `anon` rolüne açıktı.
--
--    PostgreSQL, oluşturulan her fonksiyonun EXECUTE yetkisini PUBLIC'e
--    verir; Supabase de `public` şemasındaki yeni fonksiyonlara varsayılan
--    yetkiyle anon + authenticated EXECUTE ekler. Önceki göçlerdeki
--    `revoke all on function ... from public` satırları yetmiyordu, çünkü
--    anon'un yetkisi ayrıca kendi adına da verilmişti.
--
--    Sonuç: elinde anon anahtarı olan herkes — ki o anahtar mobil uygulamaya
--    gömülüdür, gizli değildir — /rest/v1/rpc/earn_points çağırıp istediği
--    hesaba istediği kadar puan basabilirdi. Kapalı devre ekonominin tamamı
--    bu tek çağrıyla anlamsız hâle gelirdi. release_points, refund_points,
--    grant_campaign_points ve resolve_dispute de aynı şekilde açıktı.
--
--    Karar: bir fonksiyon istemciye ancak ÇAĞIRANI KENDİ DOĞRULUYORSA açılır.
--    Doğrulamayan her fonksiyon iç fonksiyondur; yalnızca service_role
--    (Edge Function) ya da tetikleyici üzerinden çalışır.
--
-- 2) `daily_commission` görünümü anon'a okumaya açıktı.
--
--    Görünümlerde RLS yoktur ve bu görünüm SECURITY DEFINER özelliğiyle
--    tanımlıydı; cargo_payments'ın RLS'ini aşıyordu. Anon anahtarıyla tek
--    istek, platformun günlük cirosunu, kargo maliyetini ve komisyonunu
--    veriyordu.
--
-- SIRA ÖNEMLİ. Önce oluştur, SONRA revoke et, en son grant ver. Ters sırada
-- yazılırsa revoke'tan sonra oluşan fonksiyon PUBLIC yetkisiyle doğar ve
-- delik açık kalır — canlıda tam olarak bu oldu, iki ek göçle düzeltildi.
-- Bu yüzden fonksiyon oluşturan HER göç, revoke bloğunu son adım olarak
-- yazmak zorundadır (bkz. CLAUDE.md).

/* ------------------------------------------------------------------ *
 * 1) Alıcının kendi takasının tutarını görmesi
 * ------------------------------------------------------------------ *
 * quote_trade_price() çağıranı doğrulamıyor: takas kimliğini bilen herkes
 * herhangi bir takasın fiyatını sorgulayabiliyordu. Ayrıca carrier_cost_tl
 * ve commission_tl döndürüyor — bunlar bizim marjımız, alıcının işi değil.
 *
 * Repodaki kalıp bunun için hazır: iç fonksiyon denetimsiz kalır, üstüne
 * çağıranı doğrulayan ince bir sarmalayıcı yazılır (admin_resolve_dispute /
 * resolve_dispute ikilisinde olduğu gibi).
 */
create or replace function public.my_trade_quote(p_trade_id uuid)
returns table (
  size_class         text,
  shipping_tl        numeric,
  service_fee_tl     numeric,
  transaction_fee_tl numeric,
  total_tl           numeric
)
language plpgsql security definer set search_path = public as $$
declare t public.trades;
begin
  select * into t from public.trades where id = p_trade_id;
  if not found then
    raise exception 'takas % bulunamadı', p_trade_id;
  end if;
  if auth.uid() is distinct from t.buyer_id and auth.uid() is distinct from t.seller_id then
    raise exception 'bu takasın tutarını yalnızca tarafları görebilir';
  end if;

  return query
    select q.size_class, q.shipping_tl, q.service_fee_tl, q.transaction_fee_tl, q.total_tl
      from public.quote_trade_price(p_trade_id) q;
end; $$;

comment on function public.my_trade_quote(uuid) is
  'Takasın tarafına kırılımı gösterir. Kargo maliyeti ve komisyon dönmez.';

/* ------------------------------------------------------------------ *
 * 2) Tetikleyici fonksiyonlarında sabit search_path
 * ------------------------------------------------------------------ *
 * search_path'i sabitlenmemiş bir SECURITY DEFINER fonksiyonu, çağıranın
 * search_path'ine düşen sahte bir tabloya yazabilir.
 */
alter function public.wallet_entries_immutable() set search_path = public, pg_temp;
alter function public.audit_logs_degismez()      set search_path = public, pg_temp;
alter function public.campaign_grants_degismez() set search_path = public, pg_temp;
alter function public.messages_degismez()        set search_path = public, pg_temp;

/* ------------------------------------------------------------------ *
 * 3) daily_commission — ciro görünümü kapatılır
 * ------------------------------------------------------------------ */
alter view public.daily_commission set (security_invoker = on);
revoke all on public.daily_commission from anon;
revoke all on public.daily_commission from authenticated;
grant select on public.daily_commission to service_role;

comment on view public.daily_commission is
  'Platform cirosu. Yalnızca service_role okur; istemciye asla açılmaz.';

/* ------------------------------------------------------------------ *
 * 4) Varsayılan yetki: yeni fonksiyona anon/authenticated verilmesin
 * ------------------------------------------------------------------ *
 * Bu satırlar anon ve authenticated'ın DOĞRUDAN yetkisini kapatır. PUBLIC'e
 * verilen yerleşik yetkiyi kapatmaz — onun için aşağıdaki açık revoke şart.
 */
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke execute on functions from authenticated;
alter default privileges in schema public revoke execute on functions from public;

do $$
begin
  -- Şema nesnelerinin bir kısmı supabase_admin adına oluşmuş olabilir.
  -- Bu role üyelik yoksa hata verir; kritik değil, sessizce geçilir.
  execute 'alter default privileges for role supabase_admin in schema public '
          'revoke execute on functions from anon, authenticated';
exception when others then
  raise notice 'supabase_admin varsayılan yetkisi değiştirilemedi: %', sqlerrm;
end $$;

/* ------------------------------------------------------------------ *
 * 5) Tüm istemci yetkileri alınır — SON ADIM
 * ------------------------------------------------------------------ */
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from authenticated;

/* ------------------------------------------------------------------ *
 * 6) İstemciye açılan fonksiyonlar
 * ------------------------------------------------------------------ *
 * Buradaki her fonksiyon çağıranını auth.uid() ya da is_admin() ile kendisi
 * doğrular. Listeye ekleme yapmadan önce bu koşulun sağlandığı görülmelidir.
 *
 * anon'a hiçbir fonksiyon açılmaz. Giriş yapmamış kullanıcı vitrini tablo
 * SELECT politikalarıyla görür (products, product_photos, fee_settings…);
 * RPC'ye ihtiyacı yoktur.
 */

-- İlan
grant execute on function public.create_listing(text, text, text, text, integer, text, text, boolean, boolean) to authenticated;
grant execute on function public.publish_listing(text, public.photo_slot) to authenticated;
grant execute on function public.set_product_points(text, integer) to authenticated;

-- Takas
grant execute on function public.create_trade(text, uuid) to authenticated;
grant execute on function public.cancel_trade(uuid) to authenticated;
grant execute on function public.confirm_delivery(uuid) to authenticated;
grant execute on function public.my_trade_quote(uuid) to authenticated;

-- İtiraz
grant execute on function public.open_dispute(uuid, text) to authenticated;
grant execute on function public.add_dispute_evidence(uuid, text, text) to authenticated;

-- Mesajlaşma
grant execute on function public.start_conversation(text) to authenticated;
grant execute on function public.send_message(uuid, text) to authenticated;
grant execute on function public.my_conversations() to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.report_message(uuid, text, text) to authenticated;

-- Bildirim
grant execute on function public.unread_notification_count() to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- Profil ve kampanya
grant execute on function public.profile_stats() to authenticated;
grant execute on function public.my_sanction() to authenticated;
grant execute on function public.campaign_status() to authenticated;

-- Yönetim paneli (hepsi is_admin() kapısının arkasında)
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.admin_photo_queue(integer) to authenticated;
grant execute on function public.admin_moderate_photo(uuid, boolean, text) to authenticated;
grant execute on function public.admin_dispute_queue(integer) to authenticated;
grant execute on function public.admin_resolve_dispute(uuid, boolean, text, boolean, numeric) to authenticated;
grant execute on function public.admin_report_queue(integer) to authenticated;
grant execute on function public.admin_resolve_report(uuid, boolean, text) to authenticated;
grant execute on function public.admin_sanction_list(integer) to authenticated;
grant execute on function public.admin_lift_sanction(uuid, text) to authenticated;
grant execute on function public.admin_close_account(uuid, text) to authenticated;

/* Bilinçli olarak AÇILMAYANLAR — kendi kimlik denetimini yapsalar bile:
 *   audit(text, text, jsonb)  — çağıran istediği denetim kaydını yazabilirdi
 *   is_restricted(uuid)       — rastgele bir kullanıcının durumu sorgulanabilirdi
 *   quote_trade_price(uuid)   — yerine my_trade_quote() açıldı
 */

-- Edge Function'lar her şeyi çağırabilir; service_role zaten RLS'i aşar.
grant execute on all functions in schema public to service_role;
