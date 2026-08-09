-- KIDS TRADE — Mesaj şikâyeti ve moderasyonu
--
-- Sohbet açıldı ve içeriğine bakan kimse yoktu. İki risk vardı:
--
--   1. Taciz ve uygunsuz içerik. Platformda çocuk ürünü satan ebeveynler
--      konuşuyor; şikâyet edecek bir düğme olmaması kabul edilemez.
--   2. Platform dışına çıkarma. "Telefonumu vereyim, elden halledelim" demek
--      yalnızca komisyon kaybı değil: emanet devre dışı kalır, alıcının parası
--      korumasız kalır ve uyuşmazlık hâlinde elimizde hiçbir kayıt olmaz.
--
-- İkinci risk için sistem otomatik işaret bırakır ama MESAJI ENGELLEMEZ.
-- Engellemek yanlış olurdu: "0-3 yaş" ya da bir model numarası da rakam
-- dizisidir ve masum bir cümleyi durdurmak, kullanıcıyı gerçekten başka bir
-- kanala iter. İşaret insana bakılacak bir kuyruk üretir, o kadar.

-- ============================ 1) ŞİKÂYET KAYDI ============================

create table if not exists public.message_reports (
  id              uuid primary key default gen_random_uuid(),
  message_id      uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  -- null ise şikâyeti sistem açtı (otomatik işaret).
  reported_by     uuid,
  reason          text not null check (reason in
                    ('HARASSMENT','OFF_PLATFORM','SCAM','INAPPROPRIATE','OTHER')),
  note            text,
  status          text not null default 'OPEN'
                    check (status in ('OPEN','ACTIONED','DISMISSED')),
  reviewed_by     uuid,
  decision_note   text,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- Aynı kişi aynı mesajı iki kez şikâyet etmesin; sistem işareti de tek olsun.
create unique index if not exists message_reports_tek_sikayet_uidx
  on public.message_reports(message_id, coalesce(reported_by, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists message_reports_open_idx
  on public.message_reports(created_at) where status = 'OPEN';

alter table public.message_reports enable row level security;

drop policy if exists "kendi şikâyetini gör" on public.message_reports;
create policy "kendi şikâyetini gör"
  on public.message_reports for select to authenticated
  using (reported_by = auth.uid());

drop policy if exists "yönetici şikâyetleri görür" on public.message_reports;
create policy "yönetici şikâyetleri görür"
  on public.message_reports for select to authenticated using (public.is_admin());

-- ============================ 2) KULLANICI ŞİKÂYETİ ============================

create or replace function public.report_message(
  p_message_id uuid, p_reason text, p_note text default null
)
returns public.message_reports
language plpgsql security definer set search_path = public as $$
declare m public.messages; c public.conversations; r public.message_reports; uid uuid;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'oturum bulunamadı';
  end if;

  select * into m from public.messages where id = p_message_id;
  if not found then
    raise exception 'mesaj bulunamadı';
  end if;
  if m.sender_id = uid then
    raise exception 'kendi mesajınızı şikâyet edemezsiniz';
  end if;

  select * into c from public.conversations where id = m.conversation_id;
  if uid <> c.buyer_id and uid <> c.seller_id then
    raise exception 'bu sohbetin tarafı değilsiniz';
  end if;

  insert into public.message_reports (message_id, conversation_id, reported_by, reason, note)
  values (m.id, c.id, uid, p_reason, p_note)
  -- Aynı mesajı ikinci kez şikâyet etmek hata değil; kayıt zaten var.
  on conflict do nothing
  returning * into r;

  if r.id is null then
    select * into r from public.message_reports
     where message_id = m.id and reported_by = uid;
  end if;

  return r;
end; $$;

revoke all on function public.report_message(uuid, text, text) from public;
grant execute on function public.report_message(uuid, text, text) to authenticated;

-- ============================ 3) OTOMATİK İŞARET ============================
-- Platform dışına çıkarma girişimini yakalar. ENGELLEMEZ, yalnızca işaretler.
-- Desenler bilinçli olarak dar tutuldu: yanlış pozitif, insan kuyruğunu şişirip
-- gerçek şikâyetlerin arasında kaybolmasına yol açar.

create or replace function public.messages_flag_off_platform()
returns trigger language plpgsql security definer set search_path = public as $$
declare temiz text; supheli boolean := false;
begin
  -- Rakamların arasındaki boşluk ve ayraçları atarak bakıyoruz: "0532 111 22 33"
  -- ile "05321112233" aynı şeydir.
  temiz := regexp_replace(new.body, '[\s\-\(\)\./]', '', 'g');

  -- Türkiye cep telefonu: 05xxxxxxxxx ya da +905xxxxxxxxx
  if temiz ~ '(\+?90)?0?5[0-9]{9}' then
    supheli := true;
  end if;

  -- IBAN: TR + 24 rakam
  if temiz ~* 'TR[0-9]{24}' then
    supheli := true;
  end if;

  if not supheli then
    return new;
  end if;

  insert into public.message_reports
    (message_id, conversation_id, reported_by, reason, note)
  values (new.id, new.conversation_id, null, 'OFF_PLATFORM',
          'Sistem işareti: mesaj telefon numarası veya IBAN içeriyor olabilir')
  on conflict do nothing;

  return new;
end; $$;

drop trigger if exists messages_flag_trg on public.messages;
create trigger messages_flag_trg
  after insert on public.messages
  for each row execute function public.messages_flag_off_platform();

-- ============================ 4) YÖNETİM KUYRUĞU ============================

