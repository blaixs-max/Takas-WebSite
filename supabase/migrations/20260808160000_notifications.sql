-- KIDS TRADE — Bildirim kuyruğu
--
-- Sistem şu ana kadar hiçbir şey haber vermiyordu. İlanı onaylandı, ürünü
-- satıldı, kargo bedeli bekleniyor, teslim edildi, 48 saatlik sayaç işliyor,
-- itiraz karara bağlandı — kullanıcı bunların hiçbirini ekranı kendisi
-- açmadan öğrenemiyordu.
--
-- Bu, kurduğumuz sayaçların çoğunu işlevsiz bırakıyor. "48 saat içinde
-- onaylamazsanız puan satıcıya geçer" kuralı, kullanıcı teslimattan haberdar
-- olmadığında bir kural değil bir tuzaktır.
--
-- Tasarım: bildirimi olay üretir, trigger yazar. Uygulama katmanına
-- bırakılsaydı her çağıran yerin hatırlaması gerekirdi ve biri unutulduğunda
-- sessizce kaybolurdu. Durum nereden değişirse değişsin bildirim doğar.

-- ============================ 1) KUYRUK ============================

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  kind       text not null,
  title      text not null,
  body       text not null,
  -- Uygulamanın nereye götüreceğini bilmesi için: {"trade":"...","product":"..."}
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications(user_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "kendi bildirimlerini gör" on public.notifications;
create policy "kendi bildirimlerini gör"
  on public.notifications for select to authenticated using (user_id = auth.uid());

-- Okundu işaretlemek dışında istemci yazamaz; bildirim metnini kullanıcının
-- değiştirebilmesi anlamsız olurdu.
drop policy if exists "kendi bildirimini okundu yap" on public.notifications;
create policy "kendi bildirimini okundu yap"
  on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.notify(
  p_user uuid, p_kind text, p_title text, p_body text, p_data jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, kind, title, body, data)
  values (p_user, p_kind, p_title, p_body, coalesce(p_data, '{}'::jsonb));
end; $$;

-- ============================ 2) OKUNDU ============================

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then
    raise exception 'oturum bulunamadı';
  end if;

  -- p_ids verilmezse hepsi okundu sayılır ("tümünü okundu işaretle").
  update public.notifications
     set read_at = now()
   where user_id = auth.uid()
     and read_at is null
     and (p_ids is null or id = any(p_ids));

  get diagnostics n = row_count;
  return n;
end; $$;

revoke all on function public.mark_notifications_read(uuid[]) from public;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

create or replace function public.unread_notification_count()
returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.notifications
   where user_id = auth.uid() and read_at is null;
$$;

revoke all on function public.unread_notification_count() from public;
grant execute on function public.unread_notification_count() to authenticated;

-- ============================ 3) TAKAS OLAYLARI ============================

create or replace function public.trades_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare urun text;
begin
  select p.title into urun from public.products p where p.id = new.product_id;
  urun := coalesce(urun, 'ürününüz');

  if tg_op = 'INSERT' then
    perform public.notify(new.seller_id, 'trade.created',
      'Ürününüz alındı',
      urun || ' için takas başladı. Alıcı kargo bedelini ödeyince size haber vereceğiz.',
      jsonb_build_object('trade', new.id));
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  case new.status
    when 'SHIPPED' then
      perform public.notify(new.seller_id, 'trade.shipped',
        'Kargoya verme zamanı',
        'Kargo bedeli ödendi. ' || urun || ' ürününü üç gün içinde şubeye bırakın.',
        jsonb_build_object('trade', new.id));
      perform public.notify(new.buyer_id, 'trade.shipped',
        'Ödemeniz alındı',
        'Satıcıya bildirildi. ' || urun || ' yola çıkınca takip edebilirsiniz.',
        jsonb_build_object('trade', new.id));

    when 'DELIVERED' then
      -- Sayacın anlamlı olması buna bağlı: teslimattan habersiz kullanıcı için
      -- 48 saat bir kural değil tuzaktır.
      perform public.notify(new.buyer_id, 'trade.delivered',
        'Teslim edildi — onayınızı bekliyoruz',
        urun || ' elinize ulaştıysa onaylayın. 48 saat içinde onaylamazsanız puan satıcıya otomatik geçer.',
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
      perform public.notify(new.buyer_id, 'trade.refunded',
        'Puanınız iade edildi',
        new.points || ' puan hesabınıza geri döndü.',
        jsonb_build_object('trade', new.id));
      perform public.notify(new.seller_id, 'trade.refunded',
        'Takas iptal edildi',
        urun || ' için açılan takas kapandı, ilan yeniden vitrinde.',
        jsonb_build_object('trade', new.id));

    else
      null;
  end case;

  return new;
end; $$;

drop trigger if exists trades_notify_trg on public.trades;
create trigger trades_notify_trg
  after insert or update on public.trades
  for each row execute function public.trades_notify();

-- ============================ 4) İLAN VE KARE OLAYLARI ============================

