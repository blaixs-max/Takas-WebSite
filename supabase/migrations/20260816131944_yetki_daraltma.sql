-- ============================================================================
-- Yayın öncesi güvenlik turu — tablo yetkilerinin daraltılması
-- ============================================================================
--
-- ## Bulgu
--
-- `anon` rolünün **30 tablonun hepsinde** INSERT/UPDATE/DELETE yetkisi vardı:
-- `wallets`, `wallet_entries`, `admins`, `audit_logs`, `trades`,
-- `campaign_grants`, `user_sanctions`, `seller_debts` dahil. Kaynağı Supabase'in
-- kurulum betiğindeki `grant all on all tables in schema public to anon,
-- authenticated, service_role` satırı.
--
-- **Bugün sömürülebilir değil** ve bu doğrulandı: 30 tablonun hepsinde RLS açık
-- ve bu tabloların hiçbirinde `anon`a yazma izni veren bir politika yok, yani
-- her yazma denemesi satır düzeyinde reddediliyor.
--
-- Ama tek savunma katmanı bu. `anon` ile `wallets` arasında duran tek şey bir
-- politikanın **yokluğu**. RLS'i açmayı unutan bir göç, ya da fazla geniş
-- yazılmış tek bir politika, o an cüzdan tablosunu açık web'e açar.
--
-- Bu depo aynı mekanikten **iki kez** yaralandı ve ikisi de yalnızca canlıda
-- göründü: önce her fonksiyon `anon`a açıktı (`rpc_grants`), sonra
-- `alter default privileges` yetmeyip PostgreSQL yeni fonksiyonları yine
-- PUBLIC yetkisiyle doğurdu (`rpc_grants_final`). Fonksiyon tarafı kapatıldı,
-- **tablo tarafı açık kaldı.**
--
-- ## Yapılan
--
-- 1. `favorites` ve `cart_items` yazma politikaları `to authenticated` oldu.
--    `to public` yazılmışlardı; koşulları `user_id = auth.uid()` olduğu için
--    `anon` zaten hiçbir satırı eşleyemiyordu (`auth.uid()` NULL, karşılaştırma
--    NULL, satır geçmiyor) — yani davranış değişmiyor. Ama rolün adı belgedir:
--    "burada anonim kullanıcının işi yok" cümlesini politikanın kendisi
--    söylemeli, okuyanın NULL mantığını yeniden türetmesi gerekmemeli.
--
-- 2. Yazma yetkileri, o rol için **yazma politikası bulunmayan** her tablodan
--    geri alındı. Ölçüm: 30 tablonun 8'inde `authenticated` yazma politikası
--    var (cart_items, dispute_evidence, favorites, messages, notifications,
--    product_photos, products, profiles); kalan 22'sinde hiç yok. Yani o 22'de
--    yazma zaten reddediliyordu ve iptal **davranış değiştirmiyor** — yalnızca
--    ikinci bir kilit ekliyor.
--
--    Koşulu döngüde hesaplamak, tablo listesini elle yazmaktan kasıtlı olarak
--    daha iyi: elle yazılan liste bir sonraki göçte eskir ve kimse fark etmez.
--
-- 3. Yeni tabloların aynı yetkiyle doğmaması için varsayılan yetkiler de
--    daraltıldı. `rpc_grants_final` dersi burada geçerli: bu **tek başına
--    yeterli sayılmıyor**, RPC/yetki matrisi her göç sonrası yeniden ölçülür.
--
-- SELECT'e dokunulmadı: `anon` vitrini okuyabilmeli (yayındaki ilanlar ve
-- kareleri), site de derleme anında anon anahtarıyla o okumayı yapıyor.
-- ============================================================================

-- ---------------------------------------------------------------- 1) roller

drop policy if exists "favori: kendi adına ekler" on public.favorites;
create policy "favori: kendi adına ekler"
  on public.favorites for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "favori: kendi satırını siler" on public.favorites;
create policy "favori: kendi satırını siler"
  on public.favorites for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "favori: kendi satırlarını görür" on public.favorites;
create policy "favori: kendi satırlarını görür"
  on public.favorites for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "sepet: kendi adına ekler" on public.cart_items;
create policy "sepet: kendi adına ekler"
  on public.cart_items for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "sepet: kendi satırını siler" on public.cart_items;
create policy "sepet: kendi satırını siler"
  on public.cart_items for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "sepet: kendi satırlarını görür" on public.cart_items;
create policy "sepet: kendi satırlarını görür"
  on public.cart_items for select to authenticated
  using (user_id = auth.uid());

-- ------------------------------------------------- 2) yazma yetkisini daralt

do $$
declare
  t record;
  rol text;
  politika_var boolean;
begin
  foreach rol in array array['anon', 'authenticated'] loop
    for t in
      select c.relname
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
       order by c.relname
    loop
      select exists (
        select 1 from pg_policies p
         where p.schemaname = 'public'
           and p.tablename = t.relname
           and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
           and (rol = any(p.roles) or 'public' = any(p.roles))
      ) into politika_var;

      -- Politikası olan tabloya dokunulmaz: orada yetki gerçekten kullanılıyor.
      if not politika_var then
        execute format(
          'revoke insert, update, delete, truncate, references, trigger on table public.%I from %I',
          t.relname, rol
        );
      end if;
    end loop;
  end loop;
end $$;

-- ------------------------------------------- 3) yeni tablolar için varsayılan

alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon;