create or replace function public.admin_report_queue(p_limit integer default 50)
returns table (
  report_id     uuid,
  message_id    uuid,
  reason        text,
  note          text,
  sistem_isareti boolean,
  mesaj         text,
  gonderen      uuid,
  urun          text,
  bekleme_saati numeric
)
language sql stable security definer set search_path = public as $$
  select r.id, r.message_id, r.reason, r.note, r.reported_by is null,
         m.body, m.sender_id, p.title,
         round(extract(epoch from (now() - r.created_at)) / 3600.0, 1)
    from public.message_reports r
    join public.messages m on m.id = r.message_id
    join public.conversations c on c.id = r.conversation_id
    left join public.products p on p.id = c.product_id
   where public.is_admin() and r.status = 'OPEN'
   order by
     -- Kullanıcı şikâyeti sistem işaretinden önce gelir: birinin canı sıkılmış.
     (r.reported_by is null), r.created_at
   limit greatest(p_limit, 1);
$$;

revoke all on function public.admin_report_queue(integer) from public;
grant execute on function public.admin_report_queue(integer) to authenticated;
grant execute on function public.admin_report_queue(integer) to service_role;

create or replace function public.admin_resolve_report(
  p_report_id uuid, p_ihlal boolean, p_not text
)
returns public.message_reports
language plpgsql security definer set search_path = public as $$
declare r public.message_reports; m public.messages;
begin
  if not public.is_admin() then
    raise exception 'bu işlem için yönetici yetkisi gerekir';
  end if;
  if p_not is null or btrim(p_not) = '' then
    raise exception 'karar gerekçesi zorunludur';
  end if;

  select * into r from public.message_reports where id = p_report_id for update;
  if not found then
    raise exception 'şikâyet bulunamadı';
  end if;
  if r.status <> 'OPEN' then
    raise exception 'şikâyet zaten sonuçlanmış (%)', r.status;
  end if;

  select * into m from public.messages where id = r.message_id;

  update public.message_reports
     set status = case when p_ihlal then 'ACTIONED' else 'DISMISSED' end,
         reviewed_by = auth.uid(), decision_note = btrim(p_not), reviewed_at = now()
   where id = r.id
  returning * into r;

  perform public.audit(
    case when p_ihlal then 'message.actioned' else 'message.dismissed' end,
    'report:' || r.id::text,
    jsonb_build_object('message', r.message_id, 'reason', r.reason,
                       'gonderen', m.sender_id, 'not', btrim(p_not)));

  if p_ihlal then
    -- Mesaj silinmiyor: uyuşmazlıkta kayıt kanıttır. Sonuç, gönderenin güven
    -- skoruna ve yaptırım merdivenine yazılır.
    perform public.notify(m.sender_id, 'message.actioned',
      'Bir mesajınız kurallara aykırı bulundu',
      btrim(p_not) || ' Tekrarı hesabınızın kısıtlanmasına yol açabilir.',
      jsonb_build_object('conversation', r.conversation_id));
  end if;

  if r.reported_by is not null then
    perform public.notify(r.reported_by,
      case when p_ihlal then 'report.actioned' else 'report.dismissed' end,
      'Şikâyetiniz sonuçlandı',
      case when p_ihlal
           then 'Bildirdiğiniz mesaj kurallara aykırı bulundu, gerekli işlem yapıldı.'
           else 'Bildirdiğiniz mesajda kural ihlali bulunamadı.' end,
      jsonb_build_object('conversation', r.conversation_id));
  end if;

  return r;
end; $$;

revoke all on function public.admin_resolve_report(uuid, boolean, text) from public;
grant execute on function public.admin_resolve_report(uuid, boolean, text) to authenticated;
grant execute on function public.admin_resolve_report(uuid, boolean, text) to service_role;

-- ============================ 5) GÜVEN SKORUNA BAĞLA ============================
-- Ayrı bir ceza sistemi kurmak yerine var olana ekliyoruz: kullanıcının tek bir
-- güven skoru olmalı, mesaj ihlali de onu etkilemeli (Ana Doküman 5.5).

alter table public.trust_penalties
  add column if not exists mesaj_ihlali integer;