create or replace function public.products_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'ACTIVE' and old.status = 'DRAFT' then
    perform public.notify(new.seller_id, 'listing.published',
      'İlanınız yayında',
      new.title || ' vitrinde görünüyor.',
      jsonb_build_object('product', new.id));
  end if;
  return new;
end; $$;

drop trigger if exists products_notify_trg on public.products;
create trigger products_notify_trg
  after update on public.products
  for each row execute function public.products_notify();

-- Reddedilen kare kullanıcıya söylenmezse ilan sonsuza kadar taslakta kalır.
create or replace function public.photos_notify()
returns trigger language plpgsql security definer set search_path = public as $$
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
    jsonb_build_object('product', new.product_id, 'photo', new.id));
  return new;
end; $$;

drop trigger if exists photos_notify_trg on public.product_photos;
create trigger photos_notify_trg
  after update on public.product_photos
  for each row execute function public.photos_notify();

-- ============================ 5) İTİRAZ OLAYLARI ============================

create or replace function public.disputes_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare t public.trades;
begin
  select * into t from public.trades where id = new.trade_id;

  if tg_op = 'INSERT' then
    -- Satıcının savunma hakkı var; haberi olmadan kullanamaz.
    perform public.notify(t.seller_id, 'dispute.opened',
      'Alıcı bir sorun bildirdi',
      'Talebe kanıt ekleyebilirsiniz. Karar iki tarafın kanıtına bakılarak verilir.',
      jsonb_build_object('trade', new.trade_id, 'dispute', new.id));
    return new;
  end if;

  if new.status not in ('RESOLVED','REJECTED')
     or old.status = new.status then
    return new;
  end if;

  if new.status = 'REJECTED' then
    perform public.notify(t.buyer_id, 'dispute.rejected',
      'Talebiniz kabul edilmedi',
      coalesce(new.decision_note, 'Talep değerlendirildi.') ||
        ' Onay sayacı kaldığı yerden devam ediyor.',
      jsonb_build_object('trade', new.trade_id, 'dispute', new.id));
    perform public.notify(t.seller_id, 'dispute.rejected',
      'İtiraz kapandı',
      'Talep reddedildi, takas kaldığı yerden devam ediyor.',
      jsonb_build_object('trade', new.trade_id, 'dispute', new.id));
  else
    perform public.notify(t.buyer_id, 'dispute.resolved',
      'İadeniz onaylandı',
      'Puanınız hesabınıza geri döndü.',
      jsonb_build_object('trade', new.trade_id, 'dispute', new.id));
    perform public.notify(t.seller_id, 'dispute.resolved',
      'İade kararı verildi',
      case when new.resolution = 'REFUND_RETURN'
           then 'Ürün size geri gönderilecek; iade kargosu hesabınıza borç yazıldı.'
           else 'Alıcıya iade yapıldı, ürün alıcıda kalıyor.' end,
      jsonb_build_object('trade', new.trade_id, 'dispute', new.id));
  end if;

  return new;
end; $$;

drop trigger if exists disputes_notify_trg on public.disputes;
create trigger disputes_notify_trg
  after insert or update on public.disputes
  for each row execute function public.disputes_notify();

-- ============================ 6) KAMPANYA ============================

create or replace function public.campaign_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.user_id, 'campaign.granted',
    new.points || ' kampanya puanı hesabınızda',
    case new.kind
      when 'FIRST_LISTING' then 'İlk ilanınız yayına girdiği için verildi. Artık takas yapabilirsiniz.'
      else 'İlk satışınızı tamamladığınız için verildi.' end,
    jsonb_build_object('kind', new.kind));
  return new;
end; $$;

drop trigger if exists campaign_notify_trg on public.campaign_grants;
create trigger campaign_notify_trg
  after insert on public.campaign_grants
  for each row execute function public.campaign_notify();
