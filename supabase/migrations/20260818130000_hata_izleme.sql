/**
 * Hata izleme — uygulamadaki çökmeler bir yere yazılıyor.
 *
 * Bugüne kadar canlıdaki bir JS çökmesinden **hiç haberimiz olmuyordu.**
 * Mobil tarafta ne hata sınırı (`ErrorBoundary`) ne de küresel yakalayıcı
 * vardı: ekran beyaza düşüyor, kullanıcı uygulamayı kapatıyor, biz bir şey
 * görmüyoruz. Kullanıcı da anlatamıyor — "açılmadı" diyor.
 *
 * ## Neden Sentry değil
 *
 * Sentry doğru araç ama **bugün kurulamıyor**: `@sentry/react-native` bir
 * native modül ve uygulama Expo Go'dan çalışıyor. Development build'e geçmek
 * kapsam dışı bırakıldı (kullanıcı kararı).
 *
 * Bu tablo o boşluğu dolduruyor ve Sentry'nin yerini almıyor. EAS build
 * yapıldığında Sentry eklenecek; o gün bu tablo yedek olarak kalabilir —
 * istemci tarafı (`lib/hatalar.ts`) tek dosya, hedefi değiştirmek orayı
 * değiştirmek demek.
 *
 * ## Kişisel veri sınırı
 *
 * Yığın izi (stack trace) ve ekran adı yazılıyor; **kullanıcının girdiği
 * hiçbir metin yazılmıyor.** Hata mesajı bazen kullanıcı verisi taşır
 * ("'Zeynep Demir' bulunamadı" gibi) ve bunu ayıklamanın güvenilir bir yolu
 * yok; o yüzden mesaj **2 KB'a kırpılıyor** ve `ek` alanına ne konacağına
 * çağıran yer karar veriyor — oraya serbestçe veri dökülmüyor.
 *
 * `user_id` **null olabilir**: giriş ekranındaki bir çökme de kaydedilmeli ve
 * orada oturum yok.
 */

create table if not exists public.client_errors (
  id         bigserial primary key,
  user_id    uuid references auth.users(id) on delete set null,
  /* Hangi platform — aynı hata iOS'ta olup Android'de olmayabilir ve bu
     ayrım genelde sebebin kendisi. */
  platform   text not null check (platform in ('ios', 'android', 'web', 'bilinmiyor')),
  surum      text,
  /* Hatanın olduğu ekran (rota). Gruplamanın omurgası: "product/[id] altı
     çökme" ile "listing-photos altı çökme" iki ayrı iş. */
  ekran      text,
  mesaj      text not null check (btrim(mesaj) <> ''),
  yigin      text,
  /* Çağıranın bilerek eklediği bağlam. Serbest ama küçük tutuluyor. */
  ek         jsonb,
  /* Aynı hatayı yüz kez almak yüz satır olmamalı; parmak izi tekrarları
     birleştiriyor. */
  parmak_izi text not null,
  tekrar     integer not null default 1,
  ilk_at     timestamptz not null default now(),
  son_at     timestamptz not null default now(),
  /* Bakıldı mı — panelde "yeni" ile "biliyoruz"u ayırmak için. */
  goruldu    boolean not null default false
);

create unique index if not exists client_errors_parmak_uidx
  on public.client_errors(parmak_izi);
create index if not exists client_errors_son_idx
  on public.client_errors(son_at desc);

alter table public.client_errors enable row level security;

/* Politika YOK = her satır süzülür; okuma yalnızca `security definer`
   fonksiyon üzerinden ve yalnızca yöneticiye. Kullanıcının kendi hata
   kaydını görmesinin bir faydası yok — orada onun işine yarayan bir bilgi
   değil, bizim işimize yarayan bir yığın izi var.

   Yetki de geri alınıyor, RLS'e güvenilmiyor: Supabase yeni tabloya
   varsayılan olarak SELECT veriyor ve ileride izin verici bir politika
   eklenirse ya da RLS bir göçte kapanırsa yetki çoktan verilmiş olur. */
revoke all on table public.client_errors from public, anon, authenticated;
revoke all on sequence public.client_errors_id_seq from public, anon, authenticated;

comment on table public.client_errors is
  'Uygulamadaki JS çökmeleri. Sentry native modül istediği ve uygulama Expo '
  'Go''dan çalıştığı için birinci taraf çözüm. Kullanıcının girdiği metin '
  'yazılmaz; yığın izi ve ekran adı yazılır.';

