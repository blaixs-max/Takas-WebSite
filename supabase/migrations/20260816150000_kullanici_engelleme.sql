-- ============================================================================
-- Kullanıcı engelleme — App Store 1.2
-- ============================================================================
--
-- Kullanıcı içeriği taşıyan uygulamalardan mağaza **hem bildirme hem
-- engelleme** istiyor. Bizde `report_message` vardı, engelleme yoktu; yani
-- rahatsız eden biriyle karşılaşan kullanıcının tek çaresi bildirip beklemekti.
-- Bildirmek bir moderasyon isteği, engellemek ise anında ve kullanıcının kendi
-- elinde olan bir çözüm. İkisi birbirinin yerine geçmez.
--
-- ## Engelleme neyi durduruyor
--
-- **Mesajı.** `send_message` iki yönü de denetliyor: engelleyen yazamaz,
-- engellenen de yazamaz. Tek yönlü kurulsaydı, engelleyen kişi kendi
-- engellediği kişiden mesaj almaya devam ederdi — yani engelleme işe yaramazdı.
--
-- **Sohbeti gizlemiyor.** `my_conversations` listesi olduğu gibi kalıyor:
-- geçmiş konuşma bir kanıt ve itiraz sürecinde gerekebilir. Gizlemek, kanıtı
-- kullanıcının elinden almak olurdu. Gizlenen şey mesaj kutusu değil, yeni
-- mesaj gelme ihtimali.
--
-- **Takası engellemiyor** — bilinçli. Ticari akışı bloke etmek, açık bir
-- takası olan kişinin karşı tarafı engelleyip iletişimi kesmesine ve sürecin
-- kilitlenmesine yol açardı. Engelleme bir iletişim aracı; ticari korumanın
-- yeri itiraz ve yaptırım merdiveni.
-- ============================================================================

create table if not exists public.user_blocks (
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint kendini_engelleyemez check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id);

alter table public.user_blocks enable row level security;

/* Kullanıcı yalnızca **kendi kurduğu** engelleri görüyor. Engellendiğini
   görebilmek, engelleyeni ifşa etmek olurdu ve engellemenin amacı tam olarak
   temas etmemek. */
drop policy if exists "kendi engellerini görür" on public.user_blocks;
create policy "kendi engellerini görür"
  on public.user_blocks for select to authenticated
  using (blocker_id = auth.uid());

drop policy if exists "kendi adına engeller" on public.user_blocks;
create policy "kendi adına engeller"
  on public.user_blocks for insert to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists "kendi engelini kaldırır" on public.user_blocks;
create policy "kendi engelini kaldırır"
  on public.user_blocks for delete to authenticated
  using (blocker_id = auth.uid());

/* Yetki matrisi kuralı: yeni tablo, yazma politikası olan tablolardandır ve
   `authenticated` yazma yetkisi burada gerçekten kullanılıyor. `anon`ın işi
   yok — 20260816120000_yetki_daraltma.sql'in koyduğu çizgi korunuyor. */
revoke insert, update, delete, truncate, references, trigger
  on table public.user_blocks from anon;
revoke update, truncate, references, trigger
  on table public.user_blocks from authenticated;

-- ------------------------------------------------------------ yardımcılar

create or replace function public.engel_var(p_a uuid, p_b uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_blocks
     where (blocker_id = p_a and blocked_id = p_b)
        or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

revoke all on function public.engel_var(uuid, uuid) from public;

create or replace function public.block_user(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'oturum gerekli'; end if;
  if p_user_id = uid then raise exception 'kendinizi engelleyemezsiniz'; end if;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (uid, p_user_id)
  on conflict do nothing;
end $$;

revoke all on function public.block_user(uuid) from public;
grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.unblock_user(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'oturum gerekli'; end if;
  delete from public.user_blocks where blocker_id = uid and blocked_id = p_user_id;
end $$;

revoke all on function public.unblock_user(uuid) from public;
grant execute on function public.unblock_user(uuid) to authenticated;

-- --------------------------------------------- send_message artık denetliyor

/* Fonksiyonun tamamı yeniden yazılmıyor; yalnızca gönderenin ve alıcının
   arasında engel olup olmadığı, taraf denetiminin hemen ardına ekleniyor.
   Kapı burada olmak zorunda: istemcide tutulan bir engel, istemciyi
   değiştiren biri için hiç yok demektir. */
create or replace function public.send_message(p_conversation_id uuid, p_body text)
returns public.messages
language plpgsql security definer set search_path = public as $$
declare c public.conversations; m public.messages; uid uuid;
        alici uuid; urun text; okunmamis_vardi boolean;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'oturum bulunamadı';
  end if;
  if p_body is null or btrim(p_body) = '' then
    raise exception 'boş mesaj gönderilemez';
  end if;

  select * into c from public.conversations where id = p_conversation_id;
  if not found then
    raise exception 'sohbet bulunamadı';
  end if;
  if uid <> c.buyer_id and uid <> c.seller_id then
    raise exception 'bu sohbetin tarafı değilsiniz';
  end if;

  alici := case when uid = c.buyer_id then c.seller_id else c.buyer_id end;

  -- EKLENEN TEK ŞEY. Gerisi mevcut tanımın birebir aynısı.
  if public.engel_var(uid, alici) then
    raise exception 'engel nedeniyle mesaj gonderilemez';
  end if;

  select exists (select 1 from public.messages x
                  where x.conversation_id = c.id
                    and x.sender_id = uid
                    and x.read_at is null)
    into okunmamis_vardi;

  insert into public.messages (conversation_id, sender_id, body)
  values (c.id, uid, btrim(p_body))
  returning * into m;

  update public.conversations set last_message_at = now() where id = c.id;

  if not okunmamis_vardi then
    select title into urun from public.products where id = c.product_id;
    perform public.notify(alici, 'message.received',
      'Yeni mesajınız var',
      coalesce(urun, 'İlanınız') || ' hakkında bir mesaj aldınız.',
      jsonb_build_object('conversation', c.id, 'product', c.product_id));
  end if;

  return m;
end; $$;

revoke all on function public.send_message(uuid, text) from public;
grant execute on function public.send_message(uuid, text) to authenticated;

-- ------------------------------------------- sohbetten engelleme sarmalayıcı

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
