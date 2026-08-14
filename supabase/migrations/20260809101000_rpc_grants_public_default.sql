-- Bir önceki göç eksik kaldı ve bunu canlıda doğrulayınca gördüm.
--
-- anon/authenticated'a verilen doğrudan yetkiyi kapattım ama PostgreSQL'in
-- KENDİ varsayılanı duruyordu: oluşturulan her fonksiyonun EXECUTE yetkisi
-- PUBLIC sözde-rolüne verilir (proacl'da `=X/postgres`). anon o yetkiyi
-- PUBLIC üyeliğinden alıyordu; yani göçten sonra yazılan my_trade_quote
-- yine anon'a açıktı.
--
-- Doğru kapı bu satır. Diğerleri de kalsın: üçü birden kapalı olmalı.
alter default privileges in schema public revoke execute on functions from public;

revoke execute on function public.my_trade_quote(uuid) from public;
revoke execute on function public.my_trade_quote(uuid) from anon;

drop function if exists public.kt_varsayilan_deneme();
