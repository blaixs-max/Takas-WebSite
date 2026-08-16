-- PostgreSQL, oluşturulan her fonksiyonun EXECUTE yetkisini PUBLIC'e verir ve
-- bu yerleşik davranış `alter default privileges ... revoke ... from public`
-- ile kapanmıyor (canlıda iki kez denendi, iki kez de yeni fonksiyon
-- `=X/postgres` ile doğdu). Bu yüzden tek güvenilir yol AÇIK revoke'tur:
-- fonksiyon oluşturan her göç, revoke'u SON adım olarak yazar.

drop function if exists public.kt_varsayilan_deneme2();
drop function if exists public.kt_probe3();

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from authenticated;

-- Whitelist yeniden verilir (revoke hepsini aldı).
grant execute on function public.create_listing(text, text, text, text, integer, text, text, boolean, boolean) to authenticated;
grant execute on function public.publish_listing(text, public.photo_slot) to authenticated;
grant execute on function public.set_product_points(text, integer) to authenticated;
grant execute on function public.create_trade(text, uuid) to authenticated;
grant execute on function public.cancel_trade(uuid) to authenticated;
grant execute on function public.confirm_delivery(uuid) to authenticated;
grant execute on function public.my_trade_quote(uuid) to authenticated;
grant execute on function public.open_dispute(uuid, text) to authenticated;
grant execute on function public.add_dispute_evidence(uuid, text, text) to authenticated;
grant execute on function public.start_conversation(text) to authenticated;
grant execute on function public.send_message(uuid, text) to authenticated;
grant execute on function public.my_conversations() to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.report_message(uuid, text, text) to authenticated;
grant execute on function public.unread_notification_count() to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.profile_stats() to authenticated;
grant execute on function public.my_sanction() to authenticated;
grant execute on function public.campaign_status() to authenticated;
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

grant execute on all functions in schema public to service_role;
