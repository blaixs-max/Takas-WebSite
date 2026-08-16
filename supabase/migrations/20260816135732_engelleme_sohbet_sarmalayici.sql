-- Sohbetten engelleme sarmalayıcısı.
-- kullanici_engelleme göçünün hemen ardından ayrı olarak uygulandı.

/**
 * Karşı tarafı sohbet üzerinden engeller.
 *
 * Uygulamanın kullandığı giriş noktası bu. `block_user` karşı tarafın
 * `uuid`'sini istiyor ama sohbet listesi onu taşımıyor — ve taşımamalı:
 * kullanıcı kimliğini istemciye göndermek, engellemek için gerekmeyen bir
 * veriyi dışarı vermek olurdu. Sunucu zaten sohbetin taraflarını biliyor.
 */
create or replace function public.block_conversation_peer(p_conversation_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.conversations; hedef uuid;
begin
  if uid is null then raise exception 'oturum gerekli'; end if;

  select * into c from public.conversations where id = p_conversation_id;
  if not found then raise exception 'sohbet bulunamadi'; end if;
  if uid <> c.buyer_id and uid <> c.seller_id then
    raise exception 'bu sohbetin tarafi degilsiniz';
  end if;

  hedef := case when uid = c.buyer_id then c.seller_id else c.buyer_id end;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (uid, hedef)
  on conflict do nothing;
end $$;

revoke all on function public.block_conversation_peer(uuid) from public;
grant execute on function public.block_conversation_peer(uuid) to authenticated;