/**
 * Hata bildirimi.
 *
 * `anon`a da açık ve bu bilinçli: giriş ekranındaki çökme de kaydedilmeli.
 * Bedeli, kimliği olmayan birinin tabloyu şişirebilmesi — üç şeyle
 * sınırlanıyor:
 *
 *   1. **Parmak izi birleştirme.** Aynı hata yeni satır açmıyor, sayacı
 *      artırıyor. Gerçek bir çökme döngüsü tek satır kalıyor.
 *   2. **Saatlik yeni-satır sınırı.** Farklı parmak izleriyle saldıran biri
 *      saatte 200 satırda duruyor. Sınır satıra bakıyor, çağrıya değil:
 *      tekrarlar zaten birleşiyor.
 *   3. **Alan kırpma.** Mesaj 2 KB, yığın 8 KB. Kırpma sunucuda, istemcide
 *      değil — istemciye güvenmenin anlamı yok.
 *
 * Sessizce başarısız oluyor (`void` döner ve hata yutulur): hata bildirimi
 * bir hata verirse kullanıcının gördüğü şey ikinci bir çökme olurdu.
 */
create or replace function public.hata_bildir(
  p_platform   text,
  p_mesaj      text,
  p_parmak_izi text,
  p_ekran      text default null,
  p_yigin      text default null,
  p_surum      text default null,
  p_ek         jsonb default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  yeni_satir_sayisi integer;
  m text := left(btrim(coalesce(p_mesaj, '')), 2048);
  y text := left(coalesce(p_yigin, ''), 8192);
  pi text := left(btrim(coalesce(p_parmak_izi, '')), 128);
begin
  if m = '' or pi = '' then
    return;
  end if;

  /* Saatlik yeni-satır sınırı. Var olan bir parmak izinin sayacını artırmak
     bu sınıra takılmıyor — asıl korunmak istenen şey tablonun satır sayısı. */
  if not exists (select 1 from public.client_errors where parmak_izi = pi) then
    select count(*) into yeni_satir_sayisi
      from public.client_errors where ilk_at > now() - interval '1 hour';
    if yeni_satir_sayisi >= 200 then
      return;
    end if;
  end if;

  insert into public.client_errors
    (user_id, platform, surum, ekran, mesaj, yigin, ek, parmak_izi)
  values
    (auth.uid(),
     case when p_platform in ('ios','android','web') then p_platform else 'bilinmiyor' end,
     left(coalesce(p_surum, ''), 40),
     left(coalesce(p_ekran, ''), 120),
     m, nullif(y, ''), p_ek, pi)
  on conflict (parmak_izi) do update
     set tekrar  = public.client_errors.tekrar + 1,
         son_at  = now(),
         /* Tekrar eden hata yeniden "yeni" oluyor: kapatılmış sanılan bir
            çökme geri geldiyse bunu görmemiz gerekiyor. */
         goruldu = false,
         /* Son görülen bağlam saklanıyor; ilk görülen değil. Bir hata
            zamanla başka bir ekranda da çıkabiliyor ve güncel olan daha
            işe yarar. */
         ekran   = coalesce(excluded.ekran, public.client_errors.ekran),
         user_id = coalesce(excluded.user_id, public.client_errors.user_id);
exception when others then
  /* Bildirimin kendisi çökmeyi büyütmemeli. */
  return;
end; $function$;

revoke all on function public.hata_bildir(text, text, text, text, text, text, jsonb)
  from public;
grant execute on function public.hata_bildir(text, text, text, text, text, text, jsonb)
  to anon, authenticated;

/**
 * Yönetici listesi.
 *
 * `goruldu = false` olanlar önce, sonra en son görülene göre. Panelde asıl
 * soru "şu an neyi bilmiyorum".
 */
create or replace function public.admin_hatalar(p_limit integer default 50)
returns table (
  id         bigint,
  platform   text,
  surum      text,
  ekran      text,
  mesaj      text,
  yigin      text,
  tekrar     integer,
  ilk_at     timestamptz,
  son_at     timestamptz,
  goruldu    boolean,
  kullanici  boolean
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select e.id, e.platform, e.surum, e.ekran, e.mesaj, e.yigin,
         e.tekrar, e.ilk_at, e.son_at, e.goruldu,
         /* Kimliği değil, oturumlu olup olmadığını veriyoruz: "giriş
            ekranında mı çöküyor" sorusunun cevabı bu, kim olduğu değil. */
         e.user_id is not null
    from public.client_errors e
   where public.is_admin()
   order by e.goruldu, e.son_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$function$;

revoke all on function public.admin_hatalar(integer) from public, anon;
grant execute on function public.admin_hatalar(integer) to authenticated;

/** Görüldü işareti — panelde "bunu biliyorum" demek. */
create or replace function public.admin_hata_goruldu(p_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  update public.client_errors set goruldu = true where id = p_id;
end; $function$;

revoke all on function public.admin_hata_goruldu(bigint) from public, anon;
grant execute on function public.admin_hata_goruldu(bigint) to authenticated;