update public.trust_penalties set mesaj_ihlali = coalesce(mesaj_ihlali, 20) where id;
alter table public.trust_penalties alter column mesaj_ihlali set not null;

-- Dönüş tipi değişiyor; önce düşürülmeli.
drop function if exists public.profile_stats();
drop function if exists public.user_trust(uuid);

create or replace function public.user_trust(p_user uuid)
returns table (
  skor            integer,
  islem_sayisi    integer,
  ayipli_satis    integer,
  asilsiz_talep   integer,
  odenmemis_borc  integer,
  gec_kargo       integer,
  mesaj_ihlali    integer
)
language plpgsql stable security definer set search_path = public as $$
declare c public.trust_penalties; ceza integer;
begin
  select * into c from public.trust_penalties where id;

  select count(*)::integer into islem_sayisi
    from public.trades t
   where t.status = 'COMPLETED' and (t.buyer_id = p_user or t.seller_id = p_user);

  select count(*)::integer into ayipli_satis
    from public.disputes d join public.trades t on t.id = d.trade_id
   where t.seller_id = p_user and d.status = 'RESOLVED';

  select count(*)::integer into asilsiz_talep
    from public.disputes d
   where d.opened_by = p_user and d.status = 'REJECTED';

  select count(*)::integer into odenmemis_borc
    from public.seller_debts s
   where s.seller_id = p_user and s.status = 'OPEN';

  select count(*)::integer into gec_kargo
    from public.trades t
    join public.wallet_entries w on w.trade_id = t.id
   where t.seller_id = p_user
     and t.status = 'REFUNDED'
     and w.type = 'REFUND'
     and w.memo like '%süresinde kargoya vermedi%';

  -- Yalnızca ONAYLANMIŞ ihlaller sayılır. Açık bir şikâyet suçlama değildir;
  -- şikâyet edilmekle skoru düşseydi, şikâyet bir silaha dönüşürdü.
  select count(*)::integer into mesaj_ihlali
    from public.message_reports r join public.messages m on m.id = r.message_id
   where m.sender_id = p_user and r.status = 'ACTIONED';

  if islem_sayisi < c.min_islem and mesaj_ihlali = 0 then
    skor := null;
    return next;
    return;
  end if;

  ceza := ayipli_satis * c.ayipli_satis
        + asilsiz_talep * c.asilsiz_talep
        + odenmemis_borc * c.odenmemis_borc
        + gec_kargo * c.gec_kargo
        + mesaj_ihlali * c.mesaj_ihlali;

  skor := greatest(0, 100 - ceza);
  return next;
end; $$;

revoke all on function public.user_trust(uuid) from public;
grant execute on function public.user_trust(uuid) to authenticated;
grant execute on function public.user_trust(uuid) to service_role;

create or replace function public.profile_stats()
returns table (
  available_points integer,
  held_points      integer,
  basarili_takas   integer,
  aktif_takas      integer,
  yayindaki_ilan   integer,
  satilan_ilan     integer,
  trust_skor       integer,
  trust_islem      integer,
  ayipli_satis     integer,
  asilsiz_talep    integer,
  odenmemis_borc   integer,
  gec_kargo        integer,
  mesaj_ihlali     integer
)
language plpgsql stable security definer set search_path = public as $$
declare uid uuid; t record;
begin
  uid := auth.uid();
  if uid is null then
    return;
  end if;

  select coalesce(w.available_points, 0), coalesce(w.held_points, 0)
    into available_points, held_points
    from public.wallets w where w.user_id = uid;
  available_points := coalesce(available_points, 0);
  held_points      := coalesce(held_points, 0);

  select count(*)::integer into basarili_takas
    from public.trades tr
   where tr.status = 'COMPLETED' and (tr.buyer_id = uid or tr.seller_id = uid);

  select count(*)::integer into aktif_takas
    from public.trades tr
   where (tr.buyer_id = uid or tr.seller_id = uid)
     and tr.status in ('CREATED','POINTS_HELD','SHIPPED','DELIVERED','DISPUTED');

  select count(*)::integer into yayindaki_ilan
    from public.products p where p.seller_id = uid and p.status = 'ACTIVE';

  select count(*)::integer into satilan_ilan
    from public.products p where p.seller_id = uid and p.status = 'SOLD';

  select * into t from public.user_trust(uid);
  trust_skor     := t.skor;
  trust_islem    := t.islem_sayisi;
  ayipli_satis   := t.ayipli_satis;
  asilsiz_talep  := t.asilsiz_talep;
  odenmemis_borc := t.odenmemis_borc;
  gec_kargo      := t.gec_kargo;
  mesaj_ihlali   := t.mesaj_ihlali;

  return next;
end; $$;

revoke all on function public.profile_stats() from public;
grant execute on function public.profile_stats() to authenticated;
