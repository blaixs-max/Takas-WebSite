-- KIDS TRADE — Güven skoru ve profil istatistikleri
--
-- Profil ekranı dört sayı gösteriyordu ve dördü de sabitti: güven skoru 96,
-- 38 başarılı takas, 1.260 puan, 4.9 değerlendirme. Hiçbiri gerçek değildi.
--
-- Bu, bildirim rozetindeki "3" ile aynı hata: kullanıcıya yalan söyleyen bir
-- sayı, kısa sürede tüm ekranın güvenilirliğini götürür.
--
-- İki karar:
--
--   1. DEĞERLENDİRME KALDIRILDI. Yıldız puanı diye bir sistem yok; 4,9 yazmak
--      uydurmaktı. Yerine gerçekten sayabildiğimiz bir şey konuyor.
--   2. SKORU OLMAYANA SKOR GÖSTERİLMEZ. Hiç takas yapmamış kullanıcının güven
--      skoru yoktur; 100 yazmak da 96 yazmak kadar uydurmadır. null döner ve
--      arayüz "henüz yeterli işlem yok" der.

-- ============================ 1) GÜVEN SKORU ============================
-- Ana Doküman 5.5'teki yaptırım merdiveninin dayanağı. Skor 100'den başlar ve
-- gerçekleşmiş olaylarla düşer; "iyi davranış" ödülü yoktur, çünkü ödül
-- verilecek bir ölçüt tanımlanmadı. Ceza kalemlerinin hepsi kayıtlı olaylardır.

create table if not exists public.trust_penalties (
  id          boolean primary key default true check (id),
  ayipli_satis    integer not null,   -- kabul edilen iade: satıcı ayıplı ürün gönderdi
  asilsiz_talep   integer not null,   -- reddedilen iade talebi: alıcı asılsız talep açtı
  odenmemis_borc  integer not null,   -- açık satıcı borcu
  gec_kargo       integer not null,   -- şube süresi doldu, takas iade edildi
  min_islem       integer not null,   -- bu sayıdan az işlemi olanın skoru YOKTUR
  updated_at  timestamptz not null default now()
);

insert into public.trust_penalties
  (id, ayipli_satis, asilsiz_talep, odenmemis_borc, gec_kargo, min_islem)
values (true, 15, 10, 10, 15, 1)
on conflict (id) do update set
  ayipli_satis   = excluded.ayipli_satis,
  asilsiz_talep  = excluded.asilsiz_talep,
  odenmemis_borc = excluded.odenmemis_borc,
  gec_kargo      = excluded.gec_kargo,
  min_islem      = excluded.min_islem,
  updated_at     = now();

alter table public.trust_penalties enable row level security;
drop policy if exists "ceza tablosu herkese açık" on public.trust_penalties;
create policy "ceza tablosu herkese açık"
  on public.trust_penalties for select to anon, authenticated using (true);

/*
 * Güven skoru ve gerekçesi.
 *
 * Skoru gerekçesiyle birlikte döndürüyoruz: "skorunuz 70" demek, nedenini
 * söylemeden, kullanıcıya davranışını düzeltme imkânı vermez ve itiraz
 * kapısını da kapatır.
 */
create or replace function public.user_trust(p_user uuid)
returns table (
  skor            integer,
  islem_sayisi    integer,
  ayipli_satis    integer,
  asilsiz_talep   integer,
  odenmemis_borc  integer,
  gec_kargo       integer
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

  -- Şube süresi dolduğu için iade edilen takaslar: satıcı ürünü zamanında
  -- kargoya vermemiş demektir.
  select count(*)::integer into gec_kargo
    from public.trades t
    join public.wallet_entries w on w.trade_id = t.id
   where t.seller_id = p_user
     and t.status = 'REFUNDED'
     and w.type = 'REFUND'
     and w.memo like '%süresinde kargoya vermedi%';

  -- Yeterli işlemi olmayanın skoru yoktur. Uydurulmuş bir 100, uydurulmuş bir
  -- 96 kadar yanlıştır.
  if islem_sayisi < c.min_islem then
    skor := null;
    return next;
    return;
  end if;

  ceza := ayipli_satis * c.ayipli_satis
        + asilsiz_talep * c.asilsiz_talep
        + odenmemis_borc * c.odenmemis_borc
        + gec_kargo * c.gec_kargo;

  skor := greatest(0, 100 - ceza);
  return next;
end; $$;

revoke all on function public.user_trust(uuid) from public;
grant execute on function public.user_trust(uuid) to authenticated;
grant execute on function public.user_trust(uuid) to service_role;

-- ============================ 2) PROFİL İSTATİSTİKLERİ ============================

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
  gec_kargo        integer
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

  -- Süren takaslar: kullanıcıdan bir şey bekleyenler.
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

  return next;
end; $$;

revoke all on function public.profile_stats() from public;
grant execute on function public.profile_stats() to authenticated;

-- ============================ 3) SATICININ GÜVEN SKORU VİTRİNDE ============================
-- Alıcının satıcıyı değerlendirebilmesi için skoru ilan üzerinde görebilmesi
-- gerekiyor. Ceza kırılımı BAŞKASINA GÖSTERİLMEZ: satıcının kaç itiraz
-- yaşadığı onun bilgisidir, alıcıya düşen tek şey özet skordur.

create or replace function public.seller_trust_score(p_seller uuid)
returns integer
language sql stable security definer set search_path = public as $$
  select skor from public.user_trust(p_seller);
$$;

revoke all on function public.seller_trust_score(uuid) from public;
grant execute on function public.seller_trust_score(uuid) to anon;
grant execute on function public.seller_trust_score(uuid) to authenticated;
