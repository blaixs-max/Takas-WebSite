-- KIDS TRADE — Alıcı–satıcı mesajlaşması
--
-- Sohbet ekranları sabit metinlerle doluydu; iki kullanıcı birbirine tek kelime
-- yazamıyordu. Bunun bedeli yalnızca eksik özellik değil: itiraza giden
-- sorunların çoğu ("kutusu var mı", "şu çizik ne kadar derin", "kargoyu ne
-- zaman verirsin") konuşularak çözülür. Konuşma kanalı olmayan bir pazaryeri,
-- çözülebilecek soruları uyuşmazlığa dönüştürür.
--
-- Sohbet ÜRÜNE bağlıdır, takasa değil: alıcının satın almadan ÖNCE soru
-- sorabilmesi gerekiyor. Takas açıldığında aynı sohbet devam eder.

-- ============================ 1) SOHBET ============================

create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  product_id      text not null references public.products(id) on delete cascade,
  buyer_id        uuid not null,
  seller_id       uuid not null,
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  constraint conversations_taraflar_farkli check (buyer_id <> seller_id),
  -- Bir alıcı bir ürün için tek sohbet açar; ikinci "merhaba" aynı yere düşer.
  constraint conversations_tek_sohbet unique (product_id, buyer_id)
);

create index if not exists conversations_buyer_idx
  on public.conversations(buyer_id, last_message_at desc nulls last);
create index if not exists conversations_seller_idx
  on public.conversations(seller_id, last_message_at desc nulls last);

alter table public.conversations enable row level security;

drop policy if exists "taraf olduğun sohbeti gör" on public.conversations;
create policy "taraf olduğun sohbeti gör"
  on public.conversations for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid());

-- ============================ 2) MESAJ ============================

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null,
  body            text not null check (btrim(body) <> '' and length(body) <= 2000),
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on public.messages(conversation_id, created_at);

alter table public.messages enable row level security;

drop policy if exists "taraf olduğun mesajları gör" on public.messages;
create policy "taraf olduğun mesajları gör"
  on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c
                  where c.id = messages.conversation_id
                    and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())));

-- Yazma yalnızca send_message() ile: last_message_at'ı güncel tutmak ve
-- bildirimi tetiklemek tek yerde olmalı.

-- Gönderilmiş mesaj değiştirilemez ve silinemez. Uyuşmazlıkta konuşma kaydı
-- kanıttır; sonradan düzenlenebilen bir kanıt kanıt değildir.
create or replace function public.messages_degismez()
returns trigger language plpgsql as $$
begin
  -- read_at güncellemesine izin var; gövdeye dokunulamaz.
  if tg_op = 'DELETE' then
    raise exception 'mesaj silinemez';
  end if;
  if new.body is distinct from old.body or new.sender_id is distinct from old.sender_id then
    raise exception 'gönderilmiş mesaj değiştirilemez';
  end if;
  return new;
end; $$;

drop trigger if exists messages_no_edit on public.messages;
create trigger messages_no_edit before update or delete on public.messages
  for each row execute function public.messages_degismez();

-- Okundu işaretlemek için istemciye dar bir kapı: yalnızca KARŞI TARAFIN
-- mesajını okundu yapabilir, kendi mesajını değil.
drop policy if exists "karşı tarafın mesajını okundu yap" on public.messages;
create policy "karşı tarafın mesajını okundu yap"
  on public.messages for update to authenticated
  using (sender_id <> auth.uid()
         and exists (select 1 from public.conversations c
                      where c.id = messages.conversation_id
                        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())))
  with check (sender_id <> auth.uid());

-- ============================ 3) SOHBET AÇMA ============================

create or replace function public.start_conversation(p_product_id text)
returns public.conversations
language plpgsql security definer set search_path = public as $$
declare p public.products; c public.conversations; uid uuid;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'oturum bulunamadı';
  end if;

  select * into p from public.products where id = p_product_id;
  if not found then
    raise exception 'ilan bulunamadı';
  end if;
  if p.seller_id is null then
    raise exception 'ilanın satıcısı yok';
  end if;
  if p.seller_id = uid then
    raise exception 'kendi ilanınıza mesaj gönderemezsiniz';
  end if;
  if p.status = 'DRAFT' then
    -- Taslak ilan henüz kimseye görünmüyor; sohbeti de olmamalı.
    raise exception 'bu ilan henüz yayında değil';
  end if;

  insert into public.conversations (product_id, buyer_id, seller_id)
  values (p.id, uid, p.seller_id)
  on conflict (product_id, buyer_id) do update set product_id = excluded.product_id
  returning * into c;

  return c;
end; $$;

revoke all on function public.start_conversation(text) from public;
grant execute on function public.start_conversation(text) to authenticated;

-- ============================ 4) MESAJ GÖNDERME ============================

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

  -- Bildirim kararı mesajı yazmadan ÖNCE alınır: karşı tarafın okunmamış
  -- mesajı zaten varsa ikinci bir bildirim göndermeyiz. Her mesaja bildirim
  -- göndermek, bildirimleri kapattırmanın en hızlı yoludur.
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

-- ============================ 5) OKUNDU ============================

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer; uid uuid;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'oturum bulunamadı';
  end if;

  update public.messages m
     set read_at = now()
   where m.conversation_id = p_conversation_id
     and m.sender_id <> uid
     and m.read_at is null
     and exists (select 1 from public.conversations c
                  where c.id = p_conversation_id
                    and (c.buyer_id = uid or c.seller_id = uid));

  get diagnostics n = row_count;
  return n;
end; $$;

revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- ============================ 6) SOHBET LİSTESİ ============================

create or replace function public.my_conversations()
returns table (
  conversation_id uuid,
  product_id      text,
  product_title   text,
  karsi_taraf     text,
  ben_aliciyim    boolean,
  son_mesaj       text,
  son_mesaj_at    timestamptz,
  okunmamis       integer
)
language sql stable security definer set search_path = public as $$
  select c.id, c.product_id, p.title,
         case when c.buyer_id = auth.uid()
              then coalesce(p.seller_name, 'Satıcı')
              -- Alıcının adı ürün satırında tutulmuyor; baş harfleri de yok.
              -- Satıcıya "Alıcı" diyoruz: uydurma bir isim göstermektense.
              else 'Alıcı' end,
         c.buyer_id = auth.uid(),
         (select m.body from public.messages m
           where m.conversation_id = c.id order by m.created_at desc limit 1),
         c.last_message_at,
         (select count(*)::integer from public.messages m
           where m.conversation_id = c.id
             and m.sender_id <> auth.uid() and m.read_at is null)
    from public.conversations c
    left join public.products p on p.id = c.product_id
   where auth.uid() is not null
     and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
   order by c.last_message_at desc nulls last;
$$;

revoke all on function public.my_conversations() from public;
grant execute on function public.my_conversations() to authenticated;

-- ============================ 7) GERÇEK ZAMANLI ============================
-- Realtime yayını yoksa uygulama yine çalışır, yalnızca yeni mesaj için
-- ekranın tazelenmesi gerekir. Yerel test veri tabanında bu yayın yok.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
    raise notice '[messaging] realtime yayınına eklendi';
  else
    raise notice '[messaging] supabase_realtime yayını yok — atlandı (yerel ortam)';
  end if;
exception when duplicate_object then
  raise notice '[messaging] realtime yayınında zaten var';
end $$;
